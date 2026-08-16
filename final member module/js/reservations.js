(function () {
    let reservations = [];

    function displayReservations() {
        reservations = LibraryStore.getReservations();
        const container = document.getElementById("reservationsList");
        const emptyState = document.getElementById("emptyReservations");

        updateReservationSummary();

        if (!container) return;

        if (reservations.length === 0) {
            container.innerHTML = "";
            if (emptyState) emptyState.style.display = "block";
            return;
        }

        if (emptyState) emptyState.style.display = "none";
        container.innerHTML = "";

        reservations.forEach(res => {
            const book = LibraryCatalog.getById(res.bookId) || { title: "Unknown Book", author: "Unknown Author" };
            const card = document.createElement("div");
            card.className = "reservation-card";

            const iconWrap = document.createElement('div');
            iconWrap.className = 'reservation-icon';
            iconWrap.innerHTML = '<i class="fa-solid fa-book"></i>';

            const info = document.createElement('div');
            info.className = 'reservation-info';
            const h3 = document.createElement('h3');
            h3.textContent = book.title;
            const p = document.createElement('p');
            p.textContent = 'By ' + book.author;
            const dateDiv = document.createElement('div');
            dateDiv.className = 'reservation-date';
            dateDiv.textContent = 'Reserved on: ' + LibraryStore.dateLabel(res.reservedDate);
            info.appendChild(h3);
            info.appendChild(p);
            info.appendChild(dateDiv);

            const actions = document.createElement('div');
            actions.className = 'reservation-actions';
            const statusSpan = document.createElement('span');
            statusSpan.className = 'reservation-status status-' + ((res.status || 'Pending').toLowerCase());
            statusSpan.textContent = res.status || 'Pending';
            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'cancel-btn';
            cancelBtn.type = 'button';
            cancelBtn.setAttribute('data-res-id', res.id);
            cancelBtn.textContent = 'Cancel Reservation';

            actions.appendChild(statusSpan);
            actions.appendChild(cancelBtn);

            card.appendChild(iconWrap);
            card.appendChild(info);
            card.appendChild(actions);

            container.appendChild(card);
        });
    }

    function updateReservationSummary() {
        const active = reservations.filter(r => ["Pending", "Ready"].includes(r.status)).length;
        const pending = reservations.filter(r => r.status === "Pending").length;
        const ready = reservations.filter(r => r.status === "Ready").length;

        const activeEl = document.getElementById("activeReservations");
        const pendingEl = document.getElementById("pendingReservations");
        const readyEl = document.getElementById("readyReservations");

        if (activeEl) activeEl.textContent = active;
        if (pendingEl) pendingEl.textContent = pending;
        if (readyEl) readyEl.textContent = ready;
    }

    function cancelReservation(id) {
        const res = reservations.find(r => r.id === id);
        const book = res ? LibraryCatalog.getById(res.bookId) : null;
        const title = book ? book.title : "this book";

        if (confirm(`Are you sure you want to cancel your reservation for "${title}"?`)) {
            LibraryStore.cancelReservation(id);
            displayReservations();
            alert("Reservation cancelled successfully.");
        }
    }

    document.addEventListener("DOMContentLoaded", () => {
        displayReservations();

        const container = document.getElementById("reservationsList");
        if (container) {
            container.addEventListener("click", event => {
                const btn = event.target.closest("button[data-res-id]");
                if (btn) cancelReservation(btn.dataset.resId);
            });
        }
    });
}());
