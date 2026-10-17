const express = require("express");
const pool = require("../config/db");
const { requireAuth, requireRole } = require("../middleware/auth");
const { toDateOnly, sanitizeString, addDays } = require("../utils/helpers");
const { logAudit } = require("./auth");

const router = express.Router();

function mapReservation(row) {
    return {
        id: row.id,
        bookId: row.book_id,
        bookTitle: row.title,
        bookAuthor: row.author,
        bookImage: row.image_url,
        memberId: row.member_id,
        memberName: row.member_name,
        reservedDate: toDateOnly(row.reserved_date),
        status: row.status,
        queuePosition: row.queue_position,
        assignedCopyId: row.assigned_copy_id,
        readyDate: row.ready_date ? toDateOnly(row.ready_date) : null,
        expiryDate: row.expiry_date ? toDateOnly(row.expiry_date) : null,
    };
}

const BASE_SELECT = `
    SELECT r.*, b.title, b.author, b.image_url, m.name AS member_name
    FROM reservations r
    JOIN books b ON b.id = r.book_id
    JOIN members m ON m.id = r.member_id`;

// GET /api/reservations — Admin/Librarian
router.get("/", requireAuth, requireRole("Admin", "Librarian"), async (req, res) => {
    try {
        const { status } = req.query;
        let sql = BASE_SELECT;
        const params = [];
        if (status && status !== "all") {
            sql += " WHERE r.status = ?";
            params.push(status);
        }
        sql += " ORDER BY r.reserved_date DESC, r.id DESC";
        const [rows] = await pool.query(sql, params);
        res.json({ success: true, reservations: rows.map(mapReservation) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Failed to load reservations." });
    }
});

// GET /api/reservations/mine — Member
router.get("/mine", requireAuth, requireRole("Member"), async (req, res) => {
    try {
        const [rows] = await pool.query(
            BASE_SELECT + " WHERE r.member_id = ? ORDER BY r.reserved_date DESC, r.id DESC",
            [req.user.id]
        );
        res.json({ success: true, reservations: rows.map(mapReservation) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Failed to load your reservations." });
    }
});

// POST /api/reservations — Member reserves a book
router.post("/", requireAuth, requireRole("Member"), async (req, res) => {
    const bookId = sanitizeString(req.body.bookId);
    if (!bookId) return res.status(400).json({ success: false, message: "Book ID is required." });

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [books] = await conn.query("SELECT * FROM books WHERE id = ?", [bookId]);
        if (!books.length) {
            await conn.rollback();
            return res.status(404).json({ success: false, message: "Book not found." });
        }

        // Check active reservations (Pending or Ready)
        const [existing] = await conn.query(
            "SELECT id FROM reservations WHERE book_id = ? AND member_id = ? AND status IN ('Pending', 'Ready')",
            [bookId, req.user.id]
        );
        if (existing.length) {
            await conn.rollback();
            return res.status(409).json({ success: false, message: "You already have an active reservation for this book." });
        }

        // Check if member currently has this book borrowed
        const [activeLoan] = await conn.query(
            "SELECT id FROM issues WHERE book_id = ? AND member_id = ? AND status = 'Active'",
            [bookId, req.user.id]
        );
        if (activeLoan.length) {
            await conn.rollback();
            return res.status(409).json({ success: false, message: "You already have this book borrowed." });
        }

        // Calculate queue position
        const [queueCount] = await conn.query(
            "SELECT COUNT(*) as cnt FROM reservations WHERE book_id = ? AND status = 'Pending'",
            [bookId]
        );
        const queuePos = (queueCount[0].cnt || 0) + 1;

        const [result] = await conn.query(
            "INSERT INTO reservations (book_id, member_id, reserved_date, status, queue_position) VALUES (?, ?, CURDATE(), 'Pending', ?)",
            [bookId, req.user.id, queuePos]
        );

        await conn.commit();
        await logAudit("Member", req.user.id, "Book reserved", `${bookId} (Queue position: ${queuePos})`);

        res.status(201).json({
            success: true,
            message: `Reservation placed successfully! You are #${queuePos} in queue.`,
            id: result.insertId,
            reservationId: result.insertId,
            queuePosition: queuePos
        });
    } catch (err) {
        await conn.rollback();
        console.error(err);
        res.status(500).json({ success: false, message: "Failed to place reservation." });
    } finally {
        conn.release();
    }
});

// PUT /api/reservations/:id/cancel
router.put("/:id/cancel", requireAuth, async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const id = sanitizeString(req.params.id);

        await conn.beginTransaction();

        const [rows] = await conn.query("SELECT * FROM reservations WHERE id = ?", [id]);
        if (!rows.length) {
            await conn.rollback();
            return res.status(404).json({ success: false, message: "Reservation not found." });
        }
        const resv = rows[0];

        if (req.user.role === "Member" && req.user.id !== resv.member_id) {
            await conn.rollback();
            return res.status(403).json({ success: false, message: "You may only cancel your own reservations." });
        }

        if (resv.status === "Cancelled" || resv.status === "Fulfilled") {
            await conn.rollback();
            return res.status(409).json({ success: false, message: `Reservation is already ${resv.status}.` });
        }

        // If this reservation had an assigned copy waiting (Ready status), reassign or return it to available
        if (resv.assigned_copy_id) {
            // Check if another member is waiting in Pending
            const [nextInQueue] = await conn.query(
                "SELECT * FROM reservations WHERE book_id = ? AND status = 'Pending' ORDER BY queue_position ASC, reserved_date ASC LIMIT 1",
                [resv.book_id]
            );

            if (nextInQueue.length) {
                const nextResv = nextInQueue[0];
                const expiry = addDays(new Date(), 3);
                await conn.query(
                    "UPDATE reservations SET status = 'Ready', assigned_copy_id = ?, ready_date = CURDATE(), expiry_date = ? WHERE id = ?",
                    [resv.assigned_copy_id, toDateOnly(expiry), nextResv.id]
                );
                await conn.query(
                    "INSERT INTO notifications (member_id, icon, title, message) VALUES (?, 'fa-bell', 'Reserved Book Ready!', ?)",
                    [nextResv.member_id, `A copy of your reserved book has become available! Please collect it within 3 days.`]
                );
            } else {
                // Free the copy
                await conn.query("UPDATE book_copies SET status = 'AVAILABLE' WHERE id = ?", [resv.assigned_copy_id]);
                await conn.query("UPDATE books SET available_quantity = available_quantity + 1 WHERE id = ?", [resv.book_id]);
            }
        }

        await conn.query("UPDATE reservations SET status = 'Cancelled', assigned_copy_id = NULL WHERE id = ?", [id]);

        await conn.commit();
        await logAudit(req.user.role, req.user.id, "Reservation cancelled", `Reservation #${id}`);

        res.json({ success: true, message: "Reservation cancelled successfully." });
    } catch (err) {
        await conn.rollback();
        console.error(err);
        res.status(500).json({ success: false, message: "Failed to cancel reservation." });
    } finally {
        conn.release();
    }
});

// PUT /api/reservations/:id/ready — Admin/Librarian marks a copy ready for pickup
router.put("/:id/ready", requireAuth, requireRole("Admin", "Librarian"), async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const id = sanitizeString(req.params.id);

        await conn.beginTransaction();

        const [rows] = await conn.query("SELECT * FROM reservations WHERE id = ?", [id]);
        if (!rows.length) {
            await conn.rollback();
            return res.status(404).json({ success: false, message: "Reservation not found." });
        }
        const resv = rows[0];

        let assignedCopyId = resv.assigned_copy_id;
        if (!assignedCopyId) {
            const [availableCopies] = await conn.query(
                "SELECT id FROM book_copies WHERE book_id = ? AND status = 'AVAILABLE' LIMIT 1",
                [resv.book_id]
            );
            if (availableCopies.length) {
                assignedCopyId = availableCopies[0].id;
                await conn.query("UPDATE book_copies SET status = 'RESERVED' WHERE id = ?", [assignedCopyId]);
                await conn.query("UPDATE books SET available_quantity = MAX(0, available_quantity - 1) WHERE id = ?", [resv.book_id]);
            }
        }

        const expiryDate = addDays(new Date(), 3);
        await conn.query(
            "UPDATE reservations SET status = 'Ready', assigned_copy_id = ?, ready_date = CURDATE(), expiry_date = ? WHERE id = ?",
            [assignedCopyId, toDateOnly(expiryDate), id]
        );

        await conn.query(
            "INSERT INTO notifications (member_id, icon, title, message) VALUES (?, 'fa-bell', 'Reserved Book Ready!', ?)",
            [resv.member_id, "Your reserved book is ready for pickup at the circulation desk! Please collect within 3 days."]
        );

        await conn.commit();
        res.json({ success: true, message: "Reservation marked ready for pickup.", expiryDate: toDateOnly(expiryDate) });
    } catch (err) {
        await conn.rollback();
        console.error(err);
        res.status(500).json({ success: false, message: "Failed to update reservation." });
    } finally {
        conn.release();
    }
});

module.exports = router;
