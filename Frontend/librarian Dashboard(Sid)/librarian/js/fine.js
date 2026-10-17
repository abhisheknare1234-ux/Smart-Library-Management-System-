// ==========================================================================
// Librarian Fine Management & Collection
// Transparent Financial Auditing & Idempotent Payment Settlements
// ==========================================================================

const API_BASE = "http://localhost:5000/api";

function getToken() {
    return sessionStorage.getItem("token");
}

if (!getToken()) {
    window.location.href = "login.html";
}

let finesList = [];
let selectedFine = null;

document.addEventListener("DOMContentLoaded", async function () {
    initLibrarianProfile();
    await loadFineRecords();
    setupModalEvents();
    setupSearchFilter();
});

function initLibrarianProfile() {
    try {
        const user = JSON.parse(sessionStorage.getItem("user"));
        if (user) {
            const nameEl = document.getElementById("staffName");
            const avatarEl = document.getElementById("staffAvatar");
            if (nameEl) nameEl.textContent = user.name || "Librarian";
            if (avatarEl) avatarEl.textContent = (user.name || "L").charAt(0).toUpperCase();
        }
    } catch (_) {}

    document.querySelectorAll(".logout-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            sessionStorage.clear();
            window.location.href = "login.html";
        });
    });
}

async function loadFineRecords() {
    const tbody = document.getElementById("fineTableBody");

    try {
        if (window.LibAPI && typeof window.LibAPI.getFines === "function") {
            finesList = await window.LibAPI.getFines();
        } else {
            const res = await fetch(`${API_BASE}/fines`, {
                headers: { "Authorization": `Bearer ${getToken()}` }
            });
            if (!res.ok) throw new Error("Failed to load fines");
            const data = await res.json();
            finesList = data.fines || [];
        }

        updateSummaryCards(finesList);
        renderFineRows(finesList);
    } catch (err) {
        console.error("Fine records error:", err);
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--color-danger); padding: 24px;">Failed to load fine records.</td></tr>`;
        }
    }
}

function updateSummaryCards(list) {
    let total = 0;
    let pending = 0;
    let paid = 0;

    list.forEach(f => {
        const amt = Number(f.fineAmount || f.amount || 0);
        total += amt;
        if (f.status === "Pending") {
            pending += amt;
        } else if (f.status === "Paid") {
            paid += amt;
        }
    });

    const elTotal = document.getElementById("totalFineAmount");
    const elPending = document.getElementById("pendingFine");
    const elPaid = document.getElementById("paidFine");
    const elCount = document.getElementById("totalFineRecords");

    if (elTotal) elTotal.textContent = "₹" + total.toLocaleString();
    if (elPending) elPending.textContent = "₹" + pending.toLocaleString();
    if (elPaid) elPaid.textContent = "₹" + paid.toLocaleString();
    if (elCount) elCount.textContent = list.length;
}

function renderFineRows(list) {
    const tbody = document.getElementById("fineTableBody");
    if (!tbody) return;
    tbody.innerHTML = "";

    if (!list.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 32px; color: var(--color-text-muted);">
                    <i class="fa-solid fa-file-circle-check" style="font-size: 2rem; color: var(--color-success); margin-bottom: 8px; display: block;"></i>
                    No fine records found. All accounts in good standing.
                </td>
            </tr>
        `;
        return;
    }

    list.forEach(fine => {
        const isPaid = fine.status === "Paid";
        const amt = Number(fine.fineAmount || fine.amount || 0);
        const refId = fine.issueId || fine.fineId || fine.id;

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>#${refId}</strong></td>
            <td>
                <div style="font-weight: 600;">${escapeHtml(fine.studentName || fine.memberId)}</div>
                <small style="color: var(--color-text-muted);">${escapeHtml(fine.studentId || fine.memberId)}</small>
            </td>
            <td>${escapeHtml(fine.bookName || fine.book || "Book")}</td>
            <td>${fine.createdDate || fine.dueDate || "—"}</td>
            <td><strong style="color: ${isPaid ? 'var(--color-success-text)' : 'var(--color-danger)'}; font-size: 0.95rem;">₹${amt}</strong></td>
            <td>
                <span class="status ${isPaid ? 'paid' : 'pending'}">
                    <i class="fa-solid ${isPaid ? 'fa-circle-check' : 'fa-clock'}"></i> ${fine.status}
                </span>
            </td>
            <td>
                ${isPaid
                    ? `<span style="color: var(--color-success-text); font-size: 0.8rem; font-weight: 500;">
                         <i class="fa-solid fa-receipt"></i> Settled
                       </span>`
                    : `<button class="pay-btn open-pay-btn" data-id="${refId}" style="padding: 6px 12px; font-size: 0.8rem;">
                         <i class="fa-solid fa-money-bill-wave"></i> Collect Payment
                       </button>`}
            </td>
        `;
        tbody.appendChild(tr);
    });

    tbody.querySelectorAll(".open-pay-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const id = btn.getAttribute("data-id");
            openPayModal(id);
        });
    });
}

function openPayModal(issueId) {
    selectedFine = finesList.find(f => String(f.issueId || f.fineId || f.id) === String(issueId));
    if (!selectedFine) return;

    const modal = document.getElementById("payFineModal");
    const amt = Number(selectedFine.fineAmount || selectedFine.amount || 0);

    document.getElementById("fineStudent").textContent = selectedFine.studentName || selectedFine.memberId;
    document.getElementById("fineBook").textContent = selectedFine.bookName || selectedFine.book || "Book";
    document.getElementById("fineAmountDisplay").textContent = `₹${amt}`;
    document.getElementById("paymentNotes").value = `Desk payment for issue #${issueId}`;

    modal.style.display = "flex";
}

function setupModalEvents() {
    const modal = document.getElementById("payFineModal");
    const closeBtn = document.getElementById("closeFineModal");
    const cancelBtn = document.getElementById("cancelFineModal");
    const form = document.getElementById("fineForm");
    const submitBtn = document.getElementById("submitPaymentBtn");

    const closeModal = () => {
        modal.style.display = "none";
        selectedFine = null;
    };

    if (closeBtn) closeBtn.onclick = closeModal;
    if (cancelBtn) cancelBtn.onclick = closeModal;
    window.addEventListener("click", (e) => {
        if (e.target === modal) closeModal();
    });

    form.addEventListener("submit", async function (e) {
        e.preventDefault();
        if (!selectedFine) return;

        const issueId = selectedFine.issueId || selectedFine.fineId || selectedFine.id;
        const amount = Number(selectedFine.fineAmount || selectedFine.amount || 0);
        const method = document.getElementById("paymentMethod").value;
        const notes = document.getElementById("paymentNotes").value.trim();

        // Double-submit guard
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Processing Settlement...`;

        try {
            let res;
            if (window.LibAPI && typeof window.LibAPI.payFine === "function") {
                res = await window.LibAPI.payFine(issueId, amount, method, notes);
            } else {
                const response = await fetch(`${API_BASE}/fines/${issueId}/pay`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${getToken()}`
                    },
                    body: JSON.stringify({
                        amount,
                        paymentMethod: method,
                        transactionRef: `LMS-DESK-${Date.now()}`,
                        notes
                    })
                });
                res = await response.json();
            }

            if (!res.success) {
                LibraryUI.showToast(res.message || "Payment processing failed.", "error");
                return;
            }

            LibraryUI.showToast(`Fine of ₹${amount} collected successfully! Receipt #${res.paymentId || issueId} issued.`, "success");
            closeModal();
            await loadFineRecords();
        } catch (err) {
            console.error("Payment error:", err);
            LibraryUI.showToast("Network error recording settlement.", "error");
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<i class="fa-solid fa-receipt"></i> Confirm Settlement & Issue Receipt`;
        }
    });
}

function setupSearchFilter() {
    const input = document.getElementById("searchFine");
    if (!input) return;

    input.addEventListener("input", LibraryUI.debounce(function () {
        const q = input.value.trim().toLowerCase();
        if (!q) {
            renderFineRows(finesList);
            return;
        }
        const filtered = finesList.filter(f =>
            String(f.issueId || f.fineId || f.id).includes(q) ||
            (f.studentName && f.studentName.toLowerCase().includes(q)) ||
            (f.studentId && f.studentId.toLowerCase().includes(q)) ||
            (f.memberId && f.memberId.toLowerCase().includes(q)) ||
            (f.bookName && f.bookName.toLowerCase().includes(q)) ||
            (f.book && f.book.toLowerCase().includes(q))
        );
        renderFineRows(filtered);
    }, 250));
}

function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}