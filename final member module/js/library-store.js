/* Safe, member-scoped browser persistence for the Library Management System. */
(function () {
    const PREFIX = "library_user_";
    const INVENTORY_KEY = "library_catalog_inventory";
    const DAILY_FINE_RATE = 10; // ₹10 per day

    const safeRead = (k, fallback) => {
        try {
            const v = JSON.parse(localStorage.getItem(k));
            return v == null ? fallback : v;
        } catch (_) {
            return fallback;
        }
    };
    const safeWrite = (k, v) => localStorage.setItem(k, JSON.stringify(v));

    const todayISO = () => new Date().toISOString().slice(0, 10);
    const dateLabel = (val) => {
        if (!val) return "N/A";
        const d = new Date(val.includes("T") ? val : `${val}T00:00:00`);
        if (isNaN(d.getTime())) return val;
        return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    };

    const currentMemberId = () => {
        const auth = safeRead("library_auth", null);
        if (auth && typeof auth.memberId === "string" && auth.memberId.trim()) return auth.memberId.trim();
        const email = localStorage.getItem("memberEmail") || "demo-member@library.local";
        return `member-${email.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "demo-member"}`;
    };

    const key = (name) => `${PREFIX}${currentMemberId()}_${name}`;

    const inventory = () => {
        const stored = safeRead(INVENTORY_KEY, {});
        return stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
    };

    function updateInventory(bookId, delta) {
        const book = window.LibraryCatalog ? LibraryCatalog.getById(bookId) : null;
        if (!book) return false;
        const items = inventory();
        const current = Number.isInteger(items[bookId]) ? items[bookId] : book.availableCopies;
        items[bookId] = Math.max(0, Math.min(book.totalCopies, current + delta));
        safeWrite(INVENTORY_KEY, items);
        return true;
    }

    const defaultNotifications = [
        { id: "notif-1", icon: "fa-calendar-check", title: "Book Request Created", message: "Your borrow request for Clean Code was submitted.", time: "2 hours ago", read: false, createdAt: todayISO() },
        { id: "notif-2", icon: "fa-bookmark", title: "Reservation Confirmed", message: "Your reservation for Operating System Concepts is confirmed.", time: "Yesterday", read: false, createdAt: todayISO() },
        { id: "notif-3", icon: "fa-circle-info", title: "Library Announcement", message: "The digital library portal has been updated with new e-books.", time: "2 days ago", read: true, createdAt: todayISO() }
    ];

    const Store = {
        DAILY_FINE_RATE,
        safeRead,
        safeWrite,
        today: todayISO,
        dateLabel,
        currentMemberId,

        getAvailableCopies(bookId) {
            const book = window.LibraryCatalog ? LibraryCatalog.getById(bookId) : null;
            if (!book) return 0;
            const items = inventory();
            return Number.isInteger(items[bookId]) ? items[bookId] : book.availableCopies;
        },

        // --- BORROW REQUESTS (BUG-024 & BUG-025) ---
        getBorrowRequests() {
            const requests = safeRead(key("borrowRequests"), []);
            const now = new Date();
            let changed = false;

            const updated = requests.map(req => {
                if (req.status === "Pending") {
                    const expiry = new Date(req.expiryDateISO || req.expiryDate);
                    if (!isNaN(expiry.getTime()) && now > expiry) {
                        changed = true;
                        // Return reserved inventory copy
                        updateInventory(req.bookId, 1);
                        return { ...req, status: "Expired" };
                    }
                }
                return req;
            });

            if (changed) {
                safeWrite(key("borrowRequests"), updated);
            }
            return updated;
        },

        saveBorrowRequests(requests) {
            safeWrite(key("borrowRequests"), Array.isArray(requests) ? requests : []);
        },

        createBorrowRequest(bookId) {
            const book = LibraryCatalog.getById(bookId);
            if (!book) return { ok: false, message: "Book not found." };

            const loans = this.getBorrowedBooks();
            if (loans.some(l => l.bookId === bookId && l.status === "Active")) {
                return { ok: false, message: "You already have an active loan for this book." };
            }

            const requests = this.getBorrowRequests();
            if (requests.some(r => r.bookId === bookId && r.status === "Pending")) {
                return { ok: false, message: "You already have a pending borrow request for this book." };
            }

            if (this.getAvailableCopies(bookId) < 1) {
                return { ok: false, message: "This book is currently unavailable for borrowing." };
            }

            const createdAt = new Date();
            const expiry = new Date();
            expiry.setDate(expiry.getDate() + 3);

            const request = {
                id: `req-${Date.now()}-${bookId}`,
                bookId,
                memberId: currentMemberId(),
                requestCreatedAt: createdAt.toISOString(),
                requestDateISO: todayISO(),
                expiryDateISO: expiry.toISOString(),
                status: "Pending"
            };

            this.saveBorrowRequests([...requests, request]);
            updateInventory(bookId, -1); // Reserve book copy

            this.addNotification({
                icon: "fa-book-open",
                title: "Borrow Request Submitted",
                message: `Request for "${book.title}" submitted. Please collect within 3 days.`,
                time: "Just now"
            });

            return { ok: true, request };
        },

        collectBorrowRequest(requestId) {
            const requests = this.getBorrowRequests();
            const index = requests.findIndex(r => r.id === requestId && r.status === "Pending");
            if (index < 0) return { ok: false, message: "Pending request not found or expired." };

            const req = requests[index];
            const book = LibraryCatalog.getById(req.bookId);
            if (!book) return { ok: false, message: "Book not found." };

            requests[index] = { ...req, status: "Approved" };
            this.saveBorrowRequests(requests);

            const borrowedDate = todayISO();
            const due = new Date();
            due.setDate(due.getDate() + 14);

            const loan = {
                id: `loan-${Date.now()}-${req.bookId}`,
                bookId: req.bookId,
                memberId: currentMemberId(),
                borrowedDate,
                dueDate: due.toISOString().slice(0, 10),
                status: "Active",
                renewals: 0
            };

            const loans = this.getBorrowedBooks();
            this.saveBorrowedBooks([...loans, loan]);

            return { ok: true, loan };
        },

        cancelBorrowRequest(requestId) {
            const requests = this.getBorrowRequests();
            const index = requests.findIndex(r => r.id === requestId && r.status === "Pending");
            if (index < 0) return { ok: false, message: "Pending request not found." };

            const req = requests[index];
            requests[index] = { ...req, status: "Cancelled" };
            this.saveBorrowRequests(requests);
            updateInventory(req.bookId, 1); // Release reserved copy

            return { ok: true };
        },

        // --- BORROWED BOOKS (BUG-010, BUG-007) ---
        getBorrowedBooks() {
            const raw = safeRead(key("borrowedBooks"), null);
            if (raw === null) {
                // Initial migration or legacy key check
                const legacy = safeRead("borrowedBooks", []);
                if (Array.isArray(legacy) && legacy.length) {
                    const normalized = legacy.map(l => {
                        const book = LibraryCatalog.getByTitle(l.title) || LibraryCatalog.getById(l.id);
                        return book ? {
                            id: `loan-${Date.now()}-${book.id}`,
                            bookId: book.id,
                            memberId: currentMemberId(),
                            borrowedDate: l.borrowedDateISO || todayISO(),
                            dueDate: l.dueDateISO || todayISO(),
                            status: "Active",
                            renewals: 0
                        } : null;
                    }).filter(Boolean);
                    safeWrite(key("borrowedBooks"), normalized);
                    return normalized;
                }
                return [];
            }
            return Array.isArray(raw) ? raw : [];
        },

        saveBorrowedBooks(loans) {
            safeWrite(key("borrowedBooks"), Array.isArray(loans) ? loans : []);
        },

        renewLoan(loanId) {
            const loans = this.getBorrowedBooks();
            const index = loans.findIndex(l => l.id === loanId && l.status === "Active");
            if (index < 0) return { ok: false, message: "Active loan not found." };

            const loan = loans[index];
            if (loan.renewals >= 2) return { ok: false, message: "Maximum renewal limit (2 times) reached." };

            const baseDate = new Date(`${loan.dueDate < todayISO() ? todayISO() : loan.dueDate}T00:00:00`);
            baseDate.setDate(baseDate.getDate() + 14);

            loans[index] = {
                ...loan,
                dueDate: baseDate.toISOString().slice(0, 10),
                renewals: loan.renewals + 1
            };
            this.saveBorrowedBooks(loans);
            return { ok: true, loan: loans[index] };
        },

        returnLoan(loanId) {
            const loans = this.getBorrowedBooks();
            const loan = loans.find(l => l.id === loanId && l.status === "Active");
            if (!loan) return { ok: false, message: "Active loan not found." };

            const returnedDate = todayISO();
            const dueMs = new Date(`${loan.dueDate}T00:00:00`).getTime();
            const retMs = new Date(`${returnedDate}T00:00:00`).getTime();
            const overdueDays = Math.max(0, Math.ceil((retMs - dueMs) / 86400000));
            const fineAmount = overdueDays * DAILY_FINE_RATE;

            const book = LibraryCatalog.getById(loan.bookId);
            const historyItem = {
                id: `hist-${Date.now()}-${loan.bookId}`,
                bookId: loan.bookId,
                title: book ? book.title : "Library Book",
                author: book ? book.author : "Unknown Author",
                memberId: currentMemberId(),
                borrowedDate: loan.borrowedDate,
                returnedDate,
                status: "Returned",
                overdueDays,
                fineAmount
            };

            this.saveBorrowedBooks(loans.filter(l => l.id !== loanId));
            this.saveHistory([...this.getHistory(), historyItem]);
            updateInventory(loan.bookId, 1);

            if (fineAmount > 0) {
                const fines = this.getFines();
                fines.push({
                    id: `fine-${loanId}`,
                    loanId,
                    bookId: loan.bookId,
                    bookTitle: book ? book.title : "Library Book",
                    memberId: currentMemberId(),
                    reason: `Overdue return (${overdueDays} days late)`,
                    amount: fineAmount,
                    status: "Pending",
                    createdDate: returnedDate
                });
                this.saveFines(fines);
            }

            return { ok: true, historyItem };
        },

        // --- HISTORY (BUG-011) ---
        getHistory() {
            return safeRead(key("history"), []);
        },
        saveHistory(items) {
            safeWrite(key("history"), Array.isArray(items) ? items : []);
        },

        // --- RESERVATIONS (BUG-014) ---
        getReservations() {
            return safeRead(key("reservations"), []);
        },
        saveReservations(items) {
            safeWrite(key("reservations"), Array.isArray(items) ? items : []);
        },
        reserveBook(bookId) {
            const book = LibraryCatalog.getById(bookId);
            if (!book) return { ok: false, message: "Book not found." };

            const reservations = this.getReservations();
            if (reservations.some(r => r.bookId === bookId && ["Pending", "Ready"].includes(r.status))) {
                return { ok: false, message: "You already have an active reservation for this book." };
            }

            const reservation = {
                id: `res-${Date.now()}-${bookId}`,
                bookId,
                memberId: currentMemberId(),
                reservedDate: todayISO(),
                status: "Pending"
            };
            this.saveReservations([...reservations, reservation]);
            return { ok: true, reservation };
        },
        cancelReservation(id) {
            const reservations = this.getReservations().filter(r => r.id !== id);
            this.saveReservations(reservations);
            return { ok: true };
        },

        // --- FINES (BUG-012) ---
        getFines() {
            const fines = safeRead(key("fines"), []);
            // Check active loans for overdue fines dynamically
            const loans = this.getBorrowedBooks();
            const today = todayISO();
            let changed = false;

            loans.forEach(loan => {
                if (loan.dueDate < today) {
                    const dueMs = new Date(`${loan.dueDate}T00:00:00`).getTime();
                    const nowMs = new Date(`${today}T00:00:00`).getTime();
                    const overdueDays = Math.max(0, Math.ceil((nowMs - dueMs) / 86400000));
                    const amount = overdueDays * DAILY_FINE_RATE;

                    const existingIndex = fines.findIndex(f => f.loanId === loan.id && f.status === "Pending");
                    if (existingIndex >= 0) {
                        if (fines[existingIndex].amount !== amount) {
                            fines[existingIndex].amount = amount;
                            fines[existingIndex].reason = `Overdue book (${overdueDays} days late)`;
                            changed = true;
                        }
                    } else {
                        const book = LibraryCatalog.getById(loan.bookId);
                        fines.push({
                            id: `fine-loan-${loan.id}`,
                            loanId: loan.id,
                            bookId: loan.bookId,
                            bookTitle: book ? book.title : "Overdue Book",
                            reason: `Overdue book (${overdueDays} days late)`,
                            memberId: currentMemberId(),
                            amount,
                            status: "Pending",
                            createdDate: today
                        });
                        changed = true;
                    }
                }
            });

            if (changed) {
                safeWrite(key("fines"), fines);
            }
            return fines;
        },

        saveFines(items) {
            safeWrite(key("fines"), Array.isArray(items) ? items : []);
        },

        // --- NOTIFICATIONS (BUG-018 & BUG-021) ---
        getNotifications() {
            let notifs = safeRead(key("notifications"), null);
            if (!notifs) {
                notifs = defaultNotifications;
                safeWrite(key("notifications"), notifs);
            }
            return notifs;
        },

        saveNotifications(notifs) {
            safeWrite(key("notifications"), Array.isArray(notifs) ? notifs : []);
        },

        addNotification(n) {
            const list = this.getNotifications();
            list.unshift({
                id: `notif-${Date.now()}`,
                icon: n.icon || "fa-bell",
                title: n.title || "Notification",
                message: n.message || "",
                time: n.time || "Just now",
                read: false,
                createdAt: todayISO()
            });
            this.saveNotifications(list);
        },

        markNotificationAsRead(id) {
            const list = this.getNotifications().map(n => n.id === id ? { ...n, read: true } : n);
            this.saveNotifications(list);
        },

        markAllNotificationsAsRead() {
            const list = this.getNotifications().map(n => ({ ...n, read: true }));
            this.saveNotifications(list);
        },

        getUnreadNotificationCount() {
            return this.getNotifications().filter(n => !n.read).length;
        },

        // --- PROFILE (BUG-017) ---
        getProfile() {
            const stored = safeRead(key("profile"), null);
            if (stored && typeof stored === "object" && !Array.isArray(stored)) return stored;
            const auth = safeRead("library_auth", {});
            return {
                fullName: auth.fullName || "Akshay Member",
                email: auth.email || "akshay@example.com",
                phone: "+91 98765 43210",
                memberId: auth.memberId || currentMemberId(),
                membership: auth.membership || "Student Member",
                memberSince: auth.memberSince || "2025"
            };
        },

        saveProfile(p) {
            safeWrite(key("profile"), p && typeof p === "object" ? p : {});
        }
    };

    window.LibraryStore = Store;
}());
