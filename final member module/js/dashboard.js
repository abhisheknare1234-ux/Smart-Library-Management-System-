(function () {
    function loanStatus(loan) {
        const dueMs = new Date(`${loan.dueDate}T00:00:00`).getTime();
        const todayMs = new Date(`${LibraryStore.today()}T00:00:00`).getTime();
        const days = Math.ceil((dueMs - todayMs) / 86400000);
        if (days < 0) return "Overdue";
        if (days <= 3) return "Due Soon";
        return "On Time";
    }

    function renderDashboardStats() {
        const loans = LibraryStore.getBorrowedBooks();
        const reservations = LibraryStore.getReservations().filter(r => ["Pending", "Ready"].includes(r.status));
        const pendingFines = LibraryStore.getFines().filter(f => f.status === "Pending");
        const totalFineSum = pendingFines.reduce((sum, f) => sum + (Number(f.amount) || 0), 0);
        const dueSoonCount = loans.filter(l => loanStatus(l) === "Due Soon").length;

        const setVal = (selectorOrId, val) => {
            const el = document.getElementById(selectorOrId) || document.querySelector(selectorOrId);
            if (el) el.textContent = val;
        };

        // Borrowed Count
        const countEl = document.getElementById("borrowedCount");
        if (countEl) countEl.textContent = loans.length.toString().padStart(2, "0");

        // Stat cards query by position
        const statCards = document.querySelectorAll(".stats-grid .stat-card h2");
        if (statCards.length >= 4) {
            statCards[0].textContent = loans.length.toString().padStart(2, "0");
            statCards[1].textContent = dueSoonCount.toString().padStart(2, "0");
            statCards[2].textContent = reservations.length.toString().padStart(2, "0");
            statCards[3].textContent = `₹${totalFineSum}`;
        }
    }

    function renderBorrowedTable() {
        const table = document.getElementById("borrowedBooksTable");
        if (!table) return;

        const loans = LibraryStore.getBorrowedBooks();
        if (!loans.length) {
            table.innerHTML = '';
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 5;
            td.style.textAlign = 'center';
            td.style.color = '#64748b';
            td.style.padding = '25px';
            td.textContent = 'No books currently borrowed. ';
            const exploreLink = document.createElement('a');
            exploreLink.href = 'books.html';
            exploreLink.style.color = '#2563eb';
            exploreLink.textContent = 'Explore Books';
            td.appendChild(exploreLink);
            tr.appendChild(td);
            table.appendChild(tr);
            return;
        }

        const isPage = /[\\/]pages[\\/]/.test(window.location.pathname) || /\/pages\//.test(window.location.pathname);
        const detailsPath = isPage ? "book-details.html" : "pages/book-details.html";

        table.innerHTML = '';
        const frag = document.createDocumentFragment();

        loans.slice(0, 5).forEach(loan => {
            const book = LibraryCatalog.getById(loan.bookId) || { title: "Unknown Book", author: "Unknown Author" };
            const state = loanStatus(loan);
            const statusClass = state.toLowerCase().replace(/\s+/g, '-');

            const tr = document.createElement('tr');
            const tdInfo = document.createElement('td');

            const bookInfo = document.createElement('div');
            bookInfo.className = 'book-info';
            bookInfo.style.cursor = 'pointer';
            bookInfo.addEventListener('click', () => {
                const url = new URL(`${detailsPath}?id=${encodeURIComponent(loan.bookId)}`, window.location.href);
                window.location.href = url.toString();
            });

            const cover = document.createElement('div');
            cover.className = 'book-cover';
            const coverIcon = document.createElement('i');
            coverIcon.className = 'fa-solid fa-book';
            cover.appendChild(coverIcon);

            const meta = document.createElement('div');
            const strong = document.createElement('strong');
            strong.textContent = book.title;
            const small = document.createElement('small');
            small.textContent = book.author;
            meta.appendChild(strong);
            meta.appendChild(small);

            bookInfo.appendChild(cover);
            bookInfo.appendChild(meta);
            tdInfo.appendChild(bookInfo);

            const tdBorrowed = document.createElement('td');
            tdBorrowed.textContent = LibraryStore.dateLabel(loan.borrowedDate);

            const tdDue = document.createElement('td');
            tdDue.textContent = LibraryStore.dateLabel(loan.dueDate);

            const tdState = document.createElement('td');
            const spanState = document.createElement('span');
            spanState.className = 'status ' + statusClass;
            spanState.textContent = state;
            tdState.appendChild(spanState);

            const tdAction = document.createElement('td');
            const btn = document.createElement('button');
            btn.className = 'action-btn';
            btn.type = 'button';
            btn.setAttribute('data-loan-id', loan.id);
            btn.textContent = 'Renew';
            tdAction.appendChild(btn);

            tr.appendChild(tdInfo);
            tr.appendChild(tdBorrowed);
            tr.appendChild(tdDue);
            tr.appendChild(tdState);
            tr.appendChild(tdAction);

            frag.appendChild(tr);
        });

        table.appendChild(frag);
    }

    function renderRecommendedBooks() {
        const container = document.querySelector(".recommended-grid");
        if (!container || !window.LibraryCatalog) return;

        const isPage = /[\\/]pages[\\/]/.test(window.location.pathname) || /\/pages\//.test(window.location.pathname);
        const detailsPath = isPage ? "book-details.html" : "pages/book-details.html";

        const recs = LibraryCatalog.all().slice(0, 3);
        container.innerHTML = '';
        const frag = document.createDocumentFragment();

        recs.forEach(book => {
            const available = LibraryStore.getAvailableCopies(book.id) > 0;

            const card = document.createElement('div');
            card.className = 'book-card';

            const coverWrap = document.createElement('div');
            coverWrap.className = 'book-card-cover';
            const img = document.createElement('img');
            img.src = book.image || '../images/clean-code.jpeg';
            img.alt = book.title || 'Book cover';
            img.loading = 'lazy';
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            img.style.borderRadius = '6px';
            img.addEventListener('error', () => { if (img.src.indexOf('clean-code.jpeg') === -1) img.src = '../images/clean-code.jpeg'; });
            coverWrap.appendChild(img);

            const content = document.createElement('div');
            content.className = 'book-card-content';
            const h3 = document.createElement('h3');
            h3.textContent = book.title || 'Untitled';
            const p = document.createElement('p');
            p.textContent = 'By ' + (book.author || 'Unknown');
            const span = document.createElement('span');
            span.className = available ? 'available' : 'unavailable';
            span.textContent = available ? 'Available' : 'Unavailable';
            const btn = document.createElement('button');
            btn.className = 'secondary-btn';
            btn.type = 'button';
            btn.textContent = 'View Details';
            btn.addEventListener('click', () => {
                const url = new URL(`${detailsPath}?id=${encodeURIComponent(book.id)}`, window.location.href);
                window.location.href = url.toString();
            });

            content.appendChild(h3);
            content.appendChild(p);
            content.appendChild(span);
            content.appendChild(btn);

            card.appendChild(coverWrap);
            card.appendChild(content);

            frag.appendChild(card);
        });

        container.appendChild(frag);
    }

    document.addEventListener("DOMContentLoaded", () => {
        renderDashboardStats();
        renderBorrowedTable();
        renderRecommendedBooks();

        const table = document.getElementById("borrowedBooksTable");
        if (table) {
            table.addEventListener("click", event => {
                const btn = event.target.closest("button[data-loan-id]");
                if (!btn) return;
                const res = LibraryStore.renewLoan(btn.dataset.loanId);
                alert(res.ok ? "Book renewed successfully for 14 days." : res.message);
                renderDashboardStats();
                renderBorrowedTable();
            });
        }
    });
}());
