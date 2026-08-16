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

            const iconWrap = document.createElement('div');
            iconWrap.className = 'history-icon';
            const checkIcon = document.createElement('i');
            checkIcon.className = 'fa-solid fa-check';
            iconWrap.appendChild(checkIcon);

            const info = document.createElement('div');
            info.className = 'history-info';
            const h3 = document.createElement('h3');
            h3.textContent = title;
            const p = document.createElement('p');
            p.textContent = 'By ' + author;

            const datesDiv = document.createElement('div');
            datesDiv.className = 'history-dates';
            const borrowedDiv = document.createElement('div');
            const borrowedLabel = document.createElement('span');
            borrowedLabel.textContent = 'Borrowed On';
            const borrowedValue = document.createElement('strong');
            borrowedValue.textContent = LibraryStore.dateLabel(item.borrowedDate);
            borrowedDiv.appendChild(borrowedLabel);
            borrowedDiv.appendChild(borrowedValue);

            const returnedDiv = document.createElement('div');
            const returnedLabel = document.createElement('span');
            returnedLabel.textContent = 'Returned On';
            const returnedValue = document.createElement('strong');
            returnedValue.textContent = LibraryStore.dateLabel(item.returnedDate);
            returnedDiv.appendChild(returnedLabel);
            returnedDiv.appendChild(returnedValue);

            datesDiv.appendChild(borrowedDiv);
            datesDiv.appendChild(returnedDiv);

            if (item.fineAmount) {
                const fineDiv = document.createElement('div');
                const fineLabel = document.createElement('span');
                fineLabel.textContent = 'Fine Incurred';
                const fineValue = document.createElement('strong');
                fineValue.style.color = '#ef4444';
                fineValue.textContent = `₹${item.fineAmount}`;
                fineDiv.appendChild(fineLabel);
                fineDiv.appendChild(fineValue);
                datesDiv.appendChild(fineDiv);
            }

            info.appendChild(h3);
            info.appendChild(p);
            info.appendChild(datesDiv);

            const statusWrap = document.createElement('div');
            const spanStatus = document.createElement('span');
            spanStatus.className = 'returned-status';
            spanStatus.textContent = 'Returned';
            statusWrap.appendChild(spanStatus);

            card.appendChild(iconWrap);
            card.appendChild(info);
            card.appendChild(statusWrap);

            container.appendChild(card);
        });
    }

    document.addEventListener("DOMContentLoaded", displayHistory);
}());
