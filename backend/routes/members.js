const express = require("express");
const bcrypt = require("bcryptjs");
const pool = require("../config/db");
const { requireAuth, requireRole } = require("../middleware/auth");
const { nextId, isValidEmail, isValidPhone, isValidName, sanitizeString, sanitizeHtml } = require("../utils/helpers");
const { logAudit } = require("./auth");

const router = express.Router();

const VALID_MEMBER_TYPES = ["Student", "Faculty", "General"];

function mapMember(row) {
    return {
        id: row.id,
        name: row.name,
        email: row.email,
        phone: row.phone,
        department: row.department,
        type: row.type,
        membership: row.membership,
        memberSince: row.member_since,
        status: row.status,
    };
}

function validateMemberInput(m, isUpdate = false) {
    const errors = [];
    const name = m.name;
    const email = m.email;
    const phone = m.phone;
    const type = m.type;
    const department = m.department;

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
    if (type !== undefined && type !== null && !VALID_MEMBER_TYPES.includes(type)) {
        errors.push(`Invalid member type. Must be one of: ${VALID_MEMBER_TYPES.join(", ")}.`);
    }
    if (department !== undefined && department !== null && String(department).trim().length > 100) {
        errors.push("Department must be 100 characters or less.");
    }
    return errors;
}

// GET /api/members  — Admin or Librarian
router.get("/", requireAuth, requireRole("Admin", "Librarian"), async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM members ORDER BY created_at DESC");
        res.json({ success: true, members: rows.map(mapMember) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Failed to load members." });
    }
});

// GET /api/members/:id/profile (or /api/members/me/profile)
router.get("/:id/profile", requireAuth, async (req, res) => {
    const targetId = req.params.id === "me" ? req.user.id : req.params.id;
    if (req.user.role === "Member" && req.user.id !== targetId) {
        return res.status(403).json({ success: false, message: "You can only view your own profile." });
    }
    try {
        const [rows] = await pool.query("SELECT * FROM members WHERE id = ?", [targetId]);
        if (!rows.length) return res.status(404).json({ success: false, message: "Member not found." });
        res.json({ success: true, member: mapMember(rows[0]), user: mapMember(rows[0]) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Failed to load profile." });
    }
});

// PUT /api/members/:id/profile (or /api/members/me/profile)
router.put("/:id/profile", requireAuth, async (req, res) => {
    const targetId = req.params.id === "me" ? req.user.id : req.params.id;
    if (req.user.role === "Member" && req.user.id !== targetId) {
        return res.status(403).json({ success: false, message: "You can only edit your own profile." });
    }
    try {
        const { name, phone } = req.body;
        const [rows] = await pool.query("SELECT * FROM members WHERE id = ?", [targetId]);
        if (!rows.length) return res.status(404).json({ success: false, message: "Member not found." });
        await pool.query("UPDATE members SET name = ?, phone = ? WHERE id = ?", [
            name ? String(name).trim() : rows[0].name,
            phone ? String(phone).trim() : rows[0].phone,
            targetId,
        ]);
        res.json({ success: true, message: "Profile updated successfully!" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Failed to update profile." });
    }
});

// POST /api/members  — Admin or Librarian creates a member (with a temp password)
router.post("/", requireAuth, requireRole("Admin", "Librarian"), async (req, res) => {
    try {
        const m = req.body;
        const errors = validateMemberInput(m);
        if (errors.length) return res.status(400).json({ success: false, message: errors.join(" ") });

        const name = sanitizeHtml(sanitizeString(m.name));
        const email = String(m.email || "").trim().toLowerCase();
        const phone = sanitizeString(m.phone);
        const type = m.type || "Student";
        const department = sanitizeHtml(sanitizeString(m.department || null, 100));

        const [existingEmail] = await pool.query("SELECT id FROM members WHERE LOWER(email) = ?", [email]);
        if (existingEmail.length) return res.status(409).json({ success: false, message: "A member with this email already exists." });

        let id = m.id && m.id.trim() ? m.id.trim() : await nextId(pool, "members", "MEM", 3);
        const [existingId] = await pool.query("SELECT id FROM members WHERE id = ?", [id]);
        if (existingId.length) return res.status(409).json({ success: false, message: `Member ID "${id}" already exists.` });

        const tempPassword = m.password && m.password.length >= 6 ? m.password : "member123";
        const hash = await bcrypt.hash(tempPassword, 10);

        await pool.query(
            `INSERT INTO members (id, name, email, phone, department, type, password_hash) VALUES (?,?,?,?,?,?,?)`,
            [id, name, email, phone, department, type, hash]
        );
        await logAudit(req.user.role, req.user.id, "Member added", id);
        res.status(201).json({ success: true, message: "Member Added Successfully!", id, temporaryPassword: tempPassword });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Failed to add member." });
    }
});

// PUT /api/members/:id  — Admin or Librarian
router.put("/:id", requireAuth, requireRole("Admin", "Librarian"), async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM members WHERE id = ?", [req.params.id]);
        if (!rows.length) return res.status(404).json({ success: false, message: "Member not found." });

        const m = req.body;
        const errors = validateMemberInput(m, true);
        if (errors.length) return res.status(400).json({ success: false, message: errors.join(" ") });

        const name = sanitizeString(m.name || rows[0].name);
        const email = String(m.email || rows[0].email).trim().toLowerCase();
        const phone = sanitizeString(m.phone || rows[0].phone);
        const type = m.type || rows[0].type;
        const department = m.department !== undefined ? sanitizeString(m.department || null, 100) : rows[0].department;

        await pool.query(
            `UPDATE members SET name=?, email=?, phone=?, department=?, type=? WHERE id=?`,
            [name, email, phone, department, type, req.params.id]
        );
        await logAudit(req.user.role, req.user.id, "Member updated", req.params.id);
        res.json({ success: true, message: "Member Updated Successfully!" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Failed to update member." });
    }
});

// DELETE /api/members/:id — Admin or Librarian
router.delete("/:id", requireAuth, requireRole("Admin", "Librarian"), async (req, res) => {
    try {
        const [active] = await pool.query("SELECT id FROM issues WHERE member_id = ? AND status = 'Active'", [req.params.id]);
        if (active.length) {
            return res.status(409).json({ success: false, message: "Cannot delete: this member has active book loans." });
        }
        await pool.query("DELETE FROM members WHERE id = ?", [req.params.id]);
        await logAudit(req.user.role, req.user.id, "Member deleted", req.params.id);
        res.json({ success: true, message: "Member Deleted Successfully!" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Failed to delete member." });
    }
});

module.exports = router;
