process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-12345';

const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const app = require('../server');
const pool = require('../config/db');

let server;
let port;
let baseUrl;

let adminToken;
let librarianToken;
let memberToken;

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
        server = app.listen(0, () => {
            port = server.address().port;
            baseUrl = `http://127.0.0.1:${port}`;
            console.log(`Test server running at ${baseUrl}`);
            resolve();
        });
    });
});

test.after(async () => {
    return new Promise((resolve) => {
        server.close(resolve);
    });
});

// 1. Health & Status
test('1. API Health Check', async () => {
    const res = await request('GET', '/api/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.match(res.body.message, /running/i);
});

// 2. Authentication & Roles
test('2. Authentication Flow', async (t) => {
    await t.test('Admin Login', async () => {
        const res = await request('POST', '/api/auth/login', {
            identifier: 'admin',
            password: 'admin123',
            role: 'Admin'
        });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);
        assert.ok(res.body.token);
        assert.strictEqual(res.body.user.role, 'Admin');
        adminToken = res.body.token;
    });

    await t.test('Librarian Login', async () => {
        const res = await request('POST', '/api/auth/login', {
            identifier: 'soham@library.com',
            password: 'librarian123',
            role: 'Librarian'
        });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);
        assert.ok(res.body.token);
        assert.strictEqual(res.body.user.role, 'Librarian');
        librarianToken = res.body.token;
    });

    await t.test('Member Login', async () => {
        const res = await request('POST', '/api/auth/login', {
            identifier: 'rahul@gmail.com',
            password: 'member123',
            role: 'Member'
        });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);
        assert.ok(res.body.token);
        assert.strictEqual(res.body.user.role, 'Member');
        memberToken = res.body.token;
    });

    await t.test('Reject Invalid Password', async () => {
        const res = await request('POST', '/api/auth/login', {
            identifier: 'admin',
            password: 'wrongpassword',
            role: 'Admin'
        });
        assert.strictEqual(res.status, 401);
        assert.strictEqual(res.body.success, false);
    });

    await t.test('Verify Profile via /api/auth/me', async () => {
        const res = await request('GET', '/api/auth/me', null, memberToken);
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);
        assert.strictEqual(res.body.user.email, 'rahul@gmail.com');
    });
});

// 3. Authorization Security Checks
test('3. RBAC Authorization Enforcement', async (t) => {
    await t.test('Reject Unauthenticated Request to Protected Route', async () => {
        const res = await request('GET', '/api/members');
        assert.strictEqual(res.status, 401);
    });

    await t.test('Reject Member Access to Librarian/Admin Route', async () => {
        const res = await request('POST', '/api/librarians', {
            name: 'Hacker',
            email: 'hacker@test.com',
            phone: '1234567890'
        }, memberToken);
        assert.strictEqual(res.status, 403);
    });
});

// 4. Books and Physical Copies
let testBookId;
test('4. Books Management & Physical Copy Tracking', async (t) => {
    await t.test('Fetch Book List with availability', async () => {
        const res = await request('GET', '/api/books');
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);
        assert.ok(Array.isArray(res.body.books));
        assert.ok(res.body.books.length > 0);
        assert.ok(typeof res.body.books[0].availableQuantity === 'number');
    });

    await t.test('Create Book with Physical Copies', async () => {
        const newBook = {
            title: 'Automated Test Engineering in Node.js',
            author: 'Antigravity Architect',
            category: 'Computer Science',
            isbn: '978-0123456789',
            publisher: 'TechPress Editions',
            quantity: 3
        };
        const res = await request('POST', '/api/books', newBook, librarianToken);
        assert.strictEqual(res.status, 201);
        assert.strictEqual(res.body.success, true);
        assert.ok(res.body.book.id);
        testBookId = res.body.book.id;

        // Verify physical copies were created
        const copiesRes = await request('GET', `/api/books/${testBookId}/copies`, null, librarianToken);
        assert.strictEqual(copiesRes.status, 200);
        assert.strictEqual(copiesRes.body.success, true);
        assert.strictEqual(copiesRes.body.copies.length, 3);
        assert.strictEqual(copiesRes.body.copies[0].status, 'AVAILABLE');
    });

    await t.test('Update Book Details', async () => {
        const res = await request('PUT', `/api/books/${testBookId}`, {
            name: 'Automated Test Engineering in Node.js (2nd Edition)',
            author: 'Antigravity Architect & Co.',
            category: 'Computer Science',
            isbn: '978-0123456789',
            publisher: 'TechPress Editions',
            quantity: 3
        }, adminToken);
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);
    });
});

// 5. Members Management
let testMemberId = 'MEM-TEST-' + Date.now();
test('5. Members Management & Registration', async (t) => {
    await t.test('Create New Member', async () => {
        const res = await request('POST', '/api/members', {
            id: testMemberId,
            name: 'Pooja Sharma',
            email: `pooja.${Date.now()}@gmail.com`,
            phone: '9876501234',
            department: 'Information Technology',
            type: 'Student'
        }, librarianToken);
        assert.strictEqual(res.status, 201);
        assert.strictEqual(res.body.success, true);
    });

    await t.test('Retrieve Member Profile', async () => {
        const res = await request('GET', `/api/members/${testMemberId}/profile`, null, librarianToken);
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);
        assert.strictEqual(res.body.member.name, 'Pooja Sharma');
    });
});

// 6. Complete Issue, Renew, Return Workflow
let testIssueId;
test('6. Library Circulation Workflows (Issue, Renew, Return)', async (t) => {
    await t.test('Issue Book to Member (Locks available physical copy)', async () => {
        const res = await request('POST', '/api/issues', {
            bookId: testBookId,
            memberId: testMemberId
        }, librarianToken);
        assert.strictEqual(res.status, 201);
        assert.strictEqual(res.body.success, true);
        assert.ok(res.body.issueId);
        testIssueId = res.body.issueId;

        // Verify copy status changed to ISSUED
        const copiesRes = await request('GET', `/api/books/${testBookId}/copies`, null, librarianToken);
        const issuedCopies = copiesRes.body.copies.filter(c => c.status === 'ISSUED');
        assert.strictEqual(issuedCopies.length, 1);
    });

    await t.test('Renew Issued Book', async () => {
        const res = await request('POST', `/api/issues/${testIssueId}/renew`, {}, librarianToken);
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);
    });

    await t.test('Return Issued Book (Releases copy back to AVAILABLE)', async () => {
        const res = await request('POST', `/api/issues/${testIssueId}/return`, {}, librarianToken);
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);

        // Verify copy status returned to AVAILABLE
        const copiesRes = await request('GET', `/api/books/${testBookId}/copies`, null, librarianToken);
        const availableCopies = copiesRes.body.copies.filter(c => c.status === 'AVAILABLE');
        assert.strictEqual(availableCopies.length, 3);
    });
});

// 7. Reservations Workflow
let testReservationId;
test('7. Reservations Workflow & Queueing', async (t) => {
    await t.test('Create Book Reservation as Member', async () => {
        const res = await request('POST', '/api/reservations', {
            bookId: testBookId
        }, memberToken);
        assert.strictEqual(res.status, 201);
        assert.strictEqual(res.body.success, true);
        testReservationId = res.body.id || res.body.reservationId;
    });

    await t.test('Prevent Duplicate Active Reservation for Same Book', async () => {
        const res = await request('POST', '/api/reservations', {
            bookId: testBookId
        }, memberToken);
        assert.strictEqual(res.status, 409);
        assert.strictEqual(res.body.success, false);
    });

    await t.test('Cancel Reservation', async () => {
        const res = await request('PUT', `/api/reservations/${testReservationId}/cancel`, {}, memberToken);
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);
    });
});

// 8. Fines & Discrete Payments Workflow
test('8. Fines & Payment Receipts', async (t) => {
    // Find an existing pending fine or create a fine
    const finesRes = await request('GET', '/api/fines?status=Pending', null, librarianToken);
    assert.strictEqual(finesRes.status, 200);
    assert.strictEqual(finesRes.body.success, true);

    if (finesRes.body.fines && finesRes.body.fines.length > 0) {
        const targetFine = finesRes.body.fines[0];
        const payRes = await request('POST', `/api/fines/${targetFine.issueId}/pay`, {
            paymentMethod: 'UPI'
        }, librarianToken);
        assert.strictEqual(payRes.status, 200);
        assert.strictEqual(payRes.body.success, true);
        assert.ok(payRes.body.receiptNumber);

        // Verify payment is recorded in /api/fines/payments
        const paymentsRes = await request('GET', '/api/fines/payments', null, adminToken);
        assert.strictEqual(paymentsRes.status, 200);
        assert.strictEqual(paymentsRes.body.success, true);
        const receipt = paymentsRes.body.payments.find(p => p.receipt_number === payRes.body.receiptNumber);
        assert.ok(receipt);
    }
});

// 9. Operational Settings
test('9. Library Settings Management', async (t) => {
    await t.test('Fetch System Settings', async () => {
        const res = await request('GET', '/api/settings');
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);
        assert.ok(res.body.settings.library_name);
    });

    await t.test('Update Operational Setting', async () => {
        const res = await request('PUT', '/api/settings', {
            fine_per_day: '10',
            loan_days: '21'
        }, adminToken);
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);
        assert.strictEqual(res.body.settings.fine_per_day, '10');
        assert.strictEqual(res.body.settings.loan_days, '21');
    });
});

// 10. Dashboard Analytics
test('10. Dashboard Analytics (Real DB Metrics)', async () => {
    const adminStatsRes = await request('GET', '/api/stats/admin', null, adminToken);
    assert.strictEqual(adminStatsRes.status, 200);
    assert.strictEqual(adminStatsRes.body.success, true);
    assert.ok(adminStatsRes.body.stats.totalBooks > 0);
    assert.ok(adminStatsRes.body.stats.totalMembers > 0);

    const libStatsRes = await request('GET', '/api/stats/librarian', null, librarianToken);
    assert.strictEqual(libStatsRes.status, 200);
    assert.strictEqual(libStatsRes.body.success, true);
    assert.ok(typeof libStatsRes.body.stats.availableBooks === 'number');
});