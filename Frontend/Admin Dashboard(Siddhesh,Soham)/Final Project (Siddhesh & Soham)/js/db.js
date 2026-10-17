/**
 * Smart Library Management System - API Client (js/db.js)
 * Connects to the real Library Hub backend (Node/Express + MySQL).
 * Exposed as `window.DB`. Session is a JWT stored in sessionStorage.
 */
(function (window) {
    const API_BASE = window.API_BASE_URL || "http://localhost:5000/api";
    const TOKEN_KEY = "token";
    const USER_KEY = "user";

    function getToken() {
        return sessionStorage.getItem(TOKEN_KEY);
    }

    function getUser() {
        const raw = sessionStorage.getItem(USER_KEY);
        return raw ? JSON.parse(raw) : null;
    }

    async function apiFetch(path, options = {}) {
        const token = getToken();
        const headers = Object.assign({ "Content-Type": "application/json" }, options.headers || {});
        if (token) headers["Authorization"] = "Bearer " + token;
        try {
            const res = await fetch(`${API_BASE}${path}`, Object.assign({}, options, { headers }));
            let data;
            try { data = await res.json(); } catch (_) { data = {}; }
            if (typeof data.success === "undefined") data.success = res.ok;
            return data;
        } catch (err) {
            console.error("Network error calling", path, err);
            return { success: false, message: "Could not reach the server. Please check your connection and that the backend is running." };
        }
    }

    // Maps backend book to admin dashboard shape
    function mapBook(b) {
        return { id: b.id, name: b.title, author: b.author, category: b.category, publisher: b.publisher, isbn: b.isbn, quantity: b.totalCopies, availableQuantity: b.availableQuantity };
    }

    // Maps backend member to admin dashboard shape
    function mapMember(m) {
        return { id: m.id, name: m.name, email: m.email, phone: m.phone, department: m.department || "", type: m.type || "Student", membership: m.membership, memberSince: m.member_since, status: m.status };
    }

    // Maps backend librarian to admin dashboard shape
    function mapLibrarian(l) {
        return { id: l.id, name: l.name, email: l.email, phone: l.phone, address: l.address, status: l.status };
    }

    // Maps backend fine to admin dashboard shape
    function mapFine(f) {
        return { id: f.issueId, memberId: f.memberId, memberName: f.memberName, book: f.book, amount: Number(f.amount), status: f.status, createdDate: f.createdDate };
    }

    // Maps backend backup to admin dashboard shape
    function mapBackup(b) {
        return { id: b.id, date: b.created_at ? new Date(b.created_at).toLocaleDateString("en-GB") : "N/A", fileName: b.file_name, size: b.size_label, status: b.status };
    }

    const DB = {
        // Authentication
        async login(username, password) {
            const res = await apiFetch("/auth/login", {
                method: "POST",
                body: JSON.stringify({ identifier: username, password, role: "Admin" }),
            });
            if (res.success) {
                sessionStorage.setItem(TOKEN_KEY, res.token);
                sessionStorage.setItem(USER_KEY, JSON.stringify(res.user));
                return { success: true, session: res.user };
            }
            return { success: false, message: res.message };
        },

        getCurrentSession() {
            const token = getToken();
            const user = getUser();
            if (!token || !user) return null;
            return user;
        },

        logout() {
            sessionStorage.removeItem(TOKEN_KEY);
            sessionStorage.removeItem(USER_KEY);
        },

        // Password reset - uses backend API
        async requestPasswordReset(email) {
            const cleanEmail = String(email).trim().toLowerCase();
            const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
            if (!re.test(cleanEmail)) {
                return { success: false, message: "Please enter a valid email address." };
            }
            const res = await apiFetch("/auth/forgot-password", {
                method: "POST",
                body: JSON.stringify({ email: cleanEmail, role: "Admin" }),
            });
            return res;
        },

        async resetPassword(email, token, newPassword) {
            const cleanEmail = String(email).trim().toLowerCase();
            const cleanToken = String(token).trim();
            if (!newPassword || newPassword.length < 6) {
                return { success: false, message: "Password must be at least 6 characters long." };
            }
            const res = await apiFetch("/auth/reset-password", {
                method: "POST",
                body: JSON.stringify({ email: cleanEmail, token: cleanToken, newPassword, role: "Admin" }),
            });
            return res;
        },

        // ================= BOOKS =================
        async getBooks() {
            const res = await apiFetch("/books");
            return res.success ? res.books.map(mapBook) : [];
        },

        async addBook(book) {
            return apiFetch("/books", {
                method: "POST",
                body: JSON.stringify({
                    id: book.id,
                    name: book.name,
                    author: book.author,
                    category: book.category,
                    publisher: book.publisher,
                    isbn: book.isbn,
                    quantity: Number(book.quantity)
                }),
            });
        },

        async updateBook(oldId, book) {
            return apiFetch(`/books/${encodeURIComponent(oldId)}`, {
                method: "PUT",
                body: JSON.stringify({
                    name: book.name,
                    author: book.author,
                    category: book.category,
                    publisher: book.publisher,
                    isbn: book.isbn,
                    quantity: Number(book.quantity)
                }),
            });
        },

        async deleteBook(id) {
            return apiFetch(`/books/${encodeURIComponent(id)}`, { method: "DELETE" });
        },

        // ================= LIBRARIANS =================
        async getLibrarians() {
            const res = await apiFetch("/librarians");
            return res.success ? res.librarians.map(mapLibrarian) : [];
        },

        async addLibrarian(lib) {
            return apiFetch("/librarians", {
                method: "POST",
                body: JSON.stringify({
                    id: lib.id,
                    name: lib.name,
                    email: lib.email,
                    phone: lib.phone,
                    address: lib.address,
                    password: lib.password
                }),
            });
        },

        async updateLibrarian(oldId, lib) {
            return apiFetch(`/librarians/${encodeURIComponent(oldId)}`, {
                method: "PUT",
                body: JSON.stringify({
                    name: lib.name,
                    email: lib.email,
                    phone: lib.phone,
                    address: lib.address,
                    status: lib.status,
                    password: lib.password
                }),
            });
        },

        async deleteLibrarian(id) {
            return apiFetch(`/librarians/${encodeURIComponent(id)}`, { method: "DELETE" });
        },

        // ================= MEMBERS =================
        async getMembers() {
            const res = await apiFetch("/members");
            return res.success ? res.members.map(mapMember) : [];
        },

        async addMember(member) {
            return apiFetch("/members", {
                method: "POST",
                body: JSON.stringify({
                    id: member.id,
                    name: member.name,
                    email: member.email,
                    phone: member.phone,
                    department: member.department,
                    type: member.type || "Student",
                    password: member.password || "member123"
                }),
            });
        },

        async updateMember(oldId, member) {
            return apiFetch(`/members/${encodeURIComponent(oldId)}`, {
                method: "PUT",
                body: JSON.stringify({
                    name: member.name,
                    email: member.email,
                    phone: member.phone,
                    department: member.department,
                    type: member.type
                }),
            });
        },

        async deleteMember(id) {
            return apiFetch(`/members/${encodeURIComponent(id)}`, { method: "DELETE" });
        },

        // ================= FINES =================
        async getFines() {
            const res = await apiFetch("/fines");
            return res.success ? res.fines.map(mapFine) : [];
        },

        async payFine(index) {
            // The backend uses issueId, not index
            return { success: false, message: "Use backend API directly for fine payment." };
        },

        // ================= BACKUPS =================
        async getBackups() {
            const res = await apiFetch("/backups");
            return res.success ? res.backups.map(mapBackup) : [];
        },

        async addBackupRecord(fileName, size = "3.0 MB") {
            const res = await apiFetch("/backups", { method: "POST" });
            if (res.success) return res.backup;
            return { success: false, message: res.message };
        },

        // ================= STATS & REPORTS =================
        async getStats() {
            const res = await apiFetch("/stats/admin");
            if (!res.success) {
                return {
                    totalBooks: 0, totalMembers: 0, totalLibrarians: 0,
                    issuedBooks: 0, returnedBooks: 0, pendingReturns: 0,
                    totalCollectedFines: 0, pendingFines: 0,
                    membersFinedCount: 0, lastBackupDate: "None"
                };
            }
            return res.stats;
        },

        // Validation helpers
        isValidEmail(email) {
            const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
            return re.test(String(email).trim().toLowerCase());
        },

        isValidPhone(phone) {
            const cleaned = String(phone).replace(/[\s\-\(\)\+]/g, "");
            return /^\d{7,15}$/.test(cleaned);
        },

        isValidName(name) {
            const trimmed = String(name).trim();
            return trimmed.length >= 2 && /^[a-zA-Z\s\.\'\-]+$/.test(trimmed);
        },

        sanitize(str) {
            if (typeof str !== "string") return str;
            return str
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        }
    };

    window.DB = DB;
})(window);