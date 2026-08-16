(function () {
    let activeFilter = "all";

    function daysUntil(dueDateStr) {
        if (!dueDateStr) return 99;
        const dueMs = new Date(`${dueDateStr}T00:00:00`).getTime();
        const todayMs = new Date(`${LibraryStore.today()}T00:00:00`).getTime();
        return Math.ceil((dueMs - todayMs) / 86400000);
    }

    function loanStatus(loan) {
        const days = daysUntil(loan.dueDate);
        if (days < 0) return "Overdue";
        if (days <= 3) return "Due Soon";
        return "On Time";
    }

    function renderLoans() {
        const loans = LibraryStore.getBorrowedBooks();
        const requests = LibraryStore.getBorrowRequests();
        const query = (document.getElementById("borrowSearch")?.value || "").trim().toLowerCase();

        const container = document.getElementById("borrowedBooksList");
        const emptyState = document.getElementById("emptyState");
        if (!container) return;

        // Filter active loans
        const visibleLoans = loans.filter(loan => {
            const book = LibraryCatalog.getById(loan.bookId);
            if (!book) return false;
            const matchesQuery = !query || book.title.toLowerCase().includes(query) || book.author.toLowerCase().includes(query);
            const state = loanStatus(loan);
            const matchesFilter = activeFilter === "all" ||
                (activeFilter === "due" && state === "Due Soon") ||
                (activeFilter === "overdue" && state === "Overdue");
            return matchesQuery && matchesFilter;
        });

        // Filter requests
        const visibleRequests = requests.filter(req => {
            const book = LibraryCatalog.getById(req.bookId);
            if (!book) return false;
            return !query || book.title.toLowerCase().includes(query) || book.author.toLowerCase().includes(query);
        });

        // Build DocumentFragment for performance and safety
        const frag = document.createDocumentFragment();

        // Render Pending/Active Borrow Requests
        if (visibleRequests.length > 0 && activeFilter === "all") {
            const header = document.createElement('div');
            header.className = 'requests-header';
            header.style.gridColumn = '1 / -1';
            header.style.margin = '10px 0 5px 0';
            const h3 = document.createElement('h3');
            h3.style.color = '#1e293b';
            h3.style.fontSize = '1.1rem';
            h3.style.display = 'flex';
            h3.style.alignItems = 'center';
            h3.style.gap = '8px';
            const requestIcon = document.createElement('i');
            requestIcon.className = 'fa-solid fa-clock';
            requestIcon.style.color = '#eab308';
            h3.appendChild(requestIcon);
            h3.appendChild(document.createTextNode(' Borrow Requests (Pickup Pending)'));
            header.appendChild(h3);
            frag.appendChild(header);

            visibleRequests.forEach(req => {
                const book = LibraryCatalog.getById(req.bookId);
                if (!book) return;

                const expiryDate = new Date(req.expiryDateISO || req.expiryDate);
                const now = new Date();
                const diffHours = Math.max(0, Math.ceil((expiryDate - now) / 3600000));
                const diffDays = Math.ceil(diffHours / 24);

                let badgeClass = 'status-badge pending';
                let statusLabel = 'Pending Collection';
                if (req.status === 'Expired') {
                    badgeClass = 'status-badge overdue';
                    statusLabel = 'Expired (3 Days Passed)';
                } else if (req.status === 'Cancelled') {
                    badgeClass = 'status-badge overdue';
                    statusLabel = 'Cancelled';
                }

                const article = document.createElement('article');
                article.className = 'borrowed-book-card';
                article.style.borderLeft = `4px solid ${req.status === 'Pending' ? '#eab308' : '#94a3b8'}`;

                const cover = document.createElement('div');
                cover.className = 'book-mini-cover';
                const img = document.createElement('img');
                img.src = book.image || '../images/clean-code.jpeg';
                img.alt = book.title || 'Book cover';
                img.loading = 'lazy';
                img.addEventListener('error', () => { if (img.src.indexOf('clean-code.jpeg') === -1) img.src = '../images/clean-code.jpeg'; });
                cover.appendChild(img);

                const info = document.createElement('div');
                info.className = 'book-info';
                const title = document.createElement('h3');
                title.textContent = book.title || 'Untitled';
                const by = document.createElement('p');
                by.textContent = 'By ' + (book.author || 'Unknown');
                const dates = document.createElement('div');
                dates.className = 'book-dates';
                const reqOn = document.createElement('div');
                reqOn.className = 'date-item';
                const reqOnLabel = document.createElement('span');
                reqOnLabel.textContent = 'Requested On';
                const reqOnValue = document.createElement('strong');
                reqOnValue.textContent = LibraryStore.dateLabel(req.requestDateISO || req.requestCreatedAt);
                reqOn.appendChild(reqOnLabel);
                reqOn.appendChild(reqOnValue);

                const exp = document.createElement('div');
                exp.className = 'date-item';
                const expLabel = document.createElement('span');
                expLabel.textContent = 'Expiry Date';
                const expValue = document.createElement('strong');
                expValue.className = 'due-date';
                expValue.textContent = `${LibraryStore.dateLabel(req.expiryDateISO)} (${diffHours > 0 ? `${diffDays} day${diffDays === 1 ? '' : 's'} left` : 'Expired'})`;
                exp.appendChild(expLabel);
                exp.appendChild(expValue);
                dates.appendChild(reqOn);
                dates.appendChild(exp);

                info.appendChild(title);
                info.appendChild(by);
                info.appendChild(dates);

                const actions = document.createElement('div');
                actions.className = 'book-actions';
                const badge = document.createElement('span');
                badge.className = badgeClass;
                badge.textContent = statusLabel;
                const actionBtns = document.createElement('div');
                actionBtns.className = 'action-buttons';

                if (req.status === 'Pending') {
                    const collectBtn = document.createElement('button');
                    collectBtn.className = 'renew-btn';
                    collectBtn.type = 'button';
                    collectBtn.setAttribute('data-action', 'collect');
                    collectBtn.setAttribute('data-req-id', req.id);
                    const collectIcon = document.createElement('i');
                    collectIcon.className = 'fa-solid fa-check-double';
                    collectBtn.appendChild(collectIcon);
                    collectBtn.appendChild(document.createTextNode(' Collect Book'));

                    const cancelBtn = document.createElement('button');
                    cancelBtn.className = 'return-btn';
                    cancelBtn.type = 'button';
                    cancelBtn.setAttribute('data-action', 'cancel-req');
                    cancelBtn.setAttribute('data-req-id', req.id);
                    const cancelIcon = document.createElement('i');
                    cancelIcon.className = 'fa-solid fa-xmark';
                    cancelBtn.appendChild(cancelIcon);
                    cancelBtn.appendChild(document.createTextNode(' Cancel'));

                    actionBtns.appendChild(collectBtn);
                    actionBtns.appendChild(cancelBtn);
                } else {
                    const span = document.createElement('span');
                    span.style.fontSize = '0.85rem';
                    span.style.color = '#64748b';
                    span.textContent = 'Request Inactive';
                    actionBtns.appendChild(span);
                }

                actions.appendChild(badge);
                actions.appendChild(actionBtns);

                article.appendChild(cover);
                article.appendChild(info);
                article.appendChild(actions);

                frag.appendChild(article);
            });
        }

        // Render Active Borrowed Books
        if (visibleLoans.length > 0) {
            if (visibleRequests.length > 0 && activeFilter === 'all') {
                const header = document.createElement('div');
                header.className = 'loans-header';
                header.style.gridColumn = '1 / -1';
                header.style.margin = '15px 0 5px 0';
                const h3 = document.createElement('h3');
                h3.style.color = '#1e293b';
                h3.style.fontSize = '1.1rem';
                h3.style.display = 'flex';
                h3.style.alignItems = 'center';
                h3.style.gap = '8px';
                const activeIcon = document.createElement('i');
                activeIcon.className = 'fa-solid fa-book-open-reader';
                activeIcon.style.color = '#2563eb';
                h3.appendChild(activeIcon);
                h3.appendChild(document.createTextNode(' Active Borrowed Books'));
                header.appendChild(h3);
                frag.appendChild(header);
            }

            visibleLoans.forEach(loan => {
                const book = LibraryCatalog.getById(loan.bookId);
                if (!book) return;
                const state = loanStatus(loan);
                const className = state.toLowerCase().replace(/\s+/g, '-');
                const daysLeft = daysUntil(loan.dueDate);

                const article = document.createElement('article');
                article.className = 'borrowed-book-card';

                const cover = document.createElement('div');
                cover.className = 'book-mini-cover';
                const img = document.createElement('img');
                img.src = book.image || '../images/clean-code.jpeg';
                img.alt = book.title || 'Book cover';
                img.loading = 'lazy';
                img.addEventListener('error', () => { if (img.src.indexOf('clean-code.jpeg') === -1) img.src = '../images/clean-code.jpeg'; });
                cover.appendChild(img);

                const info = document.createElement('div');
                info.className = 'book-info';
                const title = document.createElement('h3');
                title.textContent = book.title || 'Untitled';
                const by = document.createElement('p');
                by.textContent = 'By ' + (book.author || 'Unknown');
                const dates = document.createElement('div');
                dates.className = 'book-dates';
                const borrowedOn = document.createElement('div');
                borrowedOn.className = 'date-item';
                const borrowedOnLabel = document.createElement('span');
                borrowedOnLabel.textContent = 'Borrowed On';
                const borrowedOnValue = document.createElement('strong');
                borrowedOnValue.textContent = LibraryStore.dateLabel(loan.borrowedDate);
                borrowedOn.appendChild(borrowedOnLabel);
                borrowedOn.appendChild(borrowedOnValue);

                const dueOn = document.createElement('div');
                dueOn.className = 'date-item';
                const dueOnLabel = document.createElement('span');
                dueOnLabel.textContent = 'Due Date';
                const dueOnValue = document.createElement('strong');
                dueOnValue.className = 'due-date';
                dueOnValue.textContent = `${LibraryStore.dateLabel(loan.dueDate)} (${daysLeft < 0 ? `${Math.abs(daysLeft)} days overdue` : `${daysLeft} days remaining`})`;
                dueOn.appendChild(dueOnLabel);
                dueOn.appendChild(dueOnValue);
                dates.appendChild(borrowedOn);
                dates.appendChild(dueOn);

                info.appendChild(title);
                info.appendChild(by);
                info.appendChild(dates);

                const actions = document.createElement('div');
                actions.className = 'book-actions';
                const badge = document.createElement('span');
                badge.className = 'status-badge ' + className;
                badge.textContent = state;
                const actionBtns = document.createElement('div');
                actionBtns.className = 'action-buttons';

                const renewBtn = document.createElement('button');
                renewBtn.className = 'renew-btn';
                renewBtn.type = 'button';
                renewBtn.setAttribute('data-action', 'renew');
                renewBtn.setAttribute('data-loan-id', loan.id);
                const renewIcon = document.createElement('i');
                renewIcon.className = 'fa-solid fa-rotate';
                renewBtn.appendChild(renewIcon);
                renewBtn.appendChild(document.createTextNode(' Renew'));

                const returnBtn = document.createElement('button');
                returnBtn.className = 'return-btn';
                returnBtn.type = 'button';
                returnBtn.setAttribute('data-action', 'return');
                returnBtn.setAttribute('data-loan-id', loan.id);
                const returnIcon = document.createElement('i');
                returnIcon.className = 'fa-solid fa-check';
                returnBtn.appendChild(returnIcon);
                returnBtn.appendChild(document.createTextNode(' Return'));

                actionBtns.appendChild(renewBtn);
                actionBtns.appendChild(returnBtn);

                actions.appendChild(badge);
                actions.appendChild(actionBtns);

                article.appendChild(cover);
                article.appendChild(info);
                article.appendChild(actions);

                frag.appendChild(article);
            });
        }

        // Replace container children with fragment
        container.replaceChildren();
        container.appendChild(frag);

        const totalItems = visibleLoans.length + (activeFilter === "all" ? visibleRequests.length : 0);
        if (emptyState) {
            emptyState.style.display = totalItems === 0 ? "block" : "none";
        }

        // Summary Counts
        const totalBorrowedEl = document.getElementById("totalBorrowed");
        const dueSoonEl = document.getElementById("dueSoon");
        const onTimeEl = document.getElementById("onTime");
        if (totalBorrowedEl) totalBorrowedEl.textContent = String(loans.length);
        if (dueSoonEl) dueSoonEl.textContent = String(loans.filter(l => loanStatus(l) === "Due Soon").length);
        if (onTimeEl) onTimeEl.textContent = String(loans.filter(l => loanStatus(l) === "On Time").length);
    }

    document.addEventListener("DOMContentLoaded", () => {
        document.getElementById("borrowSearch")?.addEventListener("input", renderLoans);

        document.querySelectorAll(".filter-tab[data-filter]").forEach(button => {
            button.addEventListener("click", () => {
                activeFilter = button.dataset.filter;
                document.querySelectorAll(".filter-tab").forEach(item => item.classList.toggle("active", item === button));
                renderLoans();
            });
        });

        document.getElementById("borrowedBooksList")?.addEventListener("click", event => {
            const btn = event.target.closest("button[data-action]");
            if (!btn) return;

            const action = btn.dataset.action;
            const loanId = btn.dataset.loanId;
            const reqId = btn.dataset.reqId;

            if (action === "collect") {
                const res = LibraryStore.collectBorrowRequest(reqId);
                alert(res.ok ? "Book collected successfully! It is now active under your borrowed books." : res.message);
                renderLoans();
            } else if (action === "cancel-req") {
                if (confirm("Cancel this pending borrow request?")) {
                    LibraryStore.cancelBorrowRequest(reqId);
                    renderLoans();
                }
            } else if (action === "renew") {
                const res = LibraryStore.renewLoan(loanId);
                alert(res.ok ? "Book renewed successfully for another 14 days." : res.message);
                renderLoans();
            } else if (action === "return") {
                if (confirm("Are you sure you want to return this book to the library?")) {
                    const res = LibraryStore.returnLoan(loanId);
                    if (res.ok) {
                        const fineNote = res.historyItem.fineAmount > 0 ? ` Overdue fine created: ₹${res.historyItem.fineAmount}.` : "";
                        alert(`Book returned successfully.${fineNote}`);
                    } else {
                        alert(res.message);
                    }
                    renderLoans();
                }
            }
        });

        renderLoans();
    });
}());
