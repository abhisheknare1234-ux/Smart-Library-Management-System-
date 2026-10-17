(function () {
    function displayHistory() {
        const history = LibraryStore.getHistory();
        const container = document.getElementById("historyList");
        const emptyState = document.getElementById("emptyHistory");
        const totalHistory = document.getElementById("totalHistory");

        if (totalHistory) {
            totalHistory.textContent = `${history.length} Book${history.length === 1 ? "" : "s"}`;
        }

        if (!container) return;

        if (history.length === 0) {
            container.innerHTML = "";
            if (emptyState) emptyState.style.display = "block";
            return;
        }

        if (emptyState) emptyState.style.display = "none";
        container.innerHTML = "";

        // Show newest returned books first
        [...history].reverse().forEach(item => {
            const book = LibraryCatalog.getById(item.bookId) || LibraryCatalog.getByTitle(item.title);
            const title = book ? book.title : (item.title || "Library Book");
            const author = book ? book.author : (item.author || "Unknown Author");

            const card = document.createElement("div");
            card.className = "history-card";
            card.innerHTML = `
                <div class="history-icon">
                    <i class="fa-solid fa-check"></i>
                </div>
                <div class="history-info">
                    <h3>${title}</h3>
                    <p>By ${author}</p>
                    <div class="history-dates">
                        <div>
                            <span>Borrowed On</span>
                            <strong>${LibraryStore.dateLabel(item.borrowedDate)}</strong>
                        </div>
                        <div>
                            <span>Returned On</span>
                            <strong>${LibraryStore.dateLabel(item.returnedDate)}</strong>
                        </div>
                        ${item.fineAmount ? `<div><span>Fine Incurred</span><strong style="color:#ef4444;">₹${item.fineAmount}</strong></div>` : ""}
                    </div>
                </div>
                <div>
                    <span class="returned-status">Returned</span>
                </div>`;
            container.appendChild(card);
        });
    }

    document.addEventListener("DOMContentLoaded", displayHistory);
}());
