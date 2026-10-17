const path = require("path");
const fs = require("fs");
require("dotenv").config();

let activeDialect = "sqlite";
let mysqlPool = null;
let sqliteDb = null;

// Ensure data directory exists for SQLite
const DATA_DIR = path.join(__dirname, "..", "data");
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}
const SQLITE_FILE = process.env.SQLITE_DB_PATH || path.join(DATA_DIR, "library_hub.sqlite");

// Helper to initialize SQLite connection
function initSqlite() {
    const { DatabaseSync } = require("node:sqlite");
    const db = new DatabaseSync(SQLITE_FILE);
    db.exec("PRAGMA foreign_keys = ON;");
    db.exec("PRAGMA journal_mode = WAL;");
    db.exec("PRAGMA busy_timeout = 10000;");

    // Register MySQL-compatible functions
    try {
        db.function("CURDATE", () => new Date().toISOString().slice(0, 10));
        db.function("NOW", () => new Date().toISOString().slice(0, 19).replace("T", " "));
        db.function("IFNULL", (a, b) => (a === null || a === undefined ? b : a));
        db.function("DATEDIFF", (d1, d2) => {
            if (!d1 || !d2) return 0;
            const t1 = new Date(String(d1).slice(0, 10) + "T00:00:00").getTime();
            const t2 = new Date(String(d2).slice(0, 10) + "T00:00:00").getTime();
            return Math.round((t1 - t2) / 86400000);
        });
        db.function("DATE_ADD", (dateStr, days) => {
            if (!dateStr) return null;
            const d = new Date(String(dateStr).slice(0, 10) + "T00:00:00");
            d.setDate(d.getDate() + Number(days));
            return d.toISOString().slice(0, 10);
        });
    } catch (_) {}

    return db;
}

// SQLite Transaction Mutex to serialize transactions across concurrent async requests
let transactionMutex = Promise.resolve();

function acquireTransactionLock() {
    let release;
    const lockPromise = new Promise(resolve => { release = resolve; });
    const waitPromise = transactionMutex.then(() => release);
    transactionMutex = transactionMutex.then(() => lockPromise).catch(() => {});
    return waitPromise;
}

// Convert SQLite results to MySQL-compatible [rows, fields] format
function executeSqliteQuery(db, sql, params = []) {
    let cleanSql = sql.trim();

    // MySQL compatibility: SHOW TABLES
    if (/^SHOW\s+TABLES\b/i.test(cleanSql)) {
        cleanSql = "SELECT name AS Tables_in_database FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'";
    }

    // MySQL compatibility: SHOW CREATE TABLE
    const showCreateMatch = cleanSql.match(/^SHOW\s+CREATE\s+TABLE\s+[`"]?([^`"\s]+)[`"]?/i);
    if (showCreateMatch) {
        const tableName = showCreateMatch[1];
        const row = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name = ?").get(tableName);
        const createSql = row ? row.sql : `CREATE TABLE "${tableName}" ()`;
        return [[{ "Table": tableName, "Create Table": createSql }], []];
    }

    // Normalize SQL query for SQLite compatibility
    cleanSql = cleanSql
        .replace(/\s+FOR\s+UPDATE/gi, "")
        .replace(/\bINSERT\s+IGNORE\b/gi, "INSERT OR IGNORE")
        .replace(/`([^`]+)`/g, '"$1"')
        .replace(/\bCURDATE\(\)/gi, "date('now')")
        .replace(/\bNOW\(\)/gi, "datetime('now')")
        .trim();

    // Handle DATE_ADD(..., INTERVAL X DAY)
    cleanSql = cleanSql.replace(/DATE_ADD\s*\(\s*([^,]+)\s*,\s*INTERVAL\s+(\d+)\s+DAY\s*\)/gi, "DATE_ADD($1, $2)");

    // Handle MySQL-style bulk insert: INSERT INTO ... VALUES ? where params is [[ [row1], [row2] ]]
    let safeParams = params;
    if (Array.isArray(params) && params.length === 1 && Array.isArray(params[0]) && Array.isArray(params[0][0])) {
        const rows = params[0];
        if (rows.length > 0) {
            const placeholders = rows.map(r => `(${r.map(() => "?").join(", ")})`).join(", ");
            cleanSql = cleanSql.replace(/\bVALUES\s*\?/i, `VALUES ${placeholders}`);
            safeParams = rows.flat();
        }
    }

    const isSelect = /^(SELECT|PRAGMA|EXPLAIN)\b/i.test(cleanSql);
    const isInsert = /^INSERT\b/i.test(cleanSql);

    // Format params for SQLite
    safeParams = safeParams.map(p => {
        if (p === undefined) return null;
        if (typeof p === "boolean") return p ? 1 : 0;
        return p;
    });

    const stmt = db.prepare(cleanSql);

    if (isSelect) {
        const rows = stmt.all(...safeParams);
        // SQLite returns raw objects; clone to standard Plain Old JS Object
        const plainRows = rows.map(r => Object.assign({}, r));
        return [plainRows, []];
    } else {
        const result = stmt.run(...safeParams);
        const mysqlResult = {
            insertId: isInsert ? Number(result.lastInsertRowid) : 0,
            affectedRows: Number(result.changes || 0),
            changedRows: Number(result.changes || 0),
        };
        return [mysqlResult, []];
    }
}

// Determine dialect
const requestedDialect = (process.env.DB_DIALECT || "auto").toLowerCase();

if (requestedDialect === "mysql") {
    try {
        const mysql = require("mysql2/promise");
        mysqlPool = mysql.createPool({
            host: process.env.DB_HOST || "127.0.0.1",
            port: parseInt(process.env.DB_PORT) || 3306,
            user: process.env.DB_USER || "library_admin",
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME || "library_hub",
            waitForConnections: true,
            connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
            queueLimit: 0,
            decimalNumbers: true,
            charset: "utf8mb4",
            timezone: "+00:00",
        });

        // Test MySQL connection
        mysqlPool.getConnection()
            .then(conn => {
                console.log("[DB] Connected to MySQL database successfully.");
                activeDialect = "mysql";
                conn.release();
            })
            .catch(err => {
                console.warn(`[DB] MySQL connection failed (${err.message}). Falling back to SQLite.`);
                activeDialect = "sqlite";
                sqliteDb = initSqlite();
            });
    } catch (err) {
        console.warn(`[DB] mysql2 failed to initialize (${err.message}). Using SQLite.`);
        activeDialect = "sqlite";
        sqliteDb = initSqlite();
    }
} else {
    activeDialect = "sqlite";
    sqliteDb = initSqlite();
    console.log(`[DB] Using standalone relational database (SQLite at ${SQLITE_FILE}).`);
}

// Universal Pool Interface
const pool = {
    get dialect() {
        return activeDialect;
    },

    async query(sql, params = []) {
        if (activeDialect === "mysql" && mysqlPool) {
            return mysqlPool.query(sql, params);
        }
        if (!sqliteDb) {
            sqliteDb = initSqlite();
        }
        return executeSqliteQuery(sqliteDb, sql, params);
    },

    async getConnection() {
        if (activeDialect === "mysql" && mysqlPool) {
            return mysqlPool.getConnection();
        }
        if (!sqliteDb) {
            sqliteDb = initSqlite();
        }

        let unlock = null;

        return {
            inTransaction: false,

            async beginTransaction() {
                if (!this.inTransaction) {
                    unlock = await acquireTransactionLock();
                    try {
                        sqliteDb.exec("BEGIN IMMEDIATE;");
                        this.inTransaction = true;
                    } catch (err) {
                        if (unlock) {
                            unlock();
                            unlock = null;
                        }
                        throw err;
                    }
                }
            },

            async commit() {
                if (this.inTransaction) {
                    try {
                        sqliteDb.exec("COMMIT;");
                    } finally {
                        this.inTransaction = false;
                        if (unlock) {
                            unlock();
                            unlock = null;
                        }
                    }
                }
            },

            async rollback() {
                if (this.inTransaction) {
                    try {
                        sqliteDb.exec("ROLLBACK;");
                    } catch (_) {
                    } finally {
                        this.inTransaction = false;
                        if (unlock) {
                            unlock();
                            unlock = null;
                        }
                    }
                }
            },

            async query(sql, params = []) {
                return executeSqliteQuery(sqliteDb, sql, params);
            },

            release() {
                if (this.inTransaction) {
                    try {
                        sqliteDb.exec("ROLLBACK;");
                    } catch (_) {
                    } finally {
                        this.inTransaction = false;
                        if (unlock) {
                            unlock();
                            unlock = null;
                        }
                    }
                }
            }
        };
    },

    // Migration helper to run multiple SQL statements
    async exec(sql) {
        if (activeDialect === "mysql" && mysqlPool) {
            return mysqlPool.query(sql);
        }
        if (!sqliteDb) {
            sqliteDb = initSqlite();
        }
        return sqliteDb.exec(sql);
    }
};

module.exports = pool;
