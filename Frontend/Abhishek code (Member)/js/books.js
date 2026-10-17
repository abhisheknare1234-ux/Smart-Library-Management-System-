(function () {
    let activeCategory = "all";
    let searchQuery = "";

    function getBooks() {
        if (!window.LibraryCatalog || !window.LibraryStore) return [];
        return LibraryCatalog.all().map(book => ({
            ...book,
            availableCopies: LibraryStore.getAvailableCopies(book.id)
        }));
    }

    function matches(book) {
        const query = searchQuery.trim().toLowerCase();
        const matchesQuery = !query || [
            book.title,
            book.author,
            book.isbn,
            book.category,
            book.categoryLabel
        ].some(val => val && val.toString().toLowerCase().includes(query));

        const normBookCategory = (book.category || "").trim().toLowerCase();
        const normActiveCategory = activeCategory.trim().toLowerCase();
        const matchesCategory = normActiveCategory === "all" || normBookCategory === normActiveCategory;

        return matchesQuery && matchesCategory;
    }

    async function renderBooks() {
        const grid = document.getElementById("booksGrid");
        const emptyState = document.getElementById("booksEmptyState");
        if (!grid) return;

        let books = [];
        if (window.LibraryAPI && typeof window.LibraryAPI.getBooks === "function") {
            try {
                books = await window.LibraryAPI.getBooks(activeCategory, searchQuery);
            } catch (_) {}
        }
        if (!books || !books.length) {
            books = getBooks().filter(matches);
        }

        grid.innerHTML = books.map(book => {
            const available = (book.availableCopies ?? 1) > 0;
            return `<article class="book-card" data-book-id="${book.id}">
                <div class="book-image">
                    <img src="${book.image || '../images/clean-code.jpeg'}" alt="${book.title}" onerror="this.onerror=null;this.src='../images/clean-code.jpeg';">
                    <span class="category">${book.category || book.categoryLabel || 'General'}</span>
                </div>
                <div class="book-content">
                    <h3>${book.title}</h3>
                    <p class="author">By ${book.author}</p>
                    <div class="book-status">
                        <span class="${available ? "available" : "unavailable"}">
                            ${available ? `${book.availableCopies ?? 1} ${(book.availableCopies ?? 1) === 1 ? "copy" : "copies"} available` : "Currently Unavailable"}
                        </span>
                    </div>
                    <button class="view-button" type="button" data-book-id="${book.id}">View Details</button>
                </div>
            </article>`;
        }).join("");

        if (emptyState) {
            emptyState.hidden = books.length !== 0;
            emptyState.style.display = books.length === 0 ? "block" : "none";
        }
    }

    function openDetails(id) {
        window.location.href = `book-details.html?id=${encodeURIComponent(id)}`;
    }

    document.addEventListener("DOMContentLoaded", () => {
        const searchInput = document.getElementById("bookSearch");
        const grid = document.getElementById("booksGrid");

        if (searchInput) {
            const debouncedSearch = typeof LibraryUI !== "undefined" 
                ? LibraryUI.debounce(val => { searchQuery = val; renderBooks(); }, 250)
                : val => { searchQuery = val; renderBooks(); };
            searchInput.addEventListener("input", event => {
                debouncedSearch(event.target.value);
            });
        }

        document.querySelectorAll(".filter-btn[data-category]").forEach(button => {
            button.addEventListener("click", () => {
                activeCategory = button.dataset.category || "all";
                document.querySelectorAll(".filter-btn").forEach(item => item.classList.toggle("active", item === button));
                renderBooks();
            });
        });

        if (grid) {
            grid.addEventListener("click", event => {
                const button = event.target.closest(".view-button[data-book-id]");
                if (button) openDetails(button.dataset.bookId);
            });
        }

        renderBooks();
    });
}());
