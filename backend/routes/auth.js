const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const pool = require("../config/db");
const { signToken, requireAuth } = require("../middleware/auth");
const { isValidEmail, isValidPhone, isValidName, nextId } = require("../utils/helpers");

const router = express.Router();

async function logAudit(actorRole, actorId, action, details = "") {
    try {
        await pool.query(
            "INSERT INTO audit_logs (actor_role, actor_id, action, details) VALUES (?,?,?,?)",
            [actorRole, actorId, action, details]
        );
    } catch (_) { /* auditing must never break the request */ }
}

// ---------------------------------------------------------------------
// POST /api/auth/login
// Body: { identifier, password, role }  role is optional: "Admin" | "Librarian" | "Member"
// ---------------------------------------------------------------------
router.post("/login", async (req, res) => {
    const { identifier, password, role } = req.body;
    if (!identifier || !password) {
        return res.status(400).json({ success: false, message: "Please enter both your login ID and password." });
    }
    const cleanRole = role ? (role.charAt(0).toUpperCase() + role.slice(1).toLowerCase()) : null;
    const id = String(identifier).trim().toLowerCase();

    try {
        // ---- Admin ----
        if (!cleanRole || cleanRole === "Admin") {
            const [rows] = await pool.query(
                "SELECT * FROM admins WHERE LOWER(username) = ? OR LOWER(email) = ? LIMIT 1",
                [id, id]
            );
            if (rows.length) {
                const admin = rows[0];
                const ok = await bcrypt.compare(password, admin.password_hash);
                if (ok) {
                    const token = signToken({ id: admin.id, role: "Admin", name: admin.username, email: admin.email });
                    await logAudit("Admin", admin.username, "Login");
                    return res.json({
                        success: true,
                        token,
                        user: { id: admin.id, username: admin.username, email: admin.email, role: "Admin" },
                    });
                }
                if (cleanRole === "Admin") return res.status(401).json({ success: false, message: "Invalid username or password." });
            }
        }

        // ---- Librarian ----
        if (!cleanRole || cleanRole === "Librarian") {
            const [rows] = await pool.query(
                "SELECT * FROM librarians WHERE LOWER(email) = ? OR LOWER(id) = ? LIMIT 1",
                [id, id]
            );
            if (rows.length) {
                const lib = rows[0];
                const ok = await bcrypt.compare(password, lib.password_hash);
                if (ok) {
                    if (lib.status === "Inactive") {
                        return res.status(403).json({ success: false, message: "Your librarian account has been deactivated. Contact the admin." });
                    }
                    const token = signToken({ id: lib.id, role: "Librarian", name: lib.name, email: lib.email });
                    await logAudit("Librarian", lib.id, "Login");
                    return res.json({
                        success: true,
                        token,
                        user: { id: lib.id, name: lib.name, email: lib.email, role: "Librarian" },
                    });
                }
                if (cleanRole === "Librarian") return res.status(401).json({ success: false, message: "Invalid email or password." });
            }
        }

        // ---- Member ----
        if (!cleanRole || cleanRole === "Member") {
            const [rows] = await pool.query(
                "SELECT * FROM members WHERE LOWER(email) = ? OR LOWER(id) = ? LIMIT 1",
                [id, id]
            );
            if (rows.length) {
                const member = rows[0];
                const ok = await bcrypt.compare(password, member.password_hash);
                if (ok) {
                    if (member.status === "Inactive") {
                        return res.status(403).json({ success: false, message: "Your membership is inactive. Contact the library." });
                    }
                    const token = signToken({ id: member.id, role: "Member", name: member.name, email: member.email });
                    await logAudit("Member", member.id, "Login");
                    return res.json({
                        success: true,
                        token,
                        user: {
                            id: member.id, name: member.name, email: member.email, phone: member.phone,
                            department: member.department, type: member.type, membership: member.membership,
                            memberSince: member.member_since, role: "Member",
                        },
                    });
                }
                if (cleanRole === "Member") return res.status(401).json({ success: false, message: "Invalid email or password." });
            }
        }

        return res.status(401).json({ success: false, message: "Invalid credentials. Please check your login details and try again." });
    } catch (err) {
        console.error("Login error:", err);
        return res.status(500).json({ success: false, message: "Server error while logging in." });
    }
});

// ---------------------------------------------------------------------
// POST /api/auth/register  (self-service member sign-up)
// ---------------------------------------------------------------------
router.post("/register", async (req, res) => {
    const { name, email, password, phone, department } = req.body;
    const cleanEmail = String(email || "").trim().toLowerCase();

    if (!isValidName(name)) return res.status(400).json({ success: false, message: "Please enter a valid full name." });
    if (!isValidEmail(cleanEmail)) return res.status(400).json({ success: false, message: "Please enter a valid email address." });
    if (!password || password.length < 6) return res.status(400).json({ success: false, message: "Password must be at least 6 characters." });
    if (phone && !isValidPhone(phone)) return res.status(400).json({ success: false, message: "Please enter a valid phone number." });

    try {
        const [existing] = await pool.query("SELECT id FROM members WHERE LOWER(email) = ?", [cleanEmail]);
        if (existing.length) {
            return res.status(409).json({ success: false, message: "An account with this email already exists." });
        }

        const newId = await nextId(pool, "members", "MEM", 3);
        const hash = await bcrypt.hash(password, 10);
        await pool.query(
            `INSERT INTO members (id, name, email, phone, department, type, password_hash)
             VALUES (?,?,?,?,?,?,?)`,
            [newId, String(name).trim(), cleanEmail, phone || null, department || null, "Student", hash]
        );

        const token = signToken({ id: newId, role: "Member", name: String(name).trim(), email: cleanEmail });
        await logAudit("Member", newId, "Registered");
        return res.status(201).json({
            success: true,
            token,
            user: { id: newId, name: String(name).trim(), email: cleanEmail, role: "Member" },
        });
    } catch (err) {
        console.error("Register error:", err);
        return res.status(500).json({ success: false, message: "Server error while registering." });
    }
});

// ---------------------------------------------------------------------
// GET /api/auth/me — Full Profile of logged-in user
// ---------------------------------------------------------------------
router.get("/me", requireAuth, async (req, res) => {
    try {
        if (req.user.role === "Admin") {
            const [rows] = await pool.query("SELECT id, username, email FROM admins WHERE id = ?", [req.user.id]);
            if (!rows.length) return res.status(404).json({ success: false, message: "Admin account not found." });
            return res.json({ success: true, user: { ...rows[0], role: "Admin", name: rows[0].username } });
        } else if (req.user.role === "Librarian") {
            const [rows] = await pool.query("SELECT id, name, email, phone, address, status FROM librarians WHERE id = ?", [req.user.id]);
            if (!rows.length) return res.status(404).json({ success: false, message: "Librarian account not found." });
            return res.json({ success: true, user: { ...rows[0], role: "Librarian" } });
        } else {
            const [rows] = await pool.query("SELECT id, name, email, phone, department, type, membership, member_since, status FROM members WHERE id = ?", [req.user.id]);
            if (!rows.length) return res.status(404).json({ success: false, message: "Member account not found." });
            const m = rows[0];
            return res.json({
                success: true,
                user: {
                    id: m.id,
                    name: m.name,
                    fullName: m.name,
                    email: m.email,
                    phone: m.phone || "",
                    department: m.department || "",
                    type: m.type,
                    membership: m.membership || "Student Member",
                    memberSince: m.member_since,
                    status: m.status,
                    role: "Member"
                }
            });
        }
    } catch (err) {
        console.error("Auth me error:", err);
        res.status(500).json({ success: false, message: "Server error fetching profile." });
    }
});

// ---------------------------------------------------------------------
// POST /api/auth/change-password
// ---------------------------------------------------------------------
router.post("/change-password", requireAuth, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ success: false, message: "New password must be at least 6 characters." });
    }
    const table = req.user.role === "Admin" ? "admins" : req.user.role === "Librarian" ? "librarians" : "members";

    try {
        const [rows] = await pool.query(`SELECT * FROM ${table} WHERE id = ?`, [req.user.id]);
        if (!rows.length) return res.status(404).json({ success: false, message: "Account not found." });

        const ok = await bcrypt.compare(currentPassword || "", rows[0].password_hash);
        if (!ok) return res.status(401).json({ success: false, message: "Current password is incorrect." });

        const hash = await bcrypt.hash(newPassword, 10);
        await pool.query(`UPDATE ${table} SET password_hash = ? WHERE id = ?`, [hash, req.user.id]);
        await logAudit(req.user.role, req.user.id, "Password changed");
        res.json({ success: true, message: "Password updated successfully." });
    } catch (err) {
        console.error("Change password error:", err);
        res.status(500).json({ success: false, message: "Server error while changing password." });
    }
});

// ---------------------------------------------------------------------
// POST /api/auth/forgot-password
// Body: { email, role }  role: "Admin" | "Librarian" | "Member"
// ---------------------------------------------------------------------
router.post("/forgot-password", async (req, res) => {
    const { email, role } = req.body;
    const cleanEmail = String(email || "").trim().toLowerCase();

    if (!isValidEmail(cleanEmail)) {
        return res.status(400).json({ success: false, message: "Please enter a valid email address." });
    }
    if (!role || !["Admin", "Librarian", "Member"].includes(role)) {
        return res.status(400).json({ success: false, message: "Role is required (Admin, Librarian, or Member)." });
    }

    try {
        let table, idColumn, emailColumn;
        if (role === "Admin") {
            table = "admins";
            idColumn = "id";
            emailColumn = "email";
        } else if (role === "Librarian") {
            table = "librarians";
            idColumn = "id";
            emailColumn = "email";
        } else {
            table = "members";
            idColumn = "id";
            emailColumn = "email";
        }

        const [rows] = await pool.query(`SELECT ${idColumn} FROM ${table} WHERE LOWER(${emailColumn}) = ?`, [cleanEmail]);
        if (!rows.length) {
            // Don't reveal if email exists - always return success for security
            return res.json({ success: true, message: "If an account with this email exists, a password reset link has been sent." });
        }

        const userId = rows[0][idColumn];
        const token = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        // Invalidate any existing unused tokens for this user
        await pool.query(
            "UPDATE password_resets SET used = 1 WHERE user_type = ? AND user_id = ? AND used = 0",
            [role, userId]
        );

        // Insert new reset token
        await pool.query(
            "INSERT INTO password_resets (user_type, user_id, token, expires_at) VALUES (?,?,?,?)",
            [role, userId, token, expiresAt]
        );

        // TODO: In production, send email with reset link
        // For development, log the token
        const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/reset-password.html?token=${token}&role=${role}`;
        console.log(`[DEV] Password reset for ${role} ${cleanEmail}: ${resetUrl}`);

        await logAudit(role, userId, "Password reset requested");

        res.json({ success: true, message: "If an account with this email exists, a password reset link has been sent.", demoResetUrl: process.env.NODE_ENV !== "production" ? resetUrl : undefined });
    } catch (err) {
        console.error("Forgot password error:", err);
        res.status(500).json({ success: false, message: "Server error while processing password reset request." });
    }
});

// ---------------------------------------------------------------------
// POST /api/auth/reset-password
// Body: { token, newPassword, role }
// ---------------------------------------------------------------------
router.post("/reset-password", async (req, res) => {
    const { token, newPassword, role } = req.body;

    if (!token || !newPassword || !role) {
        return res.status(400).json({ success: false, message: "Token, new password, and role are required." });
    }
    if (!["Admin", "Librarian", "Member"].includes(role)) {
        return res.status(400).json({ success: false, message: "Invalid role." });
    }
    if (newPassword.length < 6) {
        return res.status(400).json({ success: false, message: "New password must be at least 6 characters." });
    }

    try {
        const [rows] = await pool.query(
            "SELECT * FROM password_resets WHERE token = ? AND user_type = ? AND used = 0 AND expires_at > NOW()",
            [token, role]
        );
        if (!rows.length) {
            return res.status(400).json({ success: false, message: "Invalid or expired reset token." });
        }

        const reset = rows[0];
        let table, idColumn;
        if (role === "Admin") {
            table = "admins";
            idColumn = "id";
        } else if (role === "Librarian") {
            table = "librarians";
            idColumn = "id";
        } else {
            table = "members";
            idColumn = "id";
        }

        const hash = await bcrypt.hash(newPassword, 10);
        await pool.query(`UPDATE ${table} SET password_hash = ? WHERE ${idColumn} = ?`, [hash, reset.user_id]);
        await pool.query("UPDATE password_resets SET used = 1 WHERE id = ?", [reset.id]);

        await logAudit(role, reset.user_id, "Password reset completed");

        res.json({ success: true, message: "Password has been reset successfully. You can now log in with your new password." });
    } catch (err) {
        console.error("Reset password error:", err);
        res.status(500).json({ success: false, message: "Server error while resetting password." });
    }
});

module.exports = { router, logAudit };
