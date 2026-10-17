// ==========================================================================
// Member Borrowed Books Script
// Real Live Loans from Backend, Due Date Countdown, Renewals & Receipts
// ==========================================================================

(function () {
    let activeFilter = "all";
    let cachedLoans = [];

    function daysUntil(dueDateStr) {
        if (!dueDateStr) return 99;
        const dueMs = new Date(`${dueDateStr}T00:00:00`).getTime();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return Math.ceil((dueMs - today.getTime()) / 86400000);
    }

    function loanStatus(dueDateStr) {
        const days = daysUntil(dueDateStr);
        if (days < 0) return "Overdue";
        if (days <= 3) return "Due Soon";
        return "On Time";
    }

    async function loadLoans() {
        const container = document.getElementById("borrowedBooksList");
        const emptyState = document.getElementById("emptyState");

        if (window.LibraryAPI && typeof window.LibraryAPI.getBorrowedBooks === "function") {
            try {
                cachedLoans = await window.LibraryAPI.getBorrowedBooks();
            } catch (err) {
                console.warn("API loans fetch failed, falling back to local:", err);
                cachedLoans = typeof LibraryStore !== "undefined" ? LibraryStore.getBorrowedBooks() : [];
            }
        } else if (typeof LibraryStore !== "undefined") {
            cachedLoans = LibraryStore.getBorrowedBooks();
        }

        updateSummaryMetrics(cachedLoans);
        renderLoans();
    }

    function updateSummaryMetrics(loans) {
        const totalEl = document.getElementById("totalBorrowed");
        const dueSoonEl = document.getElementById("dueSoon");
        const onTimeEl = document.getElementById("onTime");

        let dueSoonCount = 0;
        let onTimeCount = 0;

        loans.forEach(l => {
            const status = loanStatus(l.dueDate);
            if (status === "Due Soon" || status === "Overdue") dueSoonCount++;
            else onTimeCount++;
        });

        if (totalEl) totalEl.textContent = loans.length;
        if (dueSoonEl) dueSoonEl.textContent = dueSoonCount;
        if (onTimeEl) onTimeEl.textContent = onTimeCount;
    }

    function renderLoans() {
        const container = document.getElementById("borrowedBooksList");
        const emptyState = document.getElementById("emptyState");
        const query = (document.getElementById("borrowSearch")?.value || "").trim().toLowerCase();
        if (!container) return;

        const visibleLoans = cachedLoans.filter(loan => {
            const title = (loan.bookTitle || loan.title || "").toLowerCase();
            const author = (loan.author || "").toLowerCase();
            const matchesQuery = !query || title.includes(query) || author.includes(query);

            const state = loanStatus(loan.dueDate);
            const matchesFilter = activeFilter === "all" ||
                (activeFilter === "due" && state === "Due Soon") ||
                (activeFilter === "overdue" && state === "Overdue");

            return matchesQuery && matchesFilter;
        });

        if (!visibleLoans.length) {
            container.innerHTML = "";
            if (emptyState) emptyState.style.display = "block";
            return;
        }

        if (emptyState) emptyState.style.display = "none";

        container.innerHTML = visibleLoans.map(loan => {
            const days = daysUntil(loan.dueDate);
            const state = loanStatus(loan.dueDate);
            const isOverdue = state === "Overdue";
            const isDueSoon = state === "Due Soon";

            let badgeClass = "status-badge active";
            let statusText = "On Time";
            let countdownText = `${days} days remaining`;

            if (isOverdue) {
                badgeClass = "status-badge overdue";
                statusText = "Overdue";
                countdownText = `${Math.abs(days)} days late`;
            } else if (isDueSoon) {
                badgeClass = "status-badge pending";
                statusText = "Due Soon";
                countdownText = days === 0 ? "Due today!" : `Due in ${days} day${days === 1 ? "" : "s"}`;
            }

            const title = loan.bookTitle || loan.title || "Book Title";
            const author = loan.author || "Unknown Author";
            const bookId = loan.bookId || loan.id;
            const imgSrc = loan.image || `../images/clean-code.jpeg`;

            return `
            <article class="borrowed-book-card" style="border-left: 4px solid ${isOverdue ? 'var(--color-danger)' : (isDueSoon ? 'var(--color-warning)' : 'var(--color-success)')};">
                <div class="book-mini-cover">
                    <img src="${imgSrc}" alt="${escapeHtml(title)}" onerror="this.onerror=null;this.src='../images/clean-code.jpeg';">
                </div>
                <div class="book-info">
                    <h3>${escapeHtml(title)}</h3>
                    <p>By ${escapeHtml(author)}</p>
                    <div class="book-dates">
                        <div class="date-item">
                            <span>Borrowed On</span>
                            <strong>${formatDate(loan.borrowedDate || loan.issueDate)}</strong>
                        </div>
                        <div class="date-item">
                            <span>Due Date</span>
                            <strong class="due-date" style="color: ${isOverdue ? 'var(--color-danger)' : (isDueSoon ? 'var(--color-warning-text)' : 'inherit')};">
                                ${formatDate(loan.dueDate)} (${countdownText})
                            </strong>
                        </div>
                    </div>
                </div>
                <div class="book-actions">
                    <span class="${badgeClass}">${statusText}</span>
                    <div class="action-buttons">
                        <button class="renew-btn" type="button" data-loan-id="${loan.id}">
                            <i class="fa-solid fa-rotate-right"></i> Renew Loan
                        </button>
                    </div>
                </div>
            </article>`;
        }).join("");

        // Bind Renew Buttons
        container.querySelectorAll(".renew-btn").forEach(btn => {
            btn.addEventListener("click", async () => {
                const loanId = btn.getAttribute("data-loan-id");
                btn.disabled = true;
                btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Renewing...`;

                try {
                    let res;
                    if (window.LibraryAPI && typeof window.LibraryAPI.renewBookAPI === "function") {
                        res = await window.LibraryAPI.renewBookAPI(loanId);
                    } else if (typeof LibraryStore !== "undefined") {
                        res = LibraryStore.renewLoan(loanId);
                    }

                    if (res && (res.success || res.ok)) {
                        LibraryUI.showToast("Loan renewed successfully for an additional 14 days.", "success");
                    } else {
                        const msg = res ? (res.message || "Could not renew loan.") : "Renewal limit reached.";
                        LibraryUI.showToast(msg, "warning");
                    }

                    await loadLoans();
                } catch (err) {
                    console.error("Renewal error:", err);
                    LibraryUI.showToast("Network error renewing loan.", "error");
                } finally {
                    btn.disabled = false;
                    btn.innerHTML = `<i class="fa-solid fa-rotate-right"></i> Renew Loan`;
                }
            });
        });
    }

    function setupFilters() {
        const tabs = document.querySelectorAll(".filter-tab");
        tabs.forEach(tab => {
            tab.addEventListener("click", () => {
                tabs.forEach(t => t.classList.remove("active"));
                tab.classList.add("active");
                activeFilter = tab.getAttribute("data-filter") || "all";
                renderLoans();
            });
        });

        const searchInput = document.getElementById("borrowSearch");
        if (searchInput) {
            searchInput.addEventListener("input", LibraryUI.debounce(() => {
                renderLoans();
            }, 250));
        }
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
        setupFilters();
        await loadLoans();
    });
}());
