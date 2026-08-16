(function () {
    function getSelectedBookId() {
        const params = new URLSearchParams(window.location.search);
        return params.get("id") || params.get("book");
    }

    function selectedBook() {
        const bookId = getSelectedBookId();
        if (!bookId) return null;
        if (!window.LibraryCatalog) return null;
        return LibraryCatalog.getById(bookId) || LibraryCatalog.getByTitle(bookId);
    }

    function renderNotFound() {
        const container = document.querySelector(".book-details-page");
        if (container) {
            container.innerHTML = "";
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.style.display = 'block';
            empty.style.textAlign = 'center';
            empty.style.padding = '60px 20px';

            const iconWrap = document.createElement('div');
            iconWrap.className = 'empty-icon';
            iconWrap.style.fontSize = '3rem';
            iconWrap.style.color = '#94a3b8';
            iconWrap.style.marginBottom = '20px';
            const emptyIcon = document.createElement('i');
            emptyIcon.className = 'fa-solid fa-book';
            iconWrap.appendChild(emptyIcon);

            const h1 = document.createElement('h1');
            h1.style.fontSize = '2rem';
            h1.style.color = '#1e293b';
            h1.style.marginBottom = '10px';
            h1.textContent = 'Book Not Found';

            const p = document.createElement('p');
            p.style.color = '#64748b';
            p.style.marginBottom = '25px';
            p.textContent = 'The requested book ID does not exist or has been removed from our library catalog.';

            const a = document.createElement('a');
            a.href = 'books.html';
            a.className = 'primary-btn';
            a.style.display = 'inline-flex';
            a.style.alignItems = 'center';
            a.style.gap = '8px';
            a.style.padding = '12px 24px';
            a.style.backgroundColor = '#2563eb';
            a.style.color = '#ffffff';
            a.style.textDecoration = 'none';
            a.style.borderRadius = '8px';
            a.style.fontWeight = '500';
            const backIcon = document.createElement('i');
            backIcon.className = 'fa-solid fa-arrow-left';
            a.appendChild(backIcon);
            a.appendChild(document.createTextNode(' Return to Browse Books'));

            empty.appendChild(iconWrap);
            empty.appendChild(h1);
            empty.appendChild(p);
            empty.appendChild(a);
            container.appendChild(empty);
        }
    }

    function renderBookDetails() {
        const book = selectedBook();
        if (!book) {
            renderNotFound();
            return;
        }

        const availableCopies = LibraryStore.getAvailableCopies(book.id);
        const set = (id, value) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        };

        const image = document.getElementById("bookImage");
        if (image) {
            image.src = book.image || '../images/clean-code.jpeg';
            image.alt = book.title || 'Book cover';
            image.addEventListener('error', function () {
                if (image.src && image.src.indexOf('clean-code.jpeg') === -1) image.src = '../images/clean-code.jpeg';
            });
        }

        set("bookCategory", (book.categoryLabel || book.category || "").toUpperCase());
        set("bookTitle", book.title);
        set("bookAuthor", book.author);
        set("bookDescription", book.description);
        set("bookISBN", book.isbn);
        set("bookPublished", book.published);
        set("bookPublisher", book.publisher);
        set("bookPages", `${book.pages} Pages`);
        set("breadcrumbTitle", book.title);

        const rating = document.querySelector(".book-rating > span");
        if (rating) rating.textContent = book.rating;

        const reviews = document.querySelector(".review-count");
        if (reviews) reviews.textContent = `(${book.reviews})`;

        const info = document.querySelectorAll(".library-info-list strong");
        if (info.length >= 4) {
            info[0].textContent = book.location || "Main Library - 1st Floor";
            info[1].textContent = book.shelf || "A-101";
            info[2].textContent = `${book.totalCopies} Copies`;
            info[3].textContent = `${availableCopies} Copies`;
        }

        set("availabilityTitle", availableCopies > 0 ? "Available for Borrow Request" : "Currently Unavailable");
        set("availabilityText", availableCopies > 0
            ? `${availableCopies} copy${availableCopies === 1 ? "" : "ies"} available. Submit a borrow request and collect within 3 days.`.replace("copyies", "copies")
            : "All copies are currently borrowed or reserved.");

        const borrowBtn = document.getElementById("borrowButton");
        const reserveBtn = document.getElementById("reserveButton");

        if (borrowBtn) {
            borrowBtn.hidden = availableCopies < 1;
            borrowBtn.textContent = '';
            const borrowIcon = document.createElement('i');
            borrowIcon.className = 'fa-solid fa-paper-plane';
            borrowBtn.appendChild(borrowIcon);
            borrowBtn.appendChild(document.createTextNode(' Request to Borrow'));
        }
        if (reserveBtn) {
            reserveBtn.hidden = availableCopies > 0;
        }

        renderRelatedBooks(book);
    }

    function renderRelatedBooks(currentBook) {
        const container = document.querySelector(".related-books");
        if (!container || !window.LibraryCatalog) return;

        const related = LibraryCatalog.all()
            .filter(b => b.id !== currentBook.id && (b.category === currentBook.category || b.categoryLabel === currentBook.categoryLabel))
            .slice(0, 3);

        if (!related.length) return;

        container.innerHTML = '';
        related.forEach(b => {
            const el = document.createElement('div');
            el.className = 'related-book';
            el.setAttribute('data-book-id', b.id);
            el.style.cursor = 'pointer';

            const img = document.createElement('img');
            img.src = b.image || '../images/clean-code.jpeg';
            img.alt = b.title || 'Related book cover';
            img.loading = 'lazy';
            img.addEventListener('error', () => { if (img.src.indexOf('clean-code.jpeg') === -1) img.src = '../images/clean-code.jpeg'; });

            const h3 = document.createElement('h3');
            h3.textContent = b.title || 'Untitled';

            const p = document.createElement('p');
            p.textContent = 'By ' + (b.author || 'Unknown');

            el.appendChild(img);
            el.appendChild(h3);
            el.appendChild(p);

            el.addEventListener('click', () => {
                const url = new URL(`book-details.html?id=${encodeURIComponent(b.id)}`, window.location.href);
                window.location.href = url.toString();
            });

            container.appendChild(el);
        });
    }

    // BUG-024 & BUG-008: Request to borrow logic
    function requestToBorrow() {
        const book = selectedBook();
        if (!book) return;

        const result = LibraryStore.createBorrowRequest(book.id);
        if (result.ok) {
            alert(`Borrow request submitted for "${book.title}". You have 3 days to collect it from the library.`);
            window.location.href = "borrowed-books.html";
        } else {
            alert(result.message);
        }
    }

    function reserveBook() {
        const book = selectedBook();
        if (!book) return;

        const result = LibraryStore.reserveBook(book.id);
        if (result.ok) {
            alert(`Reservation placed successfully for "${book.title}".`);
            window.location.href = "reservations.html";
        } else {
            alert(result.message);
        }
    }

    document.addEventListener("DOMContentLoaded", () => {
        renderBookDetails();
        const borrowBtn = document.getElementById("borrowButton");
        const reserveBtn = document.getElementById("reserveButton");

        if (borrowBtn) borrowBtn.addEventListener("click", requestToBorrow);
        if (reserveBtn) reserveBtn.addEventListener("click", reserveBook);
    });
}());
