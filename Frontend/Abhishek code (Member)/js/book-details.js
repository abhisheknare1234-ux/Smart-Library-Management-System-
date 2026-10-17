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
            container.innerHTML = `
                <div class="empty-state" style="display: block; text-align: center; padding: 60px 20px;">
                    <div class="empty-icon" style="font-size: 3rem; color: #94a3b8; margin-bottom: 20px;">
                        <i class="fa-solid fa-book"></i>
                    </div>
                    <h1 style="font-size: 2rem; color: #1e293b; margin-bottom: 10px;">Book Not Found</h1>
                    <p style="color: #64748b; margin-bottom: 25px;">The requested book ID does not exist or has been removed from our library catalog.</p>
                    <a href="books.html" class="primary-btn" style="display: inline-flex; align-items: center; gap: 8px; padding: 12px 24px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 500;">
                        <i class="fa-solid fa-arrow-left"></i> Return to Browse Books
                    </a>
                </div>`;
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
            image.src = book.image;
            image.alt = book.title;
            image.onerror = function () {
                this.onerror = null;
                this.src = "../images/clean-code.jpeg";
            };
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
            borrowBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Request to Borrow';
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

        container.innerHTML = related.map(b => `
            <div class="related-book" onclick="window.location.href='book-details.html?id=${encodeURIComponent(b.id)}'" style="cursor: pointer;">
                <img src="${b.image}" alt="${b.title}" onerror="this.onerror=null;this.src='../images/clean-code.jpeg';">
                <h3>${b.title}</h3>
                <p>By ${b.author}</p>
            </div>
        `).join("");
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
