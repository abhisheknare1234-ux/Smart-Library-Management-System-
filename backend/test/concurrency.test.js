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
let memberTokens = [];

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

            // Create 20 unique test members with valid names
            const names = ["Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel", "India", "Juliet", "Kilo", "Lima", "Mike", "November", "Oscar", "Papa", "Quebec", "Romeo", "Sierra", "Tango"];
            const batchId = Date.now();
            for (let i = 0; i < 20; i++) {
                const memId = `CONC-${batchId}-${i + 1}`;
                const memEmail = `patron.${names[i].toLowerCase()}.${batchId}@test.edu`;
                const createRes = await request('POST', '/api/members', {
                    id: memId,
                    name: `Patron ${names[i]}`,
                    email: memEmail,
                    phone: `999000${String(i + 1).padStart(4, '0')}`,
                    department: 'Computer Science',
                    type: 'Student',
                    password: 'member123'
                }, librarianToken);

                assert.strictEqual(createRes.status, 201, `Failed to create member ${memId}: ${JSON.stringify(createRes.body)}`);

                const memLogin = await request('POST', '/api/auth/login', {
                    identifier: memEmail,
                    password: 'member123',
                    role: 'Member'
                });
                assert.strictEqual(memLogin.status, 200, `Failed to login member ${memEmail}`);
                memberTokens.push({ id: memId, token: memLogin.body.token });
            }

            resolve();
        });
    });
});

test.after(async () => {
    return new Promise((resolve) => {
        server.close(resolve);
    });
});

test('CONCURRENCY AUDIT: 20 Simultaneous Borrow Requests for EXACTLY 1 Available Physical Copy', async () => {
    // 1. Create a book with EXACTLY 1 physical copy
    const bookTitle = `Rare Manuscript ${Date.now()}`;
    const createBookRes = await request('POST', '/api/books', {
        title: bookTitle,
        author: 'Archival Author',
        category: 'History',
        isbn: `978012345${String(Math.floor(Math.random() * 9000) + 1000)}`,
        publisher: 'Heritage Press',
        quantity: 1
    }, librarianToken);

    assert.strictEqual(createBookRes.status, 201);
    const bookId = createBookRes.body.id;

    // Verify copy is available
    const copiesRes = await request('GET', `/api/books/${bookId}/copies`, null, librarianToken);
    assert.strictEqual(copiesRes.body.copies.length, 1);
    assert.strictEqual(copiesRes.body.copies[0].status, 'AVAILABLE');
    const singleCopyId = copiesRes.body.copies[0].id;

    // 2. Fire 20 SIMULTANEOUS issue requests from 20 different members
    console.log(`[CONCURRENCY TEST] Firing 20 simultaneous issue requests for copy ${singleCopyId}...`);
    const issuePromises = memberTokens.map(m => {
        return request('POST', '/api/issues', {
            bookId: bookId,
            memberId: m.id
        }, librarianToken);
    });

    const results = await Promise.all(issuePromises);

    // 3. Evaluate results
    const successes = results.filter(r => r.status === 201);
    const rejections = results.filter(r => r.status === 409);
    const errors = results.filter(r => r.status !== 201 && r.status !== 409);

    console.log(`[CONCURRENCY TEST] Results: ${successes.length} SUCCESS (201), ${rejections.length} REJECTED (409), ${errors.length} UNEXPECTED ERRORS`);
    if (errors.length) {
        console.log("Sample error:", results[0].status, results[0].body);
    }

    // Strict assertions:
    // Exactly 1 must succeed
    assert.strictEqual(successes.length, 1, `Expected exactly 1 success, but got ${successes.length}`);
    
    // All other 19 must be rejected with 409 Conflict
    assert.strictEqual(rejections.length, 19, `Expected exactly 19 rejections, but got ${rejections.length}`);
    assert.strictEqual(errors.length, 0, `Expected 0 unexpected errors, but got ${errors.length}`);

    // 4. Database state verification
    // Verify physical copy in database
    const [copiesInDb] = await pool.query("SELECT status FROM book_copies WHERE id = ?", [singleCopyId]);
    assert.strictEqual(copiesInDb[0].status, 'ISSUED');

    // Verify issues in database
    const [activeIssues] = await pool.query(
        "SELECT * FROM issues WHERE book_id = ? AND status = 'Active'",
        [bookId]
    );
    assert.strictEqual(activeIssues.length, 1, `Expected exactly 1 active loan record in database, found ${activeIssues.length}`);
    assert.strictEqual(activeIssues[0].copy_id, singleCopyId);

    // Verify book available_quantity is 0
    const [bookInDb] = await pool.query("SELECT available_quantity FROM books WHERE id = ?", [bookId]);
    assert.strictEqual(bookInDb[0].available_quantity, 0);

    console.log('[CONCURRENCY TEST] PASSED: Database integrity perfectly preserved under 20-thread race condition.');
});
