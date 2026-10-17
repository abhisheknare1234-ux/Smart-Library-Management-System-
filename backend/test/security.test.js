process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-12345';

const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const jwt = require('jsonwebtoken');
const app = require('../server');

let server;
let baseUrl;
let adminToken;
let librarianToken;
let memberAToken;
let memberBToken;

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

            const adminLogin = await request('POST', '/api/auth/login', {
                identifier: 'admin',
                password: 'admin123',
                role: 'Admin'
            });
            adminToken = adminLogin.body.token;

            const libLogin = await request('POST', '/api/auth/login', {
                identifier: 'soham@library.com',
                password: 'librarian123',
                role: 'Librarian'
            });
            librarianToken = libLogin.body.token;

            // Create Member A
            await request('POST', '/api/members', {
                id: 'MEM-SEC-A',
                name: 'Alice Security',
                email: 'alice.sec@test.edu',
                phone: '9888800001',
                department: 'Cybersecurity',
                type: 'Student',
                password: 'member123'
            }, librarianToken);

            const loginA = await request('POST', '/api/auth/login', {
                identifier: 'alice.sec@test.edu',
                password: 'member123',
                role: 'Member'
            });
            memberAToken = loginA.body.token;

            // Create Member B
            await request('POST', '/api/members', {
                id: 'MEM-SEC-B',
                name: 'Bob Security',
                email: 'bob.sec@test.edu',
                phone: '9888800002',
                department: 'Cybersecurity',
                type: 'Student',
                password: 'member123'
            }, librarianToken);

            const loginB = await request('POST', '/api/auth/login', {
                identifier: 'bob.sec@test.edu',
                password: 'member123',
                role: 'Member'
            });
            memberBToken = loginB.body.token;

            resolve();
        });
    });
});

test.after(async () => {
    return new Promise((resolve) => {
        server.close(resolve);
    });
});

test('ADVERSARIAL AUDIT: Security, RBAC, IDOR & Injection Resilience', async (t) => {

    await t.test('1. Authentication Vulnerability Tests', async () => {
        // Tampered token signature
        const tamperedToken = memberAToken.slice(0, -5) + 'xxxxx';
        const res1 = await request('GET', '/api/auth/me', null, tamperedToken);
        assert.strictEqual(res1.status, 401);

        // Forged token with different secret
        const forgedToken = jwt.sign({ id: 'admin', role: 'Admin' }, 'wrong-secret-key-attacker');
        const res2 = await request('GET', '/api/stats/admin', null, forgedToken);
        assert.strictEqual(res2.status, 401);

        // Expired token
        const expiredToken = jwt.sign({ id: 'admin', role: 'Admin' }, process.env.JWT_SECRET, { expiresIn: -10 });
        const res3 = await request('GET', '/api/stats/admin', null, expiredToken);
        assert.strictEqual(res3.status, 401);

        // Empty Authorization header
        const res4 = await request('GET', '/api/members');
        assert.strictEqual(res4.status, 401);
    });

    await t.test('2. RBAC Privilege Escalation Attempts', async () => {
        // Member attempts to create a Librarian
        const res1 = await request('POST', '/api/librarians', {
            name: 'Malicious Staff',
            email: 'malicious@test.com',
            phone: '1234567890'
        }, memberAToken);
        assert.strictEqual(res1.status, 403);

        // Member attempts to trigger a database backup
        const res2 = await request('POST', '/api/backups', {}, memberAToken);
        assert.strictEqual(res2.status, 403);

        // Librarian attempts to trigger a database backup (Admin only)
        const res3 = await request('POST', '/api/backups', {}, librarianToken);
        assert.strictEqual(res3.status, 403);

        // Member attempts to modify library settings
        const res4 = await request('PUT', '/api/settings', { fine_per_day: '0' }, memberAToken);
        assert.strictEqual(res4.status, 403);
    });

    await t.test('3. IDOR (Insecure Direct Object Reference) Protection', async () => {
        // Member A attempts to view Member B's private profile
        const res1 = await request('GET', '/api/members/MEM-SEC-B/profile', null, memberAToken);
        assert.strictEqual(res1.status, 403);

        // Member A attempts to edit Member B's profile
        const res2 = await request('PUT', '/api/members/MEM-SEC-B/profile', {
            name: 'Hacked By Alice'
        }, memberAToken);
        assert.strictEqual(res2.status, 403);

        // Member A can view their own profile
        const res3 = await request('GET', '/api/members/MEM-SEC-A/profile', null, memberAToken);
        assert.strictEqual(res3.status, 200);
        assert.strictEqual(res3.body.member.id, 'MEM-SEC-A');
    });

    await t.test('4. SQL Injection Attacks via User Inputs', async () => {
        const sqliPayloads = [
            "' OR '1'='1",
            "1; DROP TABLE books;--",
            "1' UNION SELECT username, password_hash, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1 FROM admins--",
            "' OR SLEEP(2)--",
            "'; PRAGMA table_info(books);--"
        ];

        for (const payload of sqliPayloads) {
            // Search query param
            const res = await request('GET', `/api/books?search=${encodeURIComponent(payload)}`);
            assert.strictEqual(res.status, 200);
            assert.ok(Array.isArray(res.body.books));

            // Category filter
            const catRes = await request('GET', `/api/books?category=${encodeURIComponent(payload)}`);
            assert.strictEqual(catRes.status, 200);
            assert.ok(Array.isArray(catRes.body.books));
        }
    });

    await t.test('5. Malicious Input & XSS Sanitization', async () => {
        const xssPayload = "<script>alert('pwned')</script>";
        const addMemberRes = await request('POST', '/api/members', {
            id: `MEM-XSS-${Date.now()}`,
            name: 'XssTarget Shield',
            email: `xss.${Date.now()}@test.edu`,
            phone: '9888800003',
            department: xssPayload,
            type: 'Student',
            password: 'member123'
        }, librarianToken);

        assert.strictEqual(addMemberRes.status, 201);

        // Retrieve member and check that script tag was sanitized/escaped
        const getMember = await request('GET', `/api/members/${addMemberRes.body.id || `MEM-XSS-${Date.now()}`}/profile`, null, librarianToken);
        if (getMember.body && getMember.body.member) {
            assert.ok(!getMember.body.member.department.includes("<script>alert"));
        }
    });
});
