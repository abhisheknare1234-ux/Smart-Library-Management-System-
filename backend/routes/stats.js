const express = require("express");
const pool = require("../config/db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

// GET /api/stats/public - unauthenticated high-level metrics for landing page
router.get("/public", async (req, res) => {
    try {
        const [
            [[bookStats]],
            [[{ totalMembers }]],
            [[{ totalIssued }]]
        ] = await Promise.all([
            pool.query("SELECT COALESCE(SUM(total_quantity),0) AS totalBooks, COALESCE(SUM(available_quantity),0) AS availableBooks FROM books"),
            pool.query("SELECT COUNT(*) AS totalMembers FROM members"),
            pool.query("SELECT COUNT(*) AS totalIssued FROM issues WHERE status='Active'")
        ]);
        res.json({
            success: true,
            stats: {
                totalBooks: Number(bookStats?.totalBooks || 0),
                availableBooks: Number(bookStats?.availableBooks || 0),
                totalMembers: Number(totalMembers || 0),
                totalIssued: Number(totalIssued || 0)
            }
        });
    } catch (err) {
        console.error("Public stats error:", err);
        res.status(500).json({ success: false, message: "Failed to load public stats." });
    }
});

// GET /api/stats/admin
router.get("/admin", requireAuth, requireRole("Admin"), async (req, res) => {
    try {
        const [
            [[bookStats]],
            [[{ totalMembers }]],
            [[{ totalLibrarians }]],
            [[issueStats]],
            [lastBackupRows]
        ] = await Promise.all([
            pool.query(`
                SELECT 
                    COALESCE(SUM(total_quantity),0) AS totalBooks,
                    COALESCE(SUM(available_quantity),0) AS availableBooks
                FROM books
            `),
            pool.query("SELECT COUNT(*) AS totalMembers FROM members"),
            pool.query("SELECT COUNT(*) AS totalLibrarians FROM librarians"),
            pool.query(`
                SELECT 
                    COUNT(CASE WHEN status='Active' THEN 1 END) AS issuedBooks,
                    COUNT(CASE WHEN status='Returned' THEN 1 END) AS returnedBooks,
                    COUNT(CASE WHEN status='Active' AND due_date < CURDATE() THEN 1 END) AS pendingReturns,
                    COALESCE(SUM(CASE WHEN fine_status='Paid' THEN fine_amount ELSE 0 END), 0) AS totalCollectedFines,
                    COALESCE(SUM(CASE WHEN fine_status='Pending' THEN fine_amount ELSE 0 END), 0) AS pendingFines,
                    COUNT(DISTINCT CASE WHEN fine_amount > 0 THEN member_id END) AS membersFinedCount
                FROM issues
            `),
            pool.query("SELECT created_at FROM backups ORDER BY created_at DESC LIMIT 1")
        ]);

        const lastBackup = lastBackupRows.length ? lastBackupRows[0] : null;

        res.json({
            success: true,
            stats: {
                totalBooks: Number(bookStats.totalBooks || 0),
                availableBooks: Number(bookStats.availableBooks || 0),
                totalMembers: Number(totalMembers || 0),
                totalLibrarians: Number(totalLibrarians || 0),
                issuedBooks: Number(issueStats.issuedBooks || 0),
                returnedBooks: Number(issueStats.returnedBooks || 0),
                pendingReturns: Number(issueStats.pendingReturns || 0),
                totalCollectedFines: Number(issueStats.totalCollectedFines || 0),
                pendingFines: Number(issueStats.pendingFines || 0),
                membersFinedCount: Number(issueStats.membersFinedCount || 0),
                lastBackupDate: lastBackup ? lastBackup.created_at : "None",
            },
        });
    } catch (err) {
        console.error("Admin stats error:", err);
        res.status(500).json({ success: false, message: "Failed to load statistics." });
    }
});

// GET /api/stats/librarian
router.get("/librarian", requireAuth, requireRole("Librarian", "Admin"), async (req, res) => {
    try {
        const [
            [[bookStats]],
            [[{ totalStudents }]],
            [[libIssueStats]],
            [recent]
        ] = await Promise.all([
            pool.query(`
                SELECT 
                    COALESCE(SUM(total_quantity),0) AS totalBooks,
                    COALESCE(SUM(available_quantity),0) AS availableBooks
                FROM books
            `),
            pool.query("SELECT COUNT(*) AS totalStudents FROM members"),
            pool.query(`
                SELECT 
                    COUNT(CASE WHEN issue_date = CURDATE() THEN 1 END) AS issuedToday,
                    COUNT(CASE WHEN status='Active' AND due_date = CURDATE() THEN 1 END) AS dueToday,
                    COUNT(CASE WHEN status='Active' AND due_date < CURDATE() THEN 1 END) AS overdue,
                    COALESCE(SUM(CASE WHEN fine_status='Pending' THEN fine_amount ELSE 0 END), 0) AS pendingFines
                FROM issues
            `),
            pool.query(`
                SELECT i.id, b.title, b.author, m.name AS member_name, i.issue_date, i.due_date, i.status
                FROM issues i JOIN books b ON b.id=i.book_id JOIN members m ON m.id=i.member_id
                ORDER BY i.issue_date DESC, i.id DESC LIMIT 10
            `)
        ]);

        res.json({
            success: true,
            stats: {
                totalBooks: Number(bookStats?.totalBooks || 0),
                availableBooks: Number(bookStats?.availableBooks || 0),
                totalStudents: Number(totalStudents || 0),
                issuedToday: Number(libIssueStats?.issuedToday || 0),
                dueToday: Number(libIssueStats?.dueToday || 0),
                overdue: Number(libIssueStats?.overdue || 0),
                pendingFines: Number(libIssueStats?.pendingFines || 0)
            },
            recentIssues: recent,
        });
    } catch (err) {
        console.error("Librarian stats error:", err);
        res.status(500).json({ success: false, message: "Failed to load statistics." });
    }
});

// GET /api/stats/member — the logged-in member's own dashboard stats
router.get("/member", requireAuth, requireRole("Member"), async (req, res) => {
    try {
        const [[{ borrowedCount }]] = await pool.query("SELECT COUNT(*) AS borrowedCount FROM issues WHERE member_id=? AND status='Active'", [req.user.id]);
        const [[{ dueSoon }]] = await pool.query(
            "SELECT COUNT(*) AS dueSoon FROM issues WHERE member_id=? AND status='Active' AND due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), 3)",
            [req.user.id]
        );
        const [[{ activeReservations }]] = await pool.query(
            "SELECT COUNT(*) AS activeReservations FROM reservations WHERE member_id=? AND status IN ('Pending','Ready')",
            [req.user.id]
        );
        const [[{ pendingFineTotal }]] = await pool.query(
            "SELECT COALESCE(SUM(fine_amount),0) AS pendingFineTotal FROM issues WHERE member_id=? AND fine_status='Pending'",
            [req.user.id]
        );
        res.json({
            success: true,
            stats: {
                borrowedCount: Number(borrowedCount),
                dueSoon: Number(dueSoon),
                activeReservations: Number(activeReservations),
                pendingFineTotal: Number(pendingFineTotal)
            },
        });
    } catch (err) {
        console.error("Member stats error:", err);
        res.status(500).json({ success: false, message: "Failed to load your dashboard." });
    }
});

module.exports = router;
