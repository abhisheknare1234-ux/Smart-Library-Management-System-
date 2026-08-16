let fines = [];
let paymentFineIds = [];

document.addEventListener("DOMContentLoaded", () => {
    loadFines();
    const filterSelect = document.getElementById("fineFilter");
    if (filterSelect) {
        filterSelect.addEventListener("change", filterFines);
    }

    // Bind pay all button
    const payAllBtn = document.getElementById('payAllBtn') || document.querySelector('.pay-btn');
    if (payAllBtn) payAllBtn.addEventListener('click', payAllFines);

    // Modal buttons
    const modalClose = document.querySelector('.modal-close');
    if (modalClose) modalClose.addEventListener('click', closePaymentModal);
    const cancelBtn = document.querySelector('.cancel-payment');
    if (cancelBtn) cancelBtn.addEventListener('click', closePaymentModal);
    const confirmBtn = document.querySelector('.confirm-payment');
    if (confirmBtn) confirmBtn.addEventListener('click', confirmPayment);
});

function currency(amount) {
    return `₹${amount || 0}`;
}

function loadFines() {
    fines = LibraryStore.getFines();
    const table = document.getElementById("fineTable");
    if (!table) return;

    // Clear existing rows
    table.innerHTML = '';

    if (!fines.length) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 6;
        td.style.textAlign = 'center';
        td.style.padding = '30px';
        td.style.color = '#64748b';
        td.textContent = 'No fine records found. You have no overdue penalties.';
        tr.appendChild(td);
        table.appendChild(tr);
    } else {
        const frag = document.createDocumentFragment();
        fines.forEach(fine => {
            const book = LibraryCatalog.getById(fine.bookId);
            const title = book ? book.title : (fine.bookTitle || fine.book || "Library Fine");
            const dateStr = LibraryStore.dateLabel(fine.createdDate || fine.date);
            const status = fine.status || "Pending";

            const tr = document.createElement('tr');

            const tdTitle = document.createElement('td');
            const strongTitle = document.createElement('strong');
            strongTitle.textContent = title;
            tdTitle.appendChild(strongTitle);

            const tdReason = document.createElement('td');
            tdReason.textContent = fine.reason || 'Overdue return penalty';

            const tdDate = document.createElement('td');
            tdDate.textContent = dateStr;

            const tdAmount = document.createElement('td');
            const strongAmt = document.createElement('strong');
            strongAmt.textContent = currency(fine.amount);
            tdAmount.appendChild(strongAmt);

            const tdStatus = document.createElement('td');
            const spanStatus = document.createElement('span');
            spanStatus.className = 'status ' + (status.toLowerCase());
            spanStatus.textContent = status;
            tdStatus.appendChild(spanStatus);

            const tdAction = document.createElement('td');
            if (status === 'Pending') {
                const btn = document.createElement('button');
                btn.className = 'action-btn';
                btn.type = 'button';
                btn.textContent = 'Pay Now';
                btn.addEventListener('click', () => openPaymentModal([fine.id]));
                tdAction.appendChild(btn);
            } else {
                const span = document.createElement('span');
                span.className = 'completed-payment';
                span.style.color = '#16a34a';
                span.style.fontWeight = '500';
                const checkIcon = document.createElement('i');
                checkIcon.className = 'fa-solid fa-circle-check';
                span.appendChild(checkIcon);
                span.appendChild(document.createTextNode(' Paid'));
                if (fine.paymentMethod) {
                    span.appendChild(document.createTextNode(' · ' + fine.paymentMethod));
                }
                tdAction.appendChild(span);
            }

            tr.appendChild(tdTitle);
            tr.appendChild(tdReason);
            tr.appendChild(tdDate);
            tr.appendChild(tdAmount);
            tr.appendChild(tdStatus);
            tr.appendChild(tdAction);

            frag.appendChild(tr);
        });

        table.appendChild(frag);
    }

    updateSummary();
    filterFines();
}

function updateSummary() {
    const pending = fines.filter(f => f.status === "Pending").reduce((sum, f) => sum + (Number(f.amount) || 0), 0);
    const paid = fines.filter(f => f.status === "Paid").reduce((sum, f) => sum + (Number(f.amount) || 0), 0);

    const pendingEl = document.getElementById("totalFine");
    const paidEl = document.getElementById("totalPaid");
    const totalEl = document.getElementById("totalTransactions");

    if (pendingEl) pendingEl.textContent = currency(pending);
    if (paidEl) paidEl.textContent = currency(paid);
    if (totalEl) totalEl.textContent = fines.length;
}

function payAllFines() {
    const pendingIds = fines.filter(f => f.status === "Pending").map(f => f.id);
    if (!pendingIds.length) {
        alert("You have no outstanding pending fines.");
        return;
    }
    openPaymentModal(pendingIds);
}

function openPaymentModal(ids) {
    paymentFineIds = ids;
    const selected = fines.filter(f => ids.includes(f.id));
    const amount = selected.reduce((sum, f) => sum + (Number(f.amount) || 0), 0);

    const modal = document.getElementById("paymentModal");
    const titleEl = document.getElementById("paymentTitle");
    const descEl = document.getElementById("paymentDescription");
    const amountEl = document.getElementById("paymentAmount");

    if (titleEl) titleEl.textContent = ids.length === 1 ? "Pay Fine" : "Pay All Outstanding Fines";
    if (descEl) descEl.textContent = ids.length === 1 ? `Payment for ${LibraryCatalog.getById(selected[0]?.bookId)?.title || "library fine"}` : `${ids.length} fine items selected`;
    if (amountEl) amountEl.textContent = currency(amount);

    if (modal) {
        modal.classList.add("open");
        modal.setAttribute("aria-hidden", "false");
    }
}

function closePaymentModal() {
    const modal = document.getElementById("paymentModal");
    if (modal) {
        modal.classList.remove("open");
        modal.setAttribute("aria-hidden", "true");
    }
    paymentFineIds = [];
}

function confirmPayment() {
    const methodEl = document.getElementById("paymentMethod");
    const method = methodEl ? methodEl.value : "UPI / Net Banking";
    const paidDate = LibraryStore.today();

    fines = fines.map(f => paymentFineIds.includes(f.id) ? { ...f, status: "Paid", paymentMethod: method, paidDate } : f);
    LibraryStore.saveFines(fines);

    closePaymentModal();
    loadFines();
    alert("Payment successful! Your fine record has been updated to Paid.");
}

function filterFines() {
    const filterEl = document.getElementById("fineFilter");
    if (!filterEl) return;
    const filter = filterEl.value.toLowerCase();

    document.querySelectorAll("#fineTable tr").forEach(row => {
        const statusSpan = row.querySelector(".status");
        if (!statusSpan) return;
        const status = statusSpan.textContent.trim().toLowerCase();
        row.style.display = (filter === "all" || status === filter) ? "" : "none";
    });
}
