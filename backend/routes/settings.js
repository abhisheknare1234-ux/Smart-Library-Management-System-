const express = require("express");
const pool = require("../config/db");
const { requireAuth, requireRole } = require("../middleware/auth");
const { sanitizeString } = require("../utils/helpers");
const { logAudit } = require("./auth");

const router = express.Router();

// GET /api/settings — View library settings
router.get("/", async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM library_settings");
        const settingsMap = {};
        for (const row of rows) {
            settingsMap[row.setting_key] = row.setting_value;
        }

        res.json({
            success: true,
            settings: settingsMap,
            details: rows
        });
    } catch (err) {
        console.error("Failed to load settings:", err);
        res.status(500).json({ success: false, message: "Failed to load library settings." });
    }
});

// PUT /api/settings — Admin or Librarian updates library settings
router.put("/", requireAuth, requireRole("Admin", "Librarian"), async (req, res) => {
    try {
        const body = req.body || {};
        const allowedKeys = [
            "library_name",
            "library_address",
            "library_contact",
            "library_email",
            "fine_per_day",
            "loan_days",
            "max_books_per_member",
            "max_renewals"
        ];

        let updatedCount = 0;
        for (const key of allowedKeys) {
            if (body[key] !== undefined) {
                const val = String(body[key]).trim();
                const [existing] = await pool.query("SELECT setting_key FROM library_settings WHERE setting_key = ?", [key]);
                if (existing.length) {
                    await pool.query(
                        "UPDATE library_settings SET setting_value = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ? WHERE setting_key = ?",
                        [val, req.user.name || req.user.id, key]
                    );
                } else {
                    await pool.query(
                        "INSERT INTO library_settings (setting_key, setting_value, updated_by) VALUES (?, ?, ?)",
                        [key, val, req.user.name || req.user.id]
                    );
                }
                updatedCount++;
            }
        }

        await logAudit(req.user.role, req.user.id, "Updated settings", `Updated ${updatedCount} settings`);

        // Return updated settings
        const [rows] = await pool.query("SELECT * FROM library_settings");
        const settingsMap = {};
        for (const row of rows) {
            settingsMap[row.setting_key] = row.setting_value;
        }

        res.json({
            success: true,
            message: "Library settings updated successfully!",
            settings: settingsMap
        });
    } catch (err) {
        console.error("Failed to update settings:", err);
        res.status(500).json({ success: false, message: "Failed to update library settings." });
    }
});

module.exports = router;
