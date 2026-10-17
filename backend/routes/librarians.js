const express = require("express");
const bcrypt = require("bcryptjs");
const pool = require("../config/db");
const { requireAuth, requireRole } = require("../middleware/auth");
const { nextId, isValidEmail, isValidPhone, isValidName, sanitizeString } = require("../utils/helpers");
const { logAudit } = require("./auth");

const router = express.Router();

function mapLibrarian(row) {
    return { id: row.id, name: row.name, email: row.email, phone: row.phone, address: row.address, status: row.status };
}

function validateLibrarianInput(l, isUpdate = false) {
    const errors = [];
    const name = l.name;
    const email = l.email;
    const phone = l.phone;
    const address = l.address;
    const status = l.status;

    if (!isUpdate || name !== undefined) {
        if (!name || !String(name).trim()) {
            errors.push("Name is required.");
        } else if (!isValidName(name)) {
            errors.push("Please enter a valid full name (2+ characters, letters only).");
        }
    }
    if (!isUpdate || email !== undefined) {
        if (!email || !String(email).trim()) {
            errors.push("Email is required.");
        } else if (!isValidEmail(email)) {
            errors.push("Please enter a valid email address.");
        }
    }
    if (!isUpdate || phone !== undefined) {
        if (!phone || !String(phone).trim()) {
            errors.push("Phone number is required.");
        } else if (!isValidPhone(phone)) {
            errors.push("Please enter a valid phone number (7 to 15 digits).");
        }
    }
    if (address !== undefined && address !== null && String(address).trim().length > 255) {
        errors.push("Address must be 255 characters or less.");
    }
    if (status !== undefined && status !== null && !["Active", "Inactive"].includes(status)) {
        errors.push("Status must be 'Active' or 'Inactive'.");
    }
    return errors;
}

// GET /api/librarians/me — Librarian's own profile
router.get("/me", requireAuth, requireRole("Librarian", "Admin"), async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM librarians WHERE id = ?", [req.user.id]);
        if (!rows.length) return res.status(404).json({ success: false, message: "Librarian not found." });
        res.json({ success: true, librarian: mapLibrarian(rows[0]) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Failed to load profile." });
    }
});

// PUT /api/librarians/me — Librarian updates own profile
router.put("/me", requireAuth, requireRole("Librarian", "Admin"), async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM librarians WHERE id = ?", [req.user.id]);
        if (!rows.length) return res.status(404).json({ success: false, message: "Librarian not found." });
        const l = req.body;

        const errors = validateLibrarianInput(l, true);
        if (errors.length) return res.status(400).json({ success: false, message: errors.join(" ") });

        const name = sanitizeString(l.name || rows[0].name);
        const email = String(l.email || rows[0].email).trim().toLowerCase();
        const phone = sanitizeString(l.phone || rows[0].phone);
        const address = l.address !== undefined ? sanitizeString(l.address || null, 255) : rows[0].address;

        // Check for duplicates (excluding current librarian)
        const [dupEmail] = await pool.query("SELECT id FROM librarians WHERE LOWER(email) = ? AND id != ?", [email, req.user.id]);
        if (dupEmail.length) return res.status(409).json({ success: false, message: "Email address is already registered." });

        const [dupPhone] = await pool.query("SELECT id FROM librarians WHERE phone = ? AND id != ?", [phone, req.user.id]);
        if (dupPhone.length) return res.status(409).json({ success: false, message: "Phone number is already registered." });

        await pool.query(
            `UPDATE librarians SET name=?, email=?, phone=?, address=? WHERE id=?`,
            [name, email, phone, address, req.user.id]
        );
        await logAudit(req.user.role, req.user.id, "Profile updated");
        res.json({ success: true, message: "Profile updated successfully!" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Failed to update profile." });
    }
});

// GET /api/librarians — Admin only
router.get("/", requireAuth, requireRole("Admin"), async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM librarians ORDER BY created_at DESC");
        res.json({ success: true, librarians: rows.map(mapLibrarian) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Failed to load librarians." });
    }
});

// POST /api/librarians — Admin only
router.post("/", requireAuth, requireRole("Admin"), async (req, res) => {
    try {
        const l = req.body;
        const errors = validateLibrarianInput(l);
        if (errors.length) return res.status(400).json({ success: false, message: errors.join(" ") });

        const name = sanitizeString(l.name);
        const email = String(l.email || "").trim().toLowerCase();
        const phone = sanitizeString(l.phone);
        const address = sanitizeString(l.address || null, 255);

        const [existingEmail] = await pool.query("SELECT id FROM librarians WHERE LOWER(email) = ?", [email]);
        if (existingEmail.length) return res.status(409).json({ success: false, message: "A librarian with this email already exists." });

        const id = await nextId(pool, "librarians", "LIB", 3);
        const tempPassword = l.password && l.password.length >= 6 ? l.password : "librarian123";
        const hash = await bcrypt.hash(tempPassword, 10);

        await pool.query(
            `INSERT INTO librarians (id, name, email, phone, address, password_hash) VALUES (?,?,?,?,?,?)`,
            [id, name, email, phone, address, hash]
        );
        await logAudit("Admin", req.user.id, "Librarian added", id);
        res.status(201).json({ success: true, message: "Librarian Added Successfully!", id, temporaryPassword: tempPassword });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Failed to add librarian." });
    }
});

// PUT /api/librarians/:id — Admin only
router.put("/:id", requireAuth, requireRole("Admin"), async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM librarians WHERE id = ?", [req.params.id]);
        if (!rows.length) return res.status(404).json({ success: false, message: "Librarian not found." });
        const l = req.body;

        const errors = validateLibrarianInput(l, true);
        if (errors.length) return res.status(400).json({ success: false, message: errors.join(" ") });

        const name = sanitizeString(l.name || rows[0].name);
        const email = String(l.email || rows[0].email).trim().toLowerCase();
        const phone = sanitizeString(l.phone || rows[0].phone);
        const address = l.address !== undefined ? sanitizeString(l.address || null, 255) : rows[0].address;
        const status = l.status || rows[0].status;

        // Check for duplicates (excluding current librarian)
        const [dupEmail] = await pool.query("SELECT id FROM librarians WHERE LOWER(email) = ? AND id != ?", [email, req.params.id]);
        if (dupEmail.length) return res.status(409).json({ success: false, message: "Email address is already registered." });

        const [dupPhone] = await pool.query("SELECT id FROM librarians WHERE phone = ? AND id != ?", [phone, req.params.id]);
        if (dupPhone.length) return res.status(409).json({ success: false, message: "Phone number is already registered." });

        await pool.query(
            `UPDATE librarians SET name=?, email=?, phone=?, address=?, status=? WHERE id=?`,
            [name, email, phone, address, status, req.params.id]
        );
        await logAudit("Admin", req.user.id, "Librarian updated", req.params.id);
        res.json({ success: true, message: "Librarian Updated Successfully!" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Failed to update librarian." });
    }
});

// DELETE /api/librarians/:id — Admin only
router.delete("/:id", requireAuth, requireRole("Admin"), async (req, res) => {
    try {
        await pool.query("DELETE FROM librarians WHERE id = ?", [req.params.id]);
        await logAudit("Admin", req.user.id, "Librarian deleted", req.params.id);
        res.json({ success: true, message: "Librarian Deleted Successfully!" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Failed to delete librarian." });
    }
});

module.exports = router;
