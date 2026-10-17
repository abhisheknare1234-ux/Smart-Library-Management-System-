/**
 * Centralized API & Service Layer for Library Management System.
 * Connects directly to the real Node/Express backend at http://localhost:5000/api.
 */

const API_BASE_URL = window.API_BASE_URL || "http://localhost:5000/api";

function getAuthToken() {
    return sessionStorage.getItem("token") || localStorage.getItem("token");
}

async function authFetch(path, options = {}) {
    const token = getAuthToken();
    const headers = Object.assign({ "Content-Type": "application/json" }, options.headers || {});
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE_URL}${path}`, Object.assign({}, options, { headers }));
    let data;
    try { data = await res.json(); } catch (_) { data = {}; }
    if (typeof data.success === "undefined") data.success = res.ok;
    return data;
}

const LibraryAPI = {
    async getMemberDashboard() {
        const token = getAuthToken();
        if (token) {
            try {
                const res = await authFetch("/stats/member");
                if (res.success && res.stats) {
                    return {
                        borrowedCount: Number(res.stats.borrowedCount || 0),
                        dueSoonCount: Number(res.stats.dueSoon || 0),
                        reservationsCount: Number(res.stats.activeReservations || 0),
                        pendingFineAmount: Number(res.stats.pendingFineAmount || 0),
                        unreadNotifications: Number(res.stats.unreadNotifications || 0)
                    };
                }
            } catch (err) {
                console.warn("API fallback:", err);
            }
        }
        return {
            borrowedCount: LibraryStore ? LibraryStore.getBorrowedBooks().length : 0,
            dueSoonCount: 0,
            reservationsCount: 0,
            pendingFineAmount: 0,
            unreadNotifications: 0
        };
    },

    async getBooks(category = "all", search = "") {
        try {
            let url = `/books?limit=50`;
            if (category && category !== "all") url += `&category=${encodeURIComponent(category)}`;
            if (search) url += `&search=${encodeURIComponent(search)}`;
            const res = await authFetch(url);
            if (res.success && Array.isArray(res.books)) {
                return res.books.map(b => ({
                    id: b.id,
                    title: b.title || b.name,
                    name: b.title || b.name,
                    author: b.author,
                    category: b.category,
                    publisher: b.publisher,
                    isbn: b.isbn,
                    quantity: b.quantity || b.totalCopies,
                    availableCopies: b.availableQuantity ?? b.availableCopies ?? 1,
                    rating: b.rating || 4.5,
                    description: b.description || ""
                }));
            }
        } catch (err) {
            console.warn("API fallback to local:", err);
        }
        return (typeof LibraryCatalog !== "undefined" ? LibraryCatalog.all() : []).map(book => ({
            ...book,
            availableCopies: typeof LibraryStore !== "undefined" ? LibraryStore.getAvailableCopies(book.id) : 1
        }));
    },

    async getBorrowedBooks() {
        try {
            const res = await authFetch("/issues/mine");
            if (res.success && Array.isArray(res.issues)) {
                return res.issues.map(i => ({
                    id: i.id,
                    bookId: i.bookId,
                    bookTitle: i.bookTitle,
                    author: i.bookAuthor,
                    borrowedDate: i.issueDate,
                    dueDate: i.dueDate,
                    renewals: i.renewals,
                    status: i.status,
                    fineAmount: i.fineAmount
                }));
            }
        } catch (err) {
            console.warn("API fallback:", err);
        }
        return typeof LibraryStore !== "undefined" ? LibraryStore.getBorrowedBooks() : [];
    },

    async renewBookAPI(loanId) {
        try {
            const res = await authFetch(`/issues/${loanId}/renew`, { method: "POST" });
            return res;
        } catch (err) {
            return typeof LibraryStore !== "undefined" ? LibraryStore.renewLoan(loanId) : { success: false };
        }
    },

    async createBorrowRequestAPI(bookId) {
        try {
            const res = await authFetch("/issues", {
                method: "POST",
                body: JSON.stringify({ bookId })
            });
            return res;
        } catch (err) {
            return typeof LibraryStore !== "undefined" ? LibraryStore.createBorrowRequest(bookId) : { success: false };
        }
    },

    async returnBookAPI(loanId) {
        try {
            const res = await authFetch(`/issues/${loanId}/return`, { method: "POST" });
            return res;
        } catch (err) {
            return typeof LibraryStore !== "undefined" ? LibraryStore.returnLoan(loanId) : { success: false };
        }
    },

    async getReservations() {
        try {
            const res = await authFetch("/reservations/mine");
            if (res.success && Array.isArray(res.reservations)) {
                return res.reservations;
            }
        } catch (err) {
            console.warn("Reservations API error:", err);
        }
        return typeof LibraryStore !== "undefined" ? LibraryStore.getReservations() : [];
    },

    async cancelReservationAPI(resId) {
        try {
            const res = await authFetch(`/reservations/${resId}/cancel`, { method: "PUT" });
            return res;
        } catch (err) {
            if (typeof LibraryStore !== "undefined") {
                LibraryStore.cancelReservation(resId);
                return { success: true };
            }
            return { success: false };
        }
    },

    async getFines() {
        try {
            const res = await authFetch("/fines/mine");
            if (res.success && Array.isArray(res.fines)) {
                return res.fines;
            }
        } catch (err) {
            console.warn("Fines API error:", err);
        }
        return typeof LibraryStore !== "undefined" ? LibraryStore.getFines() : [];
    }
};

// Global backward-compatible functions
async function getMemberDashboard() { return LibraryAPI.getMemberDashboard(); }
async function getBooks(cat, q) { return LibraryAPI.getBooks(cat, q); }
async function getBorrowedBooks() { return LibraryAPI.getBorrowedBooks(); }
async function renewBookAPI(id) { return LibraryAPI.renewBookAPI(id); }

window.LibraryAPI = LibraryAPI;