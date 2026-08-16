/**
 * Centralized API & Service Layer for Library Management System.
 * Supports Spring Boot API integration with graceful fallback to LibraryStore.
 */

const API_BASE_URL = "http://localhost:8080/api";
const USE_REMOTE_API = false; // Set to true when backend Spring Boot API is running

const _log = (msg, err) => { if (USE_REMOTE_API) console.warn(msg, err); };

const LibraryAPI = {
    async getMemberDashboard() {
        if (USE_REMOTE_API) {
            try {
                const res = await fetch(`${API_BASE_URL}/member/dashboard`);
                if (!res.ok) throw new Error("Network response error");
                return await res.json();
            } catch (err) {
                _log("API fallback to local store:", err);
            }
        }
        return {
            borrowedCount: LibraryStore.getBorrowedBooks().length,
            dueSoonCount: LibraryStore.getBorrowedBooks().filter(l => {
                const diff = Math.ceil((new Date(`${l.dueDate}T00:00:00`) - new Date(`${LibraryStore.today()}T00:00:00`)) / 86400000);
                return diff >= 0 && diff <= 3;
            }).length,
            reservationsCount: LibraryStore.getReservations().filter(r => ["Pending", "Ready"].includes(r.status)).length,
            pendingFineAmount: LibraryStore.getFines().filter(f => f.status === "Pending").reduce((s, f) => s + (Number(f.amount) || 0), 0),
            unreadNotifications: LibraryStore.getUnreadNotificationCount()
        };
    },

    async getBooks() {
        if (USE_REMOTE_API) {
            try {
                const res = await fetch(`${API_BASE_URL}/books`);
                if (!res.ok) throw new Error("Failed to fetch books");
                return await res.json();
            } catch (err) {
                _log("API fallback to local store:", err);
            }
        }
        return LibraryCatalog.all().map(book => ({
            ...book,
            availableCopies: LibraryStore.getAvailableCopies(book.id)
        }));
    },

    async getBorrowedBooks() {
        if (USE_REMOTE_API) {
            try {
                const res = await fetch(`${API_BASE_URL}/member/borrowed-books`);
                if (!res.ok) throw new Error("Failed to fetch borrowed books");
                return await res.json();
            } catch (err) {
                _log("API fallback to local store:", err);
            }
        }
        return LibraryStore.getBorrowedBooks();
    },

    async renewBookAPI(loanId) {
        if (USE_REMOTE_API) {
            try {
                const res = await fetch(`${API_BASE_URL}/member/renew/${loanId}`, { method: "POST" });
                return await res.json();
            } catch (err) {
                _log("API fallback to local store:", err);
            }
        }
        return LibraryStore.renewLoan(loanId);
    },

    async createBorrowRequestAPI(bookId) {
        return LibraryStore.createBorrowRequest(bookId);
    },

    async returnBookAPI(loanId) {
        return LibraryStore.returnLoan(loanId);
    }
};

// Global backward-compatible functions
async function getMemberDashboard() { return LibraryAPI.getMemberDashboard(); }
async function getBooks() { return LibraryAPI.getBooks(); }
async function getBorrowedBooks() { return LibraryAPI.getBorrowedBooks(); }
async function renewBookAPI(id) { return LibraryAPI.renewBookAPI(id); }

window.LibraryAPI = LibraryAPI;