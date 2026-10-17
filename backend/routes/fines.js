const express = require("express");
const pool = require("../config/db");
const { requireAuth, requireRole } = require("../middleware/auth");
const { toDateOnly, sanitizeString } = require("../utils/helpers");
const { logAudit } = require("./auth");

const router = express.Router();

function mapFine(row) {
    return {
        id: row.id,
        issueId: row.id,
        memberId: row.member_id,
        memberName: row.member_name,
        bookId: row.book_id,
        book: row.title,
        bookTitle: row.title,
        amount: Number(row.fine_amount || 0),
        status: row.fine_status,
        createdDate: toDateOnly(row.return_date || row.due_date),
        dueDate: toDateOnly(row.due_date),
        returnDate: row.return_date ? toDateOnly(row.return_date) : null,
    };
}

function mapPayment(row) {
    return {
        id: row.id,
        issueId: row.issue_id,
        memberId: row.member_id,
        memberName: row.member_name,
        bookTitle: row.book_title,
        amount: Number(row.amount || 0),
        paymentMethod: row.payment_method,
        transactionRef: row.transaction_ref,
        collectedBy: row.collected_by,
        createdAt: row.created_at,
    };
}

const BASE_FINES_SELECT = `
    SELECT i.*, b.title, m.name AS member_name
    FROM issues i
    JOIN books b ON b.id = i.book_id
    JOIN members m ON m.id = i.member_id
    WHERE i.fine_amount > 0`;

// GET /api/fines — Admin / Librarian
router.get("/", requireAuth, requireRole("Admin", "Librarian"), async (req, res) => {
    try {
        const { status, search } = req.query;
        let sql = BASE_FINES_SELECT;
        const params = [];

        if (status && status !== "all") {
            sql += " AND i.fine_status = ?";
            params.push(status);
        }
        if (search) {
            sql += " AND (m.name LIKE ? OR i.member_id LIKE ? OR b.title LIKE ?)";
            const like = `%${search}%`;
            params.push(like, like, like);
        }

        sql += " ORDER BY i.return_date DESC, i.due_date DESC";
        const [rows] = await pool.query(sql, params);
        res.json({ success: true, fines: rows.map(mapFine) });
    } catch (err) {
        console.error("Failed to load fines:", err);
        res.status(500).json({ success: false, message: "Failed to load fines." });
    }
});

// GET /api/fines/mine — Member
router.get("/mine", requireAuth, requireRole("Member"), async (req, res) => {
    try {
        const [rows] = await pool.query(
            BASE_FINES_SELECT + " AND i.member_id = ? ORDER BY i.return_date DESC, i.due_date DESC",
            [req.user.id]
        );
        res.json({ success: true, fines: rows.map(mapFine) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Failed to load your fines." });
    }
});

// GET /api/fines/payments — Payment Transaction History (Admin/Librarian)
router.get("/payments", requireAuth, requireRole("Admin", "Librarian"), async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT p.*, m.name AS member_name, b.title AS book_title
            FROM payments p
            JOIN members m ON m.id = p.member_id
            JOIN issues i ON i.id = p.issue_id
            JOIN books b ON b.id = i.book_id
            ORDER BY p.created_at DESC LIMIT 100
        `);
        res.json({ success: true, payments: rows.map(mapPayment) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Failed to load payment history." });
    }
});

// POST /api/fines/:issueId/pay — Pay fine
router.post("/:issueId/pay", requireAuth, async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const issueId = sanitizeString(req.params.issueId);
        const paymentMethod = sanitizeString(req.body.paymentMethod || "Cash");
        const transactionRef = req.body.transactionRef ? sanitizeString(req.body.transactionRef, 100) : `PAY-${Date.now()}`;

        // Idempotency Check: If transactionRef already exists, return existing receipt without double charging
        if (req.body.transactionRef) {
            const [existingPayment] = await pool.query(
                "SELECT * FROM payments WHERE transaction_ref = ?",
                [transactionRef]
            );
            if (existingPayment.length > 0) {
                const ep = existingPayment[0];
                return res.status(200).json({
                    success: true,
                    message: "Payment already processed (idempotent replay).",
                    isDuplicateReplay: true,
                    receipt: {
                        issueId: ep.issue_id,
                        amount: Number(ep.amount),
                        paymentMethod: ep.payment_method,
                        transactionRef: ep.transaction_ref,
                        paidAt: ep.created_at
                    }
                });
            }
        }

        await conn.beginTransaction();

        const [issues] = await conn.query("SELECT * FROM issues WHERE id = ? FOR UPDATE", [issueId]);
        if (!issues.length) {
            await conn.rollback();
            return res.status(404).json({ success: false, message: "Fine record not found." });
        }
        const issue = issues[0];

        // Authorization
        if (req.user.role === "Member" && req.user.id !== issue.member_id) {
            await conn.rollback();
            return res.status(403).json({ success: false, message: "You may only pay your own fines." });
        }

        if (issue.fine_status === "Paid") {
            await conn.rollback();
            return res.status(409).json({ success: false, message: "This fine has already been paid." });
        }
        if (Number(issue.fine_amount) <= 0) {
            await conn.rollback();
            return res.status(400).json({ success: false, message: "There is no outstanding fine on this record." });
        }

        // 1. Mark issue fine as Paid atomically
        const [fineUpd] = await conn.query(
            "UPDATE issues SET fine_status = 'Paid' WHERE id = ? AND fine_status != 'Paid'",
            [issueId]
        );
        if (fineUpd.affectedRows === 0) {
            await conn.rollback();
            return res.status(409).json({ success: false, message: "This fine has already been paid or is being processed." });
        }

        // 2. Create Payment Receipt in payments table
        const collectedBy = req.user.role === "Member" ? "Self (Online)" : `${req.user.role}:${req.user.name || req.user.id}`;
        await conn.query(
            `INSERT INTO payments (issue_id, member_id, amount, payment_method, transaction_ref, collected_by, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [issueId, issue.member_id, issue.fine_amount, paymentMethod, transactionRef, collectedBy, `Fine payment for loan #${issueId}`]
        );

        // 3. Notification to member
        await conn.query(
            "INSERT INTO notifications (member_id, icon, title, message) VALUES (?, 'fa-receipt', 'Payment Confirmed', ?)",
            [issue.member_id, `Payment of ₹${issue.fine_amount} received via ${paymentMethod} (Ref: ${transactionRef}). Thank you!`]
        );

        await conn.commit();
        await logAudit(req.user.role, req.user.id, "Fine paid", `₹${issue.fine_amount} for loan #${issueId} via ${paymentMethod} (Ref: ${transactionRef})`);

        res.json({
            success: true,
            message: "Fine marked as Paid Successfully!",
            receipt: {
                issueId,
                amount: Number(issue.fine_amount),
                paymentMethod,
                transactionRef
            }
        });
    } catch (err) {
        await conn.rollback();
        console.error("Fine payment error:", err);
        res.status(500).json({ success: false, message: "Failed to process fine payment." });
    } finally {
        conn.release();
    }
});

module.exports = router;
