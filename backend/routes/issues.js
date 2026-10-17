const express = require("express");
const pool = require("../config/db");
const { requireAuth, requireRole } = require("../middleware/auth");
const {
    DEFAULT_LOAN_DAYS,
    DEFAULT_FINE_PER_DAY,
    DEFAULT_MAX_BOOKS,
    DEFAULT_MAX_RENEWALS,
    getSetting,
    addDays,
    toDateOnly,
    calcFine,
    sanitizeString
} = require("../utils/helpers");
const { logAudit } = require("./auth");

const router = express.Router();

function mapIssue(row) {
    return {
        id: row.id,
        bookId: row.book_id,
        bookTitle: row.title,
        bookAuthor: row.author,
        bookImage: row.image_url,
        copyId: row.copy_id,
        barcode: row.barcode,
        copyNumber: row.copy_number,
        memberId: row.member_id,
        memberName: row.member_name,
        librarianId: row.librarian_id,
        issueDate: toDateOnly(row.issue_date),
        borrowedDate: toDateOnly(row.issue_date),
        dueDate: toDateOnly(row.due_date),
        returnDate: row.return_date ? toDateOnly(row.return_date) : null,
        returnedDate: row.return_date ? toDateOnly(row.return_date) : null,
        renewals: row.renewals,
        status: row.status,
        fineAmount: Number(row.fine_amount || 0),
        fineStatus: row.fine_status,
    };
}

const BASE_SELECT = `
    SELECT i.*, b.title, b.author, b.image_url, m.name AS member_name,
           c.barcode, c.copy_number
    FROM issues i
    JOIN books b ON b.id = i.book_id
    JOIN members m ON m.id = i.member_id
    LEFT JOIN book_copies c ON c.id = i.copy_id`;

// GET /api/issues — Admin/Librarian
router.get("/", requireAuth, requireRole("Admin", "Librarian"), async (req, res) => {
    try {
        const { status, memberId, bookId, search } = req.query;
        let sql = BASE_SELECT + " WHERE 1=1";
        const params = [];

        if (status && status !== "all") {
            sql += " AND i.status = ?";
            params.push(status);
        }
        if (memberId) {
            sql += " AND i.member_id = ?";
            params.push(memberId);
        }
        if (bookId) {
            sql += " AND i.book_id = ?";
            params.push(bookId);
        }
        if (search) {
            sql += " AND (b.title LIKE ? OR m.name LIKE ? OR i.member_id LIKE ? OR c.barcode LIKE ? OR i.id = ?)";
            const like = `%${search}%`;
            params.push(like, like, like, like, parseInt(search) || -1);
        }

        sql += " ORDER BY i.issue_date DESC, i.id DESC";
        const limitVal = req.query.limit !== undefined ? Math.min(500, Math.max(1, parseInt(req.query.limit) || 50)) : 100;
        const pageVal = Math.max(1, parseInt(req.query.page) || 1);
        sql += ` LIMIT ${limitVal} OFFSET ${(pageVal - 1) * limitVal}`;

        const [rows] = await pool.query(sql, params);
        res.json({ success: true, count: rows.length, page: pageVal, limit: limitVal, issues: rows.map(mapIssue) });
    } catch (err) {
        console.error("Failed to load issues:", err);
        res.status(500).json({ success: false, message: "Failed to load issued books." });
    }
});

// GET /api/issues/mine — Member's own active loans
router.get("/mine", requireAuth, requireRole("Member"), async (req, res) => {
    try {
        const [rows] = await pool.query(
            BASE_SELECT + " WHERE i.member_id = ? AND i.status = 'Active' ORDER BY i.due_date ASC",
            [req.user.id]
        );
        res.json({ success: true, issues: rows.map(mapIssue) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Failed to load your borrowed books." });
    }
});

// GET /api/issues/history/mine — Member's return history
router.get("/history/mine", requireAuth, requireRole("Member"), async (req, res) => {
    try {
        const [rows] = await pool.query(
            BASE_SELECT + " WHERE i.member_id = ? AND i.status = 'Returned' ORDER BY i.return_date DESC, i.id DESC",
            [req.user.id]
        );
        res.json({ success: true, history: rows.map(mapIssue) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Failed to load your history." });
    }
});

// POST /api/issues — Issue a book
router.post("/", requireAuth, async (req, res) => {
    const bookId = sanitizeString(req.body.bookId);
    let memberId = sanitizeString(req.body.memberId);
    const requestedCopyId = req.body.copyId ? sanitizeString(req.body.copyId) : null;

    if (!bookId) {
        return res.status(400).json({ success: false, message: "Book ID is required." });
    }

    // Role check & member target
    if (req.user.role === "Member") {
        memberId = req.user.id;
    } else if (!memberId) {
        return res.status(400).json({ success: false, message: "Member ID is required." });
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // 1. Verify Member eligibility
        const [members] = await conn.query("SELECT * FROM members WHERE id = ?", [memberId]);
        if (!members.length) {
            await conn.rollback();
            return res.status(404).json({ success: false, message: "Member not found." });
        }
        const member = members[0];
        if (member.status === "Inactive") {
            await conn.rollback();
            return res.status(403).json({ success: false, message: "This member account is deactivated." });
        }

        // 2. Check borrowing limit
        const maxBooks = Number(await getSetting(pool, "max_books_per_member", DEFAULT_MAX_BOOKS));
        const [activeCount] = await conn.query(
            "SELECT COUNT(*) AS c FROM issues WHERE member_id = ? AND status = 'Active'",
            [memberId]
        );
        if (activeCount[0].c >= maxBooks) {
            await conn.rollback();
            return res.status(409).json({ success: false, message: `Borrowing limit reached: maximum ${maxBooks} active loans allowed.` });
        }

        // 3. Check member does not already have an active loan for this book title
        const [alreadyBorrowed] = await conn.query(
            "SELECT id FROM issues WHERE book_id = ? AND member_id = ? AND status = 'Active'",
            [bookId, memberId]
        );
        if (alreadyBorrowed.length) {
            await conn.rollback();
            return res.status(409).json({ success: false, message: "This member already has an active loan for this book." });
        }

        // 4. Verify book catalog title
        const [books] = await conn.query("SELECT * FROM books WHERE id = ?", [bookId]);
        if (!books.length) {
            await conn.rollback();
            return res.status(404).json({ success: false, message: "Book not found." });
        }
        const book = books[0];

        // 5. Select & lock an AVAILABLE physical copy
        let copyToIssue = null;
        if (requestedCopyId) {
            const [copies] = await conn.query(
                "SELECT * FROM book_copies WHERE id = ? AND book_id = ? AND status = 'AVAILABLE' FOR UPDATE",
                [requestedCopyId, bookId]
            );
            if (!copies.length) {
                await conn.rollback();
                return res.status(409).json({ success: false, message: "Requested physical copy is not available." });
            }
            copyToIssue = copies[0];
        } else {
            // First check if this member had a RESERVED copy waiting for them
            const [reservedCopies] = await conn.query(
                `SELECT c.* FROM book_copies c
                 JOIN reservations r ON r.assigned_copy_id = c.id
                 WHERE r.book_id = ? AND r.member_id = ? AND r.status = 'Ready' LIMIT 1 FOR UPDATE`,
                [bookId, memberId]
            );

            if (reservedCopies.length) {
                copyToIssue = reservedCopies[0];
            } else {
                const [availableCopies] = await conn.query(
                    "SELECT * FROM book_copies WHERE book_id = ? AND status = 'AVAILABLE' ORDER BY copy_number ASC LIMIT 1 FOR UPDATE",
                    [bookId]
                );
                if (!availableCopies.length) {
                    await conn.rollback();
                    return res.status(409).json({ success: false, message: "All physical copies of this book are currently on loan or reserved. Try reserving it instead." });
                }
                copyToIssue = availableCopies[0];
            }
        }

        // 6. Calculate dates
        const loanDays = Number(await getSetting(pool, "loan_days", DEFAULT_LOAN_DAYS));
        const issueDate = new Date();
        const dueDate = addDays(issueDate, loanDays);
        const librarianId = req.user.role === "Librarian" ? req.user.id : null;

        // 7. Insert Issue Record
        const [issueResult] = await conn.query(
            `INSERT INTO issues (book_id, copy_id, member_id, librarian_id, issue_date, due_date, status)
             VALUES (?, ?, ?, ?, ?, ?, 'Active')`,
            [bookId, copyToIssue.id, memberId, librarianId, toDateOnly(issueDate), toDateOnly(dueDate)]
        );

        // 8. Atomically Update Copy Status with strict precondition check
        const [copyUpd] = await conn.query(
            "UPDATE book_copies SET status = 'ISSUED', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status IN ('AVAILABLE', 'RESERVED')",
            [copyToIssue.id]
        );
        if (copyUpd.affectedRows === 0) {
            await conn.rollback();
            return res.status(409).json({ success: false, message: "Physical copy is no longer available. Please retry." });
        }

        // 9. Update Book Available Quantity (only if it was AVAILABLE, not already deducted as RESERVED)
        if (copyToIssue.status === "AVAILABLE") {
            await conn.query("UPDATE books SET available_quantity = MAX(0, available_quantity - 1) WHERE id = ?", [bookId]);
        }

        // 10. If member had an active reservation for this book, fulfill it
        await conn.query(
            "UPDATE reservations SET status = 'Fulfilled' WHERE book_id = ? AND member_id = ? AND status IN ('Pending', 'Ready')",
            [bookId, memberId]
        );

        // 11. Create notification
        await conn.query(
            "INSERT INTO notifications (member_id, icon, title, message) VALUES (?, 'fa-book', 'Book Issued', ?)",
            [memberId, `"${book.title}" (Copy ${copyToIssue.id}) has been issued to you. Due date: ${toDateOnly(dueDate)}.`]
        );

        await conn.commit();
        await logAudit(req.user.role, req.user.id, "Book issued", `${bookId} (${copyToIssue.id}) -> ${memberId}`);

        res.status(201).json({
            success: true,
            message: "Book issued successfully!",
            issueId: issueResult.insertId,
            copyId: copyToIssue.id,
            dueDate: toDateOnly(dueDate)
        });
    } catch (err) {
        await conn.rollback();
        console.error("Issue book error:", err);
        res.status(500).json({ success: false, message: "Failed to issue book." });
    } finally {
        conn.release();
    }
});

// POST /api/issues/:id/return — Return book
router.post("/:id/return", requireAuth, async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [issues] = await conn.query("SELECT * FROM issues WHERE id = ?", [req.params.id]);
        if (!issues.length) {
            await conn.rollback();
            return res.status(404).json({ success: false, message: "Loan record not found." });
        }
        const issue = issues[0];

        if (issue.status !== "Active") {
            await conn.rollback();
            return res.status(409).json({ success: false, message: "This loan has already been returned." });
        }

        // Authorization: Member can only return their own loan
        if (req.user.role === "Member" && req.user.id !== issue.member_id) {
            await conn.rollback();
            return res.status(403).json({ success: false, message: "You may only return your own books." });
        }

        const returnDate = new Date();
        const finePerDay = Number(await getSetting(pool, "fine_per_day", DEFAULT_FINE_PER_DAY));
        const { overdueDays, fineAmount } = calcFine(issue.due_date, returnDate, finePerDay);
        const fineStatus = fineAmount > 0 ? "Pending" : "None";

        // 1. Update loan record
        await conn.query(
            `UPDATE issues SET status = 'Returned', return_date = ?, fine_amount = ?, fine_status = ? WHERE id = ?`,
            [toDateOnly(returnDate), fineAmount, fineStatus, req.params.id]
        );

        // 2. Fetch book title
        const [books] = await conn.query("SELECT title FROM books WHERE id = ?", [issue.book_id]);
        const bookTitle = books.length ? books[0].title : "Library Book";

        // 3. Handle physical copy & reservation fulfillment queue
        let copyReservedForMember = null;
        if (issue.copy_id) {
            // Check if there is a Pending reservation for this book
            const [pendingReservations] = await conn.query(
                "SELECT * FROM reservations WHERE book_id = ? AND status = 'Pending' ORDER BY queue_position ASC, reserved_date ASC LIMIT 1",
                [issue.book_id]
            );

            if (pendingReservations.length) {
                const resv = pendingReservations[0];
                copyReservedForMember = resv.member_id;

                // Mark copy as RESERVED for this reserving member
                await conn.query(
                    "UPDATE book_copies SET status = 'RESERVED', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                    [issue.copy_id]
                );

                // Update reservation status to Ready
                const expiryDate = addDays(new Date(), 3);
                await conn.query(
                    "UPDATE reservations SET status = 'Ready', assigned_copy_id = ?, ready_date = ?, expiry_date = ? WHERE id = ?",
                    [issue.copy_id, toDateOnly(new Date()), toDateOnly(expiryDate), resv.id]
                );

                // Send notification to reserving member
                await conn.query(
                    "INSERT INTO notifications (member_id, icon, title, message) VALUES (?, 'fa-bell', 'Reserved Book Ready!', ?)",
                    [resv.member_id, `Your reserved book "${bookTitle}" is ready for pickup! Please collect it by ${toDateOnly(expiryDate)}.`]
                );
            } else {
                // Return copy to AVAILABLE
                await conn.query(
                    "UPDATE book_copies SET status = 'AVAILABLE', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                    [issue.copy_id]
                );
                // Increment book available_quantity
                await conn.query(
                    "UPDATE books SET available_quantity = available_quantity + 1 WHERE id = ?",
                    [issue.book_id]
                );
            }
        } else {
            await conn.query(
                "UPDATE books SET available_quantity = available_quantity + 1 WHERE id = ?",
                [issue.book_id]
            );
        }

        // 4. Overdue Fine Notification
        if (fineAmount > 0) {
            await conn.query(
                "INSERT INTO notifications (member_id, icon, title, message) VALUES (?, 'fa-triangle-exclamation', 'Fine Incurred', ?)",
                [issue.member_id, `A fine of ₹${fineAmount} was incurred for returning "${bookTitle}" ${overdueDays} day(s) late.`]
            );
        }

        await conn.commit();
        await logAudit(req.user.role, req.user.id, "Book returned", `Loan #${req.params.id} (${issue.book_id})`);

        res.json({
            success: true,
            message: "Book returned successfully!",
            overdueDays,
            fineAmount,
            reservedForNextMember: !!copyReservedForMember
        });
    } catch (err) {
        await conn.rollback();
        console.error("Return book error:", err);
        res.status(500).json({ success: false, message: "Failed to return book." });
    } finally {
        conn.release();
    }
});

// POST /api/issues/:id/renew — Renew book
router.post("/:id/renew", requireAuth, async (req, res) => {
    try {
        const [issues] = await pool.query("SELECT * FROM issues WHERE id = ?", [req.params.id]);
        if (!issues.length) return res.status(404).json({ success: false, message: "Loan record not found." });
        const issue = issues[0];

        if (issue.status !== "Active") return res.status(409).json({ success: false, message: "Only active loans can be renewed." });

        // Authorization
        if (req.user.role === "Member" && req.user.id !== issue.member_id) {
            return res.status(403).json({ success: false, message: "You may only renew your own books." });
        }

        // Check renewal limit
        const maxRenewals = Number(await getSetting(pool, "max_renewals", DEFAULT_MAX_RENEWALS));
        if (issue.renewals >= maxRenewals) {
            return res.status(409).json({ success: false, message: `Renewal limit reached (maximum ${maxRenewals} renewals allowed).` });
        }

        // Check if other members have reserved this title
        const [pendingResv] = await pool.query(
            "SELECT id FROM reservations WHERE book_id = ? AND status = 'Pending' AND member_id != ?",
            [issue.book_id, issue.member_id]
        );
        if (pendingResv.length > 0) {
            return res.status(409).json({ success: false, message: "Cannot renew: other members have placed reservations for this book." });
        }

        // Check if book is already overdue
        const todayStr = toDateOnly(new Date());
        const dueDateStr = toDateOnly(issue.due_date);
        if (todayStr > dueDateStr) {
            return res.status(409).json({ 
                success: false, 
                message: "Cannot renew an overdue loan. Please return the book and clear any outstanding fines." 
            });
        }

        const loanDays = Number(await getSetting(pool, "loan_days", DEFAULT_LOAN_DAYS));
        const currentDue = new Date(toDateOnly(issue.due_date) + "T00:00:00");
        const newDue = addDays(currentDue, loanDays);

        await pool.query(
            "UPDATE issues SET due_date = ?, renewals = renewals + 1 WHERE id = ?",
            [toDateOnly(newDue), req.params.id]
        );

        await logAudit(req.user.role, req.user.id, "Book renewed", `Loan #${req.params.id}`);

        res.json({
            success: true,
            message: "Book renewed successfully!",
            dueDate: toDateOnly(newDue),
            renewalsRemaining: maxRenewals - (issue.renewals + 1)
        });
    } catch (err) {
        console.error("Renew error:", err);
        res.status(500).json({ success: false, message: "Failed to renew book." });
    }
});

module.exports = router;
