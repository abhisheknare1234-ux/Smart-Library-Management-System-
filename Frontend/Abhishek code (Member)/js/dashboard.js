// ==========================================================================
// Member Dashboard Script
// Real Backend API Integration, Personalized Greeting, Urgency Badges
// ==========================================================================

(function () {
    const API_BASE = "http://localhost:5000/api";

    function getToken() {
        return sessionStorage.getItem("token") || localStorage.getItem("token");
    }

    function getAuth() {
        try {
            return JSON.parse(localStorage.getItem("library_auth")) || null;
        } catch (_) {
            return null;
        }
    }

    function loanStatus(dueDateStr) {
        if (!dueDateStr) return "On Time";
        const dueMs = new Date(`${dueDateStr}T00:00:00`).getTime();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const days = Math.ceil((dueMs - today.getTime()) / 86400000);

        if (days < 0) return "Overdue";
        if (days <= 3) return "Due Soon";
        return "On Time";
    }

    function initGreeting() {
        const auth = getAuth();
        const name = auth ? (auth.fullName || auth.name || "Member") : "Member";

        const hour = new Date().getHours();
        let timeGreet = "Good morning";
        if (hour >= 12 && hour < 17) timeGreet = "Good afternoon";
        else if (hour >= 17) timeGreet = "Good evening";

        const greetEl = document.querySelector(".welcome-box h1, .dashboard-welcome h1, #memberGreeting");
        if (greetEl) {
            greetEl.innerHTML = `${timeGreet}, <span style="color: var(--color-primary);">${escapeHtml(name)}</span>`;
        }

        const profileName = document.querySelector(".profile-mini h4, .user-name");
        if (profileName) profileName.textContent = name;
    }

    async function renderDashboardStats() {
        const statCards = document.querySelectorAll(".stats-grid .stat-card h2");

        if (window.LibraryAPI && typeof window.LibraryAPI.getMemberDashboard === "function") {
            try {
                const stats = await window.LibraryAPI.getMemberDashboard();
                if (statCards.length >= 4) {
                    statCards[0].textContent = String(stats.borrowedCount || 0).padStart(2, "0");
                    statCards[1].textContent = String(stats.dueSoonCount || 0).padStart(2, "0");
                    statCards[2].textContent = String(stats.reservationsCount || 0).padStart(2, "0");
                    statCards[3].textContent = `₹${stats.pendingFineAmount || 0}`;
                }
                const countEl = document.getElementById("borrowedCount");
                if (countEl) countEl.textContent = String(stats.borrowedCount || 0).padStart(2, "0");
                return;
            } catch (err) {
                console.warn("Could not fetch member stats from API:", err);
            }
        }

        // Fallback to local
        if (typeof LibraryStore !== "undefined") {
            const loans = LibraryStore.getBorrowedBooks();
            const reservations = LibraryStore.getReservations().filter(r => ["Pending", "Ready"].includes(r.status));
            const pendingFines = LibraryStore.getFines().filter(f => f.status === "Pending");
            const totalFineSum = pendingFines.reduce((sum, f) => sum + (Number(f.amount) || 0), 0);
            const dueSoonCount = loans.filter(l => loanStatus(l.dueDate) === "Due Soon").length;

            if (statCards.length >= 4) {
                statCards[0].textContent = loans.length.toString().padStart(2, "0");
                statCards[1].textContent = dueSoonCount.toString().padStart(2, "0");
                statCards[2].textContent = reservations.length.toString().padStart(2, "0");
                statCards[3].textContent = `₹${totalFineSum}`;
            }
        }
    }

    async function renderBorrowedTable() {
        const table = document.getElementById("borrowedBooksTable");
        if (!table) return;

        let loans = [];
        if (window.LibraryAPI && typeof window.LibraryAPI.getBorrowedBooks === "function") {
            try {
                loans = await window.LibraryAPI.getBorrowedBooks();
            } catch (e) {
                console.warn("API loans fetch failed, trying local store:", e);
                loans = typeof LibraryStore !== "undefined" ? LibraryStore.getBorrowedBooks() : [];
            }
        } else if (typeof LibraryStore !== "undefined") {
            loans = LibraryStore.getBorrowedBooks();
        }

        if (!loans || !loans.length) {
            table.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; color: var(--color-text-muted); padding: 32px;">
                        <i class="fa-solid fa-book-open" style="font-size: 2rem; opacity: 0.4; margin-bottom: 8px; display: block;"></i>
                        No books currently borrowed. <a href="books.html" style="color: var(--color-primary); font-weight: 600;">Browse Catalog</a>
                    </td>
                </tr>
            `;
            return;
        }

        const isPage = /[\\/]pages[\\/]/.test(window.location.pathname) || /\/pages\//.test(window.location.pathname);
        const detailsPath = isPage ? "book-details.html" : "pages/book-details.html";

        table.innerHTML = loans.slice(0, 5).map(loan => {
            const state = loanStatus(loan.dueDate);
            const statusClass = state.toLowerCase().replace(" ", "-");
            const title = loan.bookTitle || loan.title || "Book Title";
            const author = loan.author || "Author";

            return `
            <tr>
                <td>
                    <div class="book-info" onclick="window.location.href='${detailsPath}?id=${encodeURIComponent(loan.bookId || loan.id)}'" style="cursor: pointer; display: flex; align-items: center; gap: 12px;">
                        <div class="book-cover" style="width: 36px; height: 48px; background: var(--color-primary-subtle); border-radius: 4px; display: flex; align-items: center; justify-content: center; color: var(--color-primary);">
                            <i class="fa-solid fa-book"></i>
                        </div>
                        <div>
                            <strong style="color: var(--color-text); font-size: 0.9rem; display: block;">${escapeHtml(title)}</strong>
                            <small style="color: var(--color-text-muted);">${escapeHtml(author)}</small>
                        </div>
                    </div>
                </td>
                <td>${formatDate(loan.borrowedDate || loan.issueDate)}</td>
                <td><strong>${formatDate(loan.dueDate)}</strong></td>
                <td><span class="status ${statusClass}">${state}</span></td>
                <td>
                    <button class="action-btn renew-btn" type="button" data-loan-id="${loan.id}" style="padding: 6px 12px; font-size: 0.8rem; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-sm); cursor: pointer;">
                        <i class="fa-solid fa-rotate-right"></i> Renew
                    </button>
                </td>
            </tr>`;
        }).join("");
    }

    async function renderRecommendedBooks() {
        const container = document.querySelector(".recommended-grid");
        if (!container) return;

        let books = [];
        if (window.LibraryAPI && typeof window.LibraryAPI.getBooks === "function") {
            try {
                books = await window.LibraryAPI.getBooks("all", "");
            } catch (_) {}
        }
        if (!books.length && typeof LibraryCatalog !== "undefined") {
            books = LibraryCatalog.all();
        }

        const isPage = /[\\/]pages[\\/]/.test(window.location.pathname) || /\/pages\//.test(window.location.pathname);
        const detailsPath = isPage ? "book-details.html" : "pages/book-details.html";

        const recs = books.slice(0, 3);
        container.innerHTML = recs.map(book => {
            const available = (book.availableCopies ?? book.availableQuantity ?? 1) > 0;
            const imgSrc = book.image || `../images/clean-code.jpeg`;

            return `
            <div class="book-card" style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 16px; display: flex; flex-direction: column;">
                <div class="book-card-cover" style="height: 160px; margin-bottom: 12px; overflow: hidden; border-radius: 6px; background: #e2e8f0; display: flex; align-items: center; justify-content: center;">
                    <img src="${imgSrc}" alt="${escapeHtml(book.title)}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.onerror=null;this.src='../images/clean-code.jpeg';">
                </div>
                <div class="book-card-content" style="flex: 1; display: flex; flex-direction: column;">
                    <h3 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 4px; color: var(--color-text);">${escapeHtml(book.title)}</h3>
                    <p style="font-size: 0.8rem; color: var(--color-text-muted); margin-bottom: 8px;">By ${escapeHtml(book.author || "Unknown")}</p>
                    <span class="status ${available ? "active" : "overdue"}" style="align-self: flex-start; margin-bottom: 12px;">
                        ${available ? "Available" : "Checked Out"}
                    </span>
                    <button class="secondary-btn" type="button" onclick="window.location.href='${detailsPath}?id=${encodeURIComponent(book.id)}'" style="margin-top: auto; padding: 8px; font-size: 0.82rem; font-weight: 600; border-radius: var(--radius-sm); background: var(--color-primary-subtle); color: var(--color-primary); border: 1px solid var(--color-primary-border); cursor: pointer;">
                        View Details
                    </button>
                </div>
            </div>`;
        }).join("");
    }

    function formatDate(val) {
        if (!val) return "—";
        const d = new Date(val);
        if (isNaN(d.getTime())) return val;
        return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    }

    function escapeHtml(str) {
        if (!str) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    document.addEventListener("DOMContentLoaded", async () => {
        initGreeting();
        await renderDashboardStats();
        await renderBorrowedTable();
        await renderRecommendedBooks();

        const table = document.getElementById("borrowedBooksTable");
        if (table) {
            table.addEventListener("click", async event => {
                const btn = event.target.closest("button[data-loan-id]");
                if (!btn) return;
                const loanId = btn.dataset.loanId;

                btn.disabled = true;
                btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`;

                try {
                    let res;
                    if (window.LibraryAPI && typeof window.LibraryAPI.renewBookAPI === "function") {
                        res = await window.LibraryAPI.renewBookAPI(loanId);
                    } else if (typeof LibraryStore !== "undefined") {
                        res = LibraryStore.renewLoan(loanId);
                    }

                    if (res && (res.success || res.ok)) {
                        if (typeof LibraryUI !== "undefined") {
                            LibraryUI.showToast("Book loan renewed successfully for 14 days.", "success");
                        } else {
                            alert("Book renewed successfully.");
                        }
                    } else {
                        const errMsg = res ? (res.message || "Cannot renew this loan.") : "Renewal failed.";
                        if (typeof LibraryUI !== "undefined") {
                            LibraryUI.showToast(errMsg, "warning");
                        } else {
                            alert(errMsg);
                        }
                    }

                    await renderDashboardStats();
                    await renderBorrowedTable();
                } catch (err) {
                    console.error("Renew error:", err);
                    if (typeof LibraryUI !== "undefined") {
                        LibraryUI.showToast("Network error renewing loan.", "error");
                    }
                } finally {
                    btn.disabled = false;
                    btn.innerHTML = `<i class="fa-solid fa-rotate-right"></i> Renew`;
                }
            });
        }
    });
}());
