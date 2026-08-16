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

    function renderBooks() {
        const grid = document.getElementById("booksGrid");
        const emptyState = document.getElementById("booksEmptyState");
        if (!grid) return;

        const books = getBooks().filter(matches);

        // Clear existing content
        grid.innerHTML = "";

        if (!books.length) {
            if (emptyState) {
                emptyState.hidden = false;
                emptyState.style.display = 'block';
            }
            return;
        } else if (emptyState) {
            emptyState.hidden = true;
            emptyState.style.display = 'none';
        }

        // Build DOM-safe book cards
        books.forEach(book => {
            const available = book.availableCopies > 0;

            const article = document.createElement('article');
            article.className = 'book-card';
            article.setAttribute('data-book-id', book.id);

            const imgWrap = document.createElement('div');
            imgWrap.className = 'book-image';

            const img = document.createElement('img');
            img.src = book.image || '../images/clean-code.jpeg';
            img.alt = book.title || 'Book cover';
            img.loading = 'lazy';
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            img.addEventListener('error', () => {
                if (img.src && img.src.indexOf('clean-code.jpeg') === -1) img.src = '../images/clean-code.jpeg';
            });

            const category = document.createElement('span');
            category.className = 'category';
            category.textContent = book.categoryLabel || '';

            imgWrap.appendChild(img);
            imgWrap.appendChild(category);

            const content = document.createElement('div');
            content.className = 'book-content';

            const h3 = document.createElement('h3');
            h3.textContent = book.title || 'Untitled';

            const author = document.createElement('p');
            author.className = 'author';
            author.textContent = 'By ' + (book.author || 'Unknown');

            const statusWrap = document.createElement('div');
            statusWrap.className = 'book-status';
            const status = document.createElement('span');
            status.className = available ? 'available' : 'unavailable';
            status.textContent = available ? `${book.availableCopies} ${book.availableCopies === 1 ? 'copy' : 'copies'} available` : 'Currently Unavailable';
            statusWrap.appendChild(status);

            const btn = document.createElement('button');
            btn.className = 'view-button';
            btn.type = 'button';
            btn.setAttribute('data-book-id', book.id);
            btn.textContent = 'View Details';

            content.appendChild(h3);
            content.appendChild(author);
            content.appendChild(statusWrap);
            content.appendChild(btn);

            article.appendChild(imgWrap);
            article.appendChild(content);

            grid.appendChild(article);
        });
    }

    function openDetails(id) {
        // Use URL resolution relative to current document so navigation works from pages/ or root
        const url = new URL(`book-details.html?id=${encodeURIComponent(id)}`, window.location.href);
        window.location.href = url.toString();
    }

    document.addEventListener("DOMContentLoaded", () => {
        const searchInput = document.getElementById("bookSearch");
        const grid = document.getElementById("booksGrid");

        if (searchInput) {
            // Debounce search to reduce DOM operations
            let debounceTimer = null;
            searchInput.addEventListener("input", event => {
                clearTimeout(debounceTimer);
                const v = event.target.value;
                debounceTimer = setTimeout(() => {
                    searchQuery = v;
                    renderBooks();
                }, 180);
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
