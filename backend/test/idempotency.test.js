process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-12345';

const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const app = require('../server');
const pool = require('../config/db');

let server;
let baseUrl;
let librarianToken;
let memberToken;
let testMemberId;

function request(method, path, body = null, token = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, baseUrl);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: method,
            headers: {
                'Content-Type': 'application/json',
            }
        };
        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }
        if (body) {
            const data = JSON.stringify(body);
            options.headers['Content-Length'] = Buffer.byteLength(data);
        }

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                let parsed = null;
                try {
                    parsed = JSON.parse(data);
                } catch (_) {
                    parsed = data;
                }
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    body: parsed
                });
            });
        });

        req.on('error', reject);
        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

test.before(async () => {
    return new Promise((resolve) => {
        server = app.listen(0, async () => {
            const port = server.address().port;
            baseUrl = `http://127.0.0.1:${port}`;

            // Login librarian
            const libLogin = await request('POST', '/api/auth/login', {
                identifier: 'soham@library.com',
                password: 'librarian123',
                role: 'Librarian'
            });
            librarianToken = libLogin.body.token;

            // Create test member
            testMemberId = `MEM-IDEMP-${Date.now()}`;
            await request('POST', '/api/members', {
                id: testMemberId,
                name: 'Idempotency Tester',
                email: `idemp.${Date.now()}@test.edu`,
                phone: '9988771122',
                department: 'Finance',
                type: 'Student',
                password: 'member123'
            }, librarianToken);

            const memLogin = await request('POST', '/api/auth/login', {
                identifier: `idemp.${Date.now()}@test.edu`,
                password: 'member123',
                role: 'Member'
            });
            memberToken = memLogin.body.token;

            resolve();
        });
    });
});

test.after(async () => {
    return new Promise((resolve) => {
        server.close(resolve);
    });
});

test('PAYMENT IDEMPOTENCY: Concurrent & Replay Protection for Fine Transactions', async (t) => {
    // 1. Create a dummy overdue issue record directly in DB to simulate a real ₹75 overdue fine
    const [bookResult] = await pool.query("SELECT id FROM books LIMIT 1");
    const bookId = bookResult[0].id;

    const [copyResult] = await pool.query("SELECT id FROM book_copies WHERE book_id = ? LIMIT 1", [bookId]);
    const copyId = copyResult[0].id;

    const [issueRes] = await pool.query(
        `INSERT INTO issues (book_id, copy_id, member_id, librarian_id, issue_date, due_date, return_date, status, fine_amount, fine_status)
         VALUES (?, ?, ?, 'LIB001', '2026-08-01', '2026-08-15', '2026-08-30', 'Returned', 75.00, 'Pending')`,
        [bookId, copyId, testMemberId]
    );
    const testIssueId = issueRes.insertId;

    const idempotencyKey = `TX-RETRY-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    await t.test('10 Concurrent Payment Requests with Identical Transaction Reference', async () => {
        // Send 10 requests at the exact same moment
        const promises = Array.from({ length: 10 }).map(() => {
            return request('POST', `/api/fines/${testIssueId}/pay`, {
                paymentMethod: 'UPI',
                transactionRef: idempotencyKey
            }, librarianToken);
        });

        const results = await Promise.all(promises);

        // All responses must be HTTP 200 (either processed or idempotent replay)
        for (const res of results) {
            assert.strictEqual(res.status, 200, `Unexpected status: ${res.status}, body: ${JSON.stringify(res.body)}`);
            assert.strictEqual(res.body.success, true);
            assert.strictEqual(Number(res.body.receipt.issueId), Number(testIssueId));
            assert.strictEqual(res.body.receipt.amount, 75);
            assert.strictEqual(res.body.receipt.transactionRef, idempotencyKey);
        }

        // Database assertion: Exactly ONE payment record must exist in payments table
        const [payments] = await pool.query(
            "SELECT * FROM payments WHERE issue_id = ? AND transaction_ref = ?",
            [testIssueId, idempotencyKey]
        );
        assert.strictEqual(payments.length, 1, `Expected exactly 1 payment record, found ${payments.length}`);

        // Issue status must be Paid
        const [updatedIssue] = await pool.query("SELECT fine_status FROM issues WHERE id = ?", [testIssueId]);
        assert.strictEqual(updatedIssue[0].fine_status, 'Paid');
    });

    await t.test('Subsequent Network Replay with Same Transaction Reference', async () => {
        // Client reconnects 5 seconds later and sends the same request
        const replayRes = await request('POST', `/api/fines/${testIssueId}/pay`, {
            paymentMethod: 'UPI',
            transactionRef: idempotencyKey
        }, librarianToken);

        assert.strictEqual(replayRes.status, 200);
        assert.strictEqual(replayRes.body.success, true);
        assert.strictEqual(replayRes.body.isDuplicateReplay, true);
        assert.strictEqual(replayRes.body.receipt.transactionRef, idempotencyKey);

        // Verify still exactly 1 record
        const [payments] = await pool.query(
            "SELECT * FROM payments WHERE issue_id = ?",
            [testIssueId]
        );
        assert.strictEqual(payments.length, 1);
    });

    await t.test('Rejection of Fresh Payment on Already Paid Fine', async () => {
        // Different transaction ref trying to pay an already paid fine
        const freshRes = await request('POST', `/api/fines/${testIssueId}/pay`, {
            paymentMethod: 'Cash',
            transactionRef: `DIFFERENT-TX-${Date.now()}`
        }, librarianToken);

        assert.strictEqual(freshRes.status, 409);
        assert.strictEqual(freshRes.body.success, false);
        assert.match(freshRes.body.message, /already been paid/i);
    });
});
