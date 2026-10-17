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
let adminToken;

function request(method, path, body = null, token = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, baseUrl);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: method,
            agent: false,
            headers: {
                'Content-Type': 'application/json',
                'Connection': 'close',
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
    const migrate = require('../scripts/migrate');
    await migrate();

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

test('PERFORMANCE BENCHMARK: Realistic Scale Dataset (1,000 Books, 5,000 Copies, 10,000 Members, 50,000 Historical Loans)', async (t) => {
    const conn = await pool.getConnection();

    await t.test('1. Populate High-Volume Realistic Dataset', async () => {
        console.log('[PERFORMANCE TEST] Generating bulk dataset (1,000 books, 5,000 copies, 10,000 members, 50,000 loans)...');
        const startPopulate = Date.now();

        await conn.beginTransaction();

        // 1. Bulk Insert 1,000 Books
        const categories = ["Computer Science", "Programming", "Database", "Networking", "Finance", "History", "Physics"];
        for (let i = 1; i <= 1000; i++) {
            const bId = `PERF-B-${i}`;
            const cat = categories[i % categories.length];
            await conn.query(
                `INSERT OR IGNORE INTO books (id, title, author, category, publisher, isbn, total_quantity, available_quantity)
                 VALUES (?, ?, ?, ?, 'Performance Press', ?, 5, 5)`,
                [bId, `Volume Title ${i} Engineering Analysis`, `Author Person ${i % 100}`, cat, `9780000${String(i).padStart(6, '0')}`]
            );

            // 5 Copies per book = 5,000 physical copies
            for (let c = 1; c <= 5; c++) {
                await conn.query(
                    `INSERT OR IGNORE INTO book_copies (id, book_id, copy_number, barcode, status)
                     VALUES (?, ?, ?, ?, 'AVAILABLE')`,
                    [`BC-${bId}-${c}`, bId, c, `BAR-PERF-${bId}-${c}`]
                );
            }
        }

        // 2. Bulk Insert 10,000 Members
        for (let m = 1; m <= 10000; m += 500) {
            for (let j = m; j < m + 500; j++) {
                const memId = `PERF-M-${j}`;
                await conn.query(
                    `INSERT OR IGNORE INTO members (id, name, email, phone, department, type, password_hash)
                     VALUES (?, ?, ?, '9876500000', 'Engineering', 'Student', 'hash')`,
                    [memId, `Member Student ${j}`, `perf.member.${j}@university.edu`]
                );
            }
        }

        // 3. Bulk Insert 50,000 Historical Loans
        for (let l = 1; l <= 50000; l += 1000) {
            for (let k = l; k < l + 1000; k++) {
                const bId = `PERF-B-${(k % 1000) + 1}`;
                const copyId = `BC-${bId}-${(k % 5) + 1}`;
                const memId = `PERF-M-${(k % 10000) + 1}`;
                const isOverdue = k % 10 === 0;
                await conn.query(
                    `INSERT OR IGNORE INTO issues (book_id, copy_id, member_id, librarian_id, issue_date, due_date, return_date, status, fine_amount, fine_status)
                     VALUES (?, ?, ?, 'LIB001', '2026-05-01', '2026-05-15', '2026-05-20', 'Returned', ?, ?)`,
                    [bId, copyId, memId, isOverdue ? 25.00 : 0, isOverdue ? 'Paid' : 'None']
                );
            }
        }

        await conn.commit();
        conn.release();

        const duration = Date.now() - startPopulate;
        console.log(`[PERFORMANCE TEST] Dataset populated successfully in ${duration}ms.`);
    });

    await t.test('2. Benchmark Catalog Search Latency (1,000 books)', async () => {
        // Warmup
        await request('GET', '/api/books?search=Title&limit=10');

        const latencies = [];
        for (let i = 0; i < 20; i++) {
            const start = performance.now();
            const res = await request('GET', `/api/books?search=Title%20${i * 40}&limit=10`);
            const end = performance.now();
            assert.strictEqual(res.status, 200);
            latencies.push(end - start);
        }

        latencies.sort((a, b) => a - b);
        const p50 = latencies[Math.floor(latencies.length * 0.5)];
        const p95 = latencies[Math.floor(latencies.length * 0.95)];
        console.log(`[BENCHMARK] Book Search: p50 = ${p50.toFixed(2)}ms, p95 = ${p95.toFixed(2)}ms`);

        assert.ok(p95 < 100, `Book search p95 (${p95.toFixed(2)}ms) must be under 100ms`);
    });

    await t.test('3. Benchmark Member Search / Lookup Latency (10,000 members)', async () => {
        // Warmup
        await request('GET', '/api/members/PERF-M-1/profile', null, librarianToken);

        const latencies = [];
        for (let i = 0; i < 20; i++) {
            const start = performance.now();
            const res = await request('GET', `/api/members/PERF-M-${(i * 450) + 1}/profile`, null, librarianToken);
            const end = performance.now();
            assert.strictEqual(res.status, 200);
            latencies.push(end - start);
        }

        latencies.sort((a, b) => a - b);
        const p50 = latencies[Math.floor(latencies.length * 0.5)];
        const p95 = latencies[Math.floor(latencies.length * 0.95)];
        console.log(`[BENCHMARK] Member Lookup: p50 = ${p50.toFixed(2)}ms, p95 = ${p95.toFixed(2)}ms`);

        assert.ok(p95 < 100, `Member lookup p95 (${p95.toFixed(2)}ms) must be under 100ms`);
    });

    await t.test('4. Benchmark Dashboard Aggregation Latency (50,000 historical loans)', async () => {
        // Warmup
        await request('GET', '/api/stats/admin', null, adminToken);

        const latencies = [];
        for (let i = 0; i < 10; i++) {
            const start = performance.now();
            const res = await request('GET', '/api/stats/admin', null, adminToken);
            const end = performance.now();
            assert.strictEqual(res.status, 200);
            assert.ok(res.body.stats.totalBooks >= 1000);
            assert.ok(res.body.stats.totalMembers >= 10000);
            latencies.push(end - start);
        }

        latencies.sort((a, b) => a - b);
        const p50 = latencies[Math.floor(latencies.length * 0.5)];
        const p95 = latencies[Math.floor(latencies.length * 0.95)];
        console.log(`[BENCHMARK] Admin Dashboard: p50 = ${p50.toFixed(2)}ms, p95 = ${p95.toFixed(2)}ms`);

        assert.ok(p95 < 1000, `Dashboard aggregation p95 (${p95.toFixed(2)}ms) must be under 1000ms`);
    });

    await t.test('5. Benchmark Filtered Issues & Pagination Latency (50,000 loans)', async () => {
        // Warmup
        await request('GET', '/api/issues?status=Returned&limit=50', null, librarianToken);

        const latencies = [];
        for (let i = 0; i < 10; i++) {
            const start = performance.now();
            const res = await request('GET', '/api/issues?status=Returned&limit=50', null, librarianToken);
            const end = performance.now();
            assert.strictEqual(res.status, 200);
            latencies.push(end - start);
        }

        latencies.sort((a, b) => a - b);
        const p50 = latencies[Math.floor(latencies.length * 0.5)];
        const p95 = latencies[Math.floor(latencies.length * 0.95)];
        console.log(`[BENCHMARK] Issues Query: p50 = ${p50.toFixed(2)}ms, p95 = ${p95.toFixed(2)}ms`);

        assert.ok(p95 < 150, `Issues query p95 (${p95.toFixed(2)}ms) must be under 150ms`);
    });
});
