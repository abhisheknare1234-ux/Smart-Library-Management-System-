/**
 * Librarian Dashboard - API Client (js/api-client.js)
 * Connects to the real Library Hub backend.
 * Exposed as `window.LibAPI`.
 */
(function (window) {
    const API_BASE = window.LIBRARY_API_BASE || "http://localhost:5000/api";
    const SESSION_KEY = "librarian_session";

    function getSession() {
        const raw = sessionStorage.getItem(SESSION_KEY);
        if (raw) {
            try { return JSON.parse(raw); } catch (_) {}
        }
        const userRaw = sessionStorage.getItem("user");
        const token = sessionStorage.getItem("token");
        if (token && userRaw) {
            try {
                const u = JSON.parse(userRaw);
                return { ...u, token };
            } catch (_) {}
        }
        return null;
    }

    function getToken() {
        const s = getSession();
        if (s && s.token) return s.token;
        return sessionStorage.getItem("token") || null;
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

    function mapBook(b) {
        return {
            id: b.id,
            name: b.title || b.name,
            title: b.title || b.name,
            author: b.author,
            category: b.category,
            publisher: b.publisher || "",
            isbn: b.isbn || "",
            quantity: b.availableCopies !== undefined ? b.availableCopies : b.totalCopies,
            availableCopies: b.availableCopies !== undefined ? b.availableCopies : b.quantity,
            totalQuantity: b.totalCopies !== undefined ? b.totalCopies : b.quantity,
            location: b.location || "Main Library",
            shelf: b.shelf || "A-101"
        };
    }

    function mapStudent(m) {
        return {
            id: m.id,
            name: m.name,
            course: m.department || "General",
            department: m.department || "General",
            year: m.type || "Student",
            type: m.type || "Student",
            phone: m.phone || "",
            email: m.email || "",
            status: m.status || "Active"
        };
    }

    function mapIssue(i) {
        return {
            issueId: i.id,
            id: i.id,
            studentId: i.memberId,
            memberId: i.memberId,
            studentName: i.memberName,
            memberName: i.memberName,
            bookId: i.bookId,
            bookName: i.bookTitle,
            bookTitle: i.bookTitle,
            copyId: i.copyId,
            barcode: i.barcode,
            copyNumber: i.copyNumber,
            issueDate: i.issueDate || i.borrowedDate,
            returnDate: i.dueDate,
            dueDate: i.dueDate,
            actualReturnDate: i.returnDate,
            status: i.status === "Active" ? "Issued" : i.status,
            fine: i.fineAmount || 0,
            fineAmount: i.fineAmount || 0,
            fineStatus: i.fineStatus || "None"
        };
    }

    function mapFine(f) {
        return {
            fineId: f.issueId || f.id,
            issueId: f.issueId || f.id,
            studentId: f.memberId,
            memberId: f.memberId,
            studentName: f.memberName,
            memberName: f.memberName,
            bookId: f.bookId,
            bookName: f.book || f.bookTitle,
            book: f.book || f.bookTitle,
            fineAmount: Number(f.amount || f.fineAmount || 0),
            amount: Number(f.amount || f.fineAmount || 0),
            status: f.status || "Pending",
            createdDate: f.createdDate || f.dueDate,
            dueDate: f.dueDate,
        };
    }

    const LibAPI = {
        SESSION_KEY,
        getSession,
        getToken,
        isLoggedIn() { return !!getToken(); },

        async login(identifier, password) {
            const res = await apiFetch("/auth/login", {
                method: "POST",
                body: JSON.stringify({ identifier, password, role: "Librarian" }),
            });
            if (res.success) {
                const sessionObj = {
                    id: res.user.id,
                    name: res.user.name,
                    email: res.user.email,
                    role: "Librarian",
                    token: res.token,
                };
                sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionObj));
                sessionStorage.setItem("token", res.token);
                sessionStorage.setItem("user", JSON.stringify(res.user));
            }
            return res;
        },

        logout() {
            sessionStorage.removeItem(SESSION_KEY);
            sessionStorage.removeItem("token");
            sessionStorage.removeItem("user");
        },

        // ---- Books ----
        async getBooks() {
            const res = await apiFetch("/books");
            return res.success ? (res.books || []).map(mapBook) : [];
        },
        async addBook(book) {
            return apiFetch("/books", {
                method: "POST",
                body: JSON.stringify({
                    id: book.id,
                    name: book.name || book.title,
                    author: book.author,
                    category: book.category,
                    isbn: book.isbn,
                    publisher: book.publisher,
                    quantity: Number(book.quantity || 1)
                }),
            });
        },
        async updateBook(id, book) {
            return apiFetch(`/books/${encodeURIComponent(id)}`, {
                method: "PUT",
                body: JSON.stringify({
                    name: book.name || book.title,
                    author: book.author,
                    category: book.category,
                    isbn: book.isbn,
                    publisher: book.publisher,
                    quantity: Number(book.quantity)
                }),
            });
        },
        async deleteBook(id) {
            return apiFetch(`/books/${encodeURIComponent(id)}`, { method: "DELETE" });
        },

        // ---- Students / Members ----
        async getStudents() {
            const res = await apiFetch("/members");
            return res.success ? (res.members || []).map(mapStudent) : [];
        },
        async addStudent(student) {
            return apiFetch("/members", {
                method: "POST",
                body: JSON.stringify({
                    id: student.id,
                    name: student.name,
                    email: student.email,
                    phone: student.phone,
                    department: student.course || student.department,
                    type: student.year || student.type || "Student"
                }),
            });
        },
        async updateStudent(id, student) {
            return apiFetch(`/members/${encodeURIComponent(id)}`, {
                method: "PUT",
                body: JSON.stringify({
                    name: student.name,
                    email: student.email,
                    phone: student.phone,
                    department: student.course || student.department,
                    type: student.year || student.type || "Student"
                }),
            });
        },
        async deleteStudent(id) {
            return apiFetch(`/members/${encodeURIComponent(id)}`, { method: "DELETE" });
        },

        // ---- Issues (borrow/return) ----
        async getIssues(status = "") {
            const query = status ? `?status=${encodeURIComponent(status)}` : "";
            const res = await apiFetch(`/issues${query}`);
            return res.success ? (res.issues || []).map(mapIssue) : [];
        },
        async issueBook(bookId, memberId, copyId = null) {
            return apiFetch("/issues", {
                method: "POST",
                body: JSON.stringify({ bookId, memberId, copyId })
            });
        },
        async returnBook(issueId) {
            return apiFetch(`/issues/${encodeURIComponent(issueId)}/return`, { method: "POST" });
        },
        async renewBook(issueId) {
            return apiFetch(`/issues/${encodeURIComponent(issueId)}/renew`, { method: "POST" });
        },

        // ---- Fines ----
        async getFines(status = "") {
            const query = status ? `?status=${encodeURIComponent(status)}` : "";
            const res = await apiFetch(`/fines${query}`);
            return res.success ? (res.fines || []).map(mapFine) : [];
        },
        async payFine(issueId, paymentMethod = "Cash") {
            return apiFetch(`/fines/${encodeURIComponent(issueId)}/pay`, {
                method: "POST",
                body: JSON.stringify({ paymentMethod })
            });
        },

        // ---- Dashboard Stats & Reports ----
        async getStats() {
            const res = await apiFetch("/stats/librarian");
            return res.success ? res.stats : {
                totalBooks: 0,
                availableBooks: 0,
                totalStudents: 0,
                issuedToday: 0,
                dueToday: 0,
                overdue: 0,
                pendingFines: 0
            };
        },
        async getRecentIssues() {
            const res = await apiFetch("/stats/librarian");
            return res.success ? (res.recentIssues || []) : [];
        },

        // ---- Library Settings ----
        async getSettings() {
            const res = await apiFetch("/settings");
            return res.success ? (res.settings || {}) : {};
        },
        async updateSettings(settings) {
            return apiFetch("/settings", {
                method: "PUT",
                body: JSON.stringify(settings)
            });
        },

        // ---- Profile ----
        async getMyProfile() {
            return apiFetch("/librarians/me");
        },
        async updateMyProfile(name, phone, address = "") {
            const res = await apiFetch("/librarians/me", {
                method: "PUT",
                body: JSON.stringify({ name, phone, address })
            });
            if (res.success) {
                const session = getSession();
                if (session) {
                    session.name = name || session.name;
                    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
                    sessionStorage.setItem("user", JSON.stringify(session));
                }
            }
            return res;
        },
    };

    window.LibAPI = LibAPI;
})(window);
