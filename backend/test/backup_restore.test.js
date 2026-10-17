process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-12345';

const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const fs = require('fs');
const path = require('path');
const app = require('../server');
const pool = require('../config/db');

let server;
let baseUrl;
let adminToken;
let librarianToken;

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

            resolve();
        });
    });
});

test.after(async () => {
    return new Promise((resolve) => {
        server.close(resolve);
    });
});

test('BACKUP & RESTORE AUDIT: End-to-End Database Backup and Full Point-in-Time Recovery', async (t) => {
    let backupId;
    let backupFileName;
    const testTitle = `Restoration Witness Book ${Date.now()}`;
    const testIsbn = '9780998877665';
    let testBookId;

    await t.test('1. Insert Critical Test Record', async () => {
        const createRes = await request('POST', '/api/books', {
            title: testTitle,
            author: 'Disaster Recovery Engineer',
            category: 'Computer Science',
            isbn: testIsbn,
            publisher: 'Resilience Publications',
            quantity: 2
        }, librarianToken);

        assert.strictEqual(createRes.status, 201);
        testBookId = createRes.body.id;
        assert.ok(testBookId);
    });

    await t.test('2. Generate Real Database Backup via API', async () => {
        const backupRes = await request('POST', '/api/backups', {}, adminToken);
        assert.strictEqual(backupRes.status, 201);
        assert.strictEqual(backupRes.body.success, true);
        assert.ok(backupRes.body.backup.id);
        assert.ok(backupRes.body.backup.fileName);

        backupId = backupRes.body.backup.id;
        backupFileName = backupRes.body.backup.fileName;

        // Verify file exists on disk
        const filePath = path.join(__dirname, '..', 'backups_files', backupFileName);
        assert.ok(fs.existsSync(filePath), 'Backup file must exist in backups_files/');

        const content = fs.readFileSync(filePath, 'utf8');
        assert.ok(content.includes(testTitle), 'Backup dump must contain the newly inserted test record');
    });

    await t.test('3. Simulate Data Loss / Accidental Deletion', async () => {
        // Delete the record from the database
        await pool.query("DELETE FROM books WHERE id = ?", [testBookId]);

        // Verify it is completely gone
        const [checkRows] = await pool.query("SELECT * FROM books WHERE id = ?", [testBookId]);
        assert.strictEqual(checkRows.length, 0, 'Record should be gone before restore');
    });

    await t.test('4. Execute Full Restore from Backup via POST /api/backups/:id/restore', async () => {
        const restoreRes = await request('POST', `/api/backups/${backupId}/restore`, {}, adminToken);
        assert.strictEqual(restoreRes.status, 200, `Restore failed: ${JSON.stringify(restoreRes.body)}`);
        assert.strictEqual(restoreRes.body.success, true);
        assert.match(restoreRes.body.message, /successfully restored/i);
    });

    await t.test('5. Verify Complete Data Recovery', async () => {
        // Query database to ensure record was brought back
        const [recoveredRows] = await pool.query("SELECT * FROM books WHERE id = ?", [testBookId]);
        assert.strictEqual(recoveredRows.length, 1, 'Record must be fully restored in database');
        assert.strictEqual(recoveredRows[0].title, testTitle);

        // Verify physical copies were also restored
        const [recoveredCopies] = await pool.query("SELECT * FROM book_copies WHERE book_id = ?", [testBookId]);
        assert.strictEqual(recoveredCopies.length, 2, 'Physical copies must also be restored');
    });
});
