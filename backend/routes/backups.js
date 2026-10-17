const express = require("express");
const fs = require("fs");
const path = require("path");
const pool = require("../config/db");
const { requireAuth, requireRole } = require("../middleware/auth");
const { logAudit } = require("./auth");

const router = express.Router();
const BACKUP_DIR = path.join(__dirname, "..", "backups_files");
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

function mapBackup(row) {
    return { id: row.id, fileName: row.file_name, size: row.size_label, status: row.status, date: row.created_at };
}

// GET /api/backups — Admin only
router.get("/", requireAuth, requireRole("Admin"), async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM backups ORDER BY created_at DESC");
        res.json({ success: true, backups: rows.map(mapBackup) });
    } catch (err) {
        console.error("Failed to load backups:", err);
        res.status(500).json({ success: false, message: "Failed to load backups." });
    }
});

// POST /api/backups — Admin only, generates SQL dump compatible with SQLite and MySQL
router.post("/", requireAuth, requireRole("Admin"), async (req, res) => {
    const now = new Date();
    const stamp = now.toISOString().replace(/[:.]/g, "-");
    const fileName = `library_backup_${stamp}.sql`;
    const filePath = path.join(BACKUP_DIR, fileName);
    const id = "BK_" + Date.now();

    try {
        // Get all tables in a dialect-safe manner
        const [tables] = await pool.query("SHOW TABLES");
        const tableNames = tables
            .map(t => Object.values(t)[0])
            .filter(name => name && !name.startsWith("sqlite_") && name !== "backups");

        let sqlDump = `-- Library Hub Database Backup\n`;
        sqlDump += `-- Generated at: ${now.toISOString()}\n`;
        sqlDump += `-- Dialect: ${pool.dialect}\n\n`;

        // Disable foreign keys during import
        if (pool.dialect === "mysql") {
            sqlDump += `SET FOREIGN_KEY_CHECKS = 0;\n\n`;
        } else {
            sqlDump += `PRAGMA foreign_keys = OFF;\n\n`;
        }

        for (const tableName of tableNames) {
            // Get table structure
            const [createTable] = await pool.query(`SHOW CREATE TABLE \`${tableName}\``);
            const createSql = createTable[0] ? (createTable[0]["Create Table"] || Object.values(createTable[0])[1]) : null;

            if (createSql) {
                sqlDump += `--\n-- Table structure for table \`${tableName}\`\n--\n\n`;
                sqlDump += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;
                sqlDump += `${createSql};\n\n`;
            }

            // Get table data
            const [rows] = await pool.query(`SELECT * FROM \`${tableName}\``);
            if (rows.length > 0) {
                sqlDump += `--\n-- Dumping data for table \`${tableName}\`\n--\n\n`;
                const columns = Object.keys(rows[0]);
                const columnList = columns.map(c => `\`${c}\``).join(", ");

                // Batch inserts
                const batchSize = 100;
                for (let i = 0; i < rows.length; i += batchSize) {
                    const batch = rows.slice(i, i + batchSize);
                    const values = batch.map(row => {
                        const vals = columns.map(col => {
                            const val = row[col];
                            if (val === null || val === undefined) return "NULL";
                            if (typeof val === "number") return val;
                            if (typeof val === "boolean") return val ? 1 : 0;
                            if (val instanceof Date) return `'${val.toISOString().slice(0, 19).replace("T", " ")}'`;
                            return `'${String(val).replace(/'/g, "''").replace(/\\/g, "\\\\")}'`;
                        });
                        return `(${vals.join(", ")})`;
                    });
                    sqlDump += `INSERT INTO \`${tableName}\` (${columnList}) VALUES\n${values.join(",\n")};\n\n`;
                }
            }
        }

        // Re-enable foreign keys
        if (pool.dialect === "mysql") {
            sqlDump += `SET FOREIGN_KEY_CHECKS = 1;\n`;
        } else {
            sqlDump += `PRAGMA foreign_keys = ON;\n`;
        }

        fs.writeFileSync(filePath, sqlDump, "utf8");
        const sizeBytes = Buffer.byteLength(sqlDump, "utf8");
        const sizeLabel = sizeBytes < 1024 ? `${sizeBytes} B` : sizeBytes < 1024 * 1024 ? `${(sizeBytes / 1024).toFixed(1)} KB` : `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;

        await pool.query(
            "INSERT INTO backups (id, file_name, size_bytes, size_label, status, admin_id) VALUES (?,?,?,?,?,?)",
            [id, fileName, sizeBytes, sizeLabel, "Completed", req.user.id]
        );
        await logAudit("Admin", req.user.id, "Database backup created", fileName);

        res.status(201).json({
            success: true,
            message: "Backup Created Successfully!",
            backup: { id, fileName, size: sizeLabel, status: "Completed" },
        });
    } catch (err) {
        console.error("Backup error:", err);
        await pool.query(
            "INSERT INTO backups (id, file_name, size_bytes, size_label, status, admin_id) VALUES (?,?,?,?,?,?)",
            [id, fileName, 0, "0 B", "Failed", req.user.id]
        ).catch(() => {});
        res.status(500).json({ success: false, message: "Failed to create backup: " + err.message });
    }
});

// GET /api/backups/:id/download — Admin only
router.get("/:id/download", requireAuth, requireRole("Admin"), async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM backups WHERE id = ?", [req.params.id]);
        if (!rows.length) return res.status(404).json({ success: false, message: "Backup not found." });
        const filePath = path.join(BACKUP_DIR, rows[0].file_name);
        if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, message: "Backup file is no longer available on disk." });
        res.download(filePath);
    } catch (err) {
        console.error("Download error:", err);
        res.status(500).json({ success: false, message: "Failed to download backup." });
    }
});

// POST /api/backups/:id/restore — Admin only, restores database from specified backup
router.post("/:id/restore", requireAuth, requireRole("Admin"), async (req, res) => {
    const backupId = req.params.id;
    try {
        const [rows] = await pool.query("SELECT * FROM backups WHERE id = ?", [backupId]);
        if (!rows.length) return res.status(404).json({ success: false, message: "Backup record not found." });
        const backup = rows[0];
        const filePath = path.join(BACKUP_DIR, backup.file_name);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ success: false, message: `Backup file "${backup.file_name}" not found on disk.` });
        }

        const sqlContent = fs.readFileSync(filePath, "utf8");
        if (!sqlContent.includes("-- Library Hub Database Backup")) {
            return res.status(400).json({ success: false, message: "Invalid backup file signature." });
        }

        // Execute SQL script
        if (pool.dialect === "mysql") {
            const conn = await pool.getConnection();
            try {
                await conn.query("SET FOREIGN_KEY_CHECKS = 0;");
                // Split statements
                const statements = sqlContent
                    .split(/;\s*[\r\n]+/)
                    .map(s => s.trim())
                    .filter(s => s.length > 0 && !s.startsWith("--"));
                for (const stmt of statements) {
                    await conn.query(stmt);
                }
                await conn.query("SET FOREIGN_KEY_CHECKS = 1;");
            } finally {
                conn.release();
            }
        } else {
            // SQLite
            await pool.exec(sqlContent);
        }

        await logAudit("Admin", req.user.id, "Database restored", `Restored from ${backup.file_name}`);

        res.json({
            success: true,
            message: `Database successfully restored from backup "${backup.file_name}".`,
            restoredFrom: backup.file_name,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error("Restore error:", err);
        res.status(500).json({ success: false, message: "Failed to restore database: " + err.message });
    }
});

module.exports = router;
