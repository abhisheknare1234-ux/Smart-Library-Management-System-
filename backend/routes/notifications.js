const express = require("express");
const pool = require("../config/db");
const { requireAuth, requireRole } = require("../middleware/auth");
const { sanitizeString } = require("../utils/helpers");

const router = express.Router();

function mapNotif(row) {
    return {
        id: row.id,
        icon: row.icon,
        title: row.title,
        message: row.message,
        unread: !row.is_read,
        time: row.created_at,
    };
}

// GET /api/notifications/mine — Member
router.get("/mine", requireAuth, requireRole("Member"), async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM notifications WHERE member_id = ? ORDER BY created_at DESC LIMIT 50", [req.user.id]);
        res.json({ success: true, notifications: rows.map(mapNotif) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Failed to load notifications." });
    }
});

// GET /api/notifications/librarian — Librarian
router.get("/librarian", requireAuth, requireRole("Librarian"), async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM notifications WHERE librarian_id = ? ORDER BY created_at DESC LIMIT 50", [req.user.id]);
        res.json({ success: true, notifications: rows.map(mapNotif) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Failed to load notifications." });
    }
});

// GET /api/notifications/admin — Admin
router.get("/admin", requireAuth, requireRole("Admin"), async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM notifications WHERE admin_id = ? ORDER BY created_at DESC LIMIT 50", [req.user.id]);
        res.json({ success: true, notifications: rows.map(mapNotif) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Failed to load notifications." });
    }
});

// PUT /api/notifications/mark-all-read — Member
router.put("/mark-all-read", requireAuth, requireRole("Member"), async (req, res) => {
    try {
        await pool.query("UPDATE notifications SET is_read = 1 WHERE member_id = ?", [req.user.id]);
        res.json({ success: true, message: "All notifications marked as read." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Failed to update notifications." });
    }
});

// PUT /api/notifications/librarian/mark-all-read — Librarian
router.put("/librarian/mark-all-read", requireAuth, requireRole("Librarian"), async (req, res) => {
    try {
        await pool.query("UPDATE notifications SET is_read = 1 WHERE librarian_id = ?", [req.user.id]);
        res.json({ success: true, message: "All notifications marked as read." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Failed to update notifications." });
    }
});

// PUT /api/notifications/admin/mark-all-read — Admin
router.put("/admin/mark-all-read", requireAuth, requireRole("Admin"), async (req, res) => {
    try {
        await pool.query("UPDATE notifications SET is_read = 1 WHERE admin_id = ?", [req.user.id]);
        res.json({ success: true, message: "All notifications marked as read." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Failed to update notifications." });
    }
});

// POST /api/notifications/broadcast — Admin/Librarian sends an announcement to all members
router.post("/broadcast", requireAuth, requireRole("Admin", "Librarian"), async (req, res) => {
    try {
        const { title, message, icon, targetRoles } = req.body;
        if (!title || !message) return res.status(400).json({ success: false, message: "Title and message are required." });
        
        const safeTitle = sanitizeString(title, 150);
        const safeMessage = sanitizeString(message, 500);
        const safeIcon = icon ? sanitizeString(icon, 50) : "fa-circle-info";
        const roles = targetRoles || ["Member"]; // Default to members only

        async function insertBatch(rows) {
            if (!rows.length) return;
            if (pool.dialect === "mysql") {
                await pool.query("INSERT INTO notifications (member_id, librarian_id, admin_id, icon, title, message) VALUES ?", [rows]);
            } else {
                const placeholders = rows.map(() => "(?, ?, ?, ?, ?, ?)").join(", ");
                const params = rows.flat();
                await pool.query(`INSERT INTO notifications (member_id, librarian_id, admin_id, icon, title, message) VALUES ${placeholders}`, params);
            }
        }

        if (roles.includes("Member")) {
            const [members] = await pool.query("SELECT id FROM members WHERE status = 'Active'");
            if (members.length) {
                const values = members.map(m => [m.id, null, null, safeIcon, safeTitle, safeMessage]);
                await insertBatch(values);
                totalSent += members.length;
            }
        }

        if (roles.includes("Librarian")) {
            const [librarians] = await pool.query("SELECT id FROM librarians WHERE status = 'Active'");
            if (librarians.length) {
                const values = librarians.map(l => [null, l.id, null, safeIcon, safeTitle, safeMessage]);
                await insertBatch(values);
                totalSent += librarians.length;
            }
        }

        if (roles.includes("Admin")) {
            const [admins] = await pool.query("SELECT id FROM admins");
            if (admins.length) {
                const values = admins.map(a => [null, null, a.id, safeIcon, safeTitle, safeMessage]);
                await insertBatch(values);
                totalSent += admins.length;
            }
        }

        res.status(201).json({ success: true, message: `Announcement sent to ${totalSent} recipient(s).` });
    } catch (err) {
        console.error("Broadcast error:", err);
        res.status(500).json({ success: false, message: "Failed to send announcement." });
    }
});

module.exports = router;
