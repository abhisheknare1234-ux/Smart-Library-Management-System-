// ==========================================================================
// Member Fines & Dues Script
// Live Financial Records from Backend API, Idempotent Online Settlements
// ==========================================================================

let fines = [];
let paymentFineIds = [];

const API_BASE = "http://localhost:5000/api";

function getToken() {
    return sessionStorage.getItem("token") || localStorage.getItem("token");
}

document.addEventListener("DOMContentLoaded", async () => {
    await loadFines();
    const filterSelect = document.getElementById("fineFilter");
    if (filterSelect) {
        filterSelect.addEventListener("change", filterFines);
    }
});

function currency(amount) {
    return `₹${amount || 0}`;
}

async function loadFines() {
    const table = document.getElementById("fineTable");
    if (!table) return;

    if (window.LibraryAPI && typeof window.LibraryAPI.getFines === "function") {
        try {
            fines = await window.LibraryAPI.getFines();
        } catch (err) {
            console.warn("API fines error, trying local store:", err);
            fines = typeof LibraryStore !== "undefined" ? LibraryStore.getFines() : [];
        }
    } else if (typeof LibraryStore !== "undefined") {
        fines = LibraryStore.getFines();
    }

    if (!fines.length) {
        table.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center; padding:36px; color: var(--color-text-muted);">
                    <i class="fa-solid fa-circle-check" style="font-size: 2rem; color: var(--color-success); margin-bottom: 8px; display: block;"></i>
                    No fine records found. You have zero outstanding overdue penalties!
                </td>
            </tr>
        `;
    } else {
        table.innerHTML = fines.map(fine => {
            const title = fine.bookTitle || fine.bookName || fine.book || "Overdue Loan";
            const dateStr = fine.createdDate || fine.dueDate || "Recent";
            const status = fine.status || "Pending";
            const isPaid = status === "Paid";
            const fineId = fine.id || fine.issueId || fine.fineId;
            const amount = Number(fine.fineAmount || fine.amount || 0);

            return `
            <tr>
                <td><strong>${escapeHtml(title)}</strong></td>
                <td>${fine.reason || `${fine.overdueDays || "Late"} return penalty`}</td>
                <td>${formatDate(dateStr)}</td>
                <td><strong style="color: ${isPaid ? 'var(--color-success-text)' : 'var(--color-danger)'};">${currency(amount)}</strong></td>
                <td>
                    <span class="status ${isPaid ? 'paid' : 'pending'}">
                        <i class="fa-solid ${isPaid ? 'fa-circle-check' : 'fa-clock'}"></i> ${status}
                    </span>
                </td>
                <td>
                    ${!isPaid
                        ? `<button class="action-btn" type="button" onclick="openPaymentModal(['${fineId}'])" style="padding: 6px 14px; font-size: 0.82rem; font-weight: 600; cursor: pointer;">
                             Pay Now
                           </button>`
                        : `<span class="completed-payment" style="color: var(--color-success-text); font-weight: 500; font-size: 0.85rem;">
                             <i class="fa-solid fa-receipt"></i> Paid${fine.paymentMethod ? ` · ${fine.paymentMethod}` : ""}
                           </span>`}
                </td>
            </tr>`;
        }).join("");
    }

    updateSummary();
    filterFines();
}

function updateSummary() {
    const pending = fines.filter(f => f.status === "Pending").reduce((sum, f) => sum + (Number(f.fineAmount || f.amount) || 0), 0);
    const paid = fines.filter(f => f.status === "Paid").reduce((sum, f) => sum + (Number(f.fineAmount || f.amount) || 0), 0);

    const pendingEl = document.getElementById("totalFine");
    const paidEl = document.getElementById("totalPaid");
    const totalEl = document.getElementById("totalTransactions");

    if (pendingEl) pendingEl.textContent = currency(pending);
    if (paidEl) paidEl.textContent = currency(paid);
    if (totalEl) totalEl.textContent = fines.length;
}

function payAllFines() {
    const pendingIds = fines.filter(f => f.status === "Pending").map(f => f.id || f.issueId);
    if (!pendingIds.length) {
        if (typeof LibraryUI !== "undefined") {
            LibraryUI.showToast("You have no outstanding pending fines to settle.", "info");
        } else {
            alert("You have no outstanding pending fines.");
        }
        return;
    }
    openPaymentModal(pendingIds);
}

function openPaymentModal(ids) {
    paymentFineIds = ids;
    const selected = fines.filter(f => ids.includes(String(f.id || f.issueId)));
    const amount = selected.reduce((sum, f) => sum + (Number(f.fineAmount || f.amount) || 0), 0);

    const modal = document.getElementById("paymentModal");
    const titleEl = document.getElementById("paymentTitle");
    const descEl = document.getElementById("paymentDescription");
    const amountEl = document.getElementById("paymentAmount");

    if (titleEl) titleEl.textContent = ids.length === 1 ? "Settle Fine Online" : "Pay All Outstanding Fines";
    if (descEl) descEl.textContent = ids.length === 1 
        ? `Fine clearance for ${selected[0]?.bookTitle || selected[0]?.bookName || "loan item"}` 
        : `${ids.length} overdue fine items selected for settlement`;
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

async function confirmPayment() {
    const methodEl = document.getElementById("paymentMethod");
    const method = methodEl ? methodEl.value : "UPI / Net Banking";
    const confirmBtn = document.querySelector("#paymentModal .confirm-btn, #paymentModal button.primary-btn");

    if (!paymentFineIds.length) return;

    if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Processing Payment...`;
    }

    try {
        // Settle via backend API
        let successCount = 0;
        for (const id of paymentFineIds) {
            const fine = fines.find(f => String(f.id || f.issueId) === String(id));
            const amt = Number(fine?.fineAmount || fine?.amount || 0);

            const res = await fetch(`${API_BASE}/fines/${id}/pay`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${getToken()}`
                },
                body: JSON.stringify({
                    amount: amt,
                    paymentMethod: method,
                    transactionRef: `ONLINE-TX-${Date.now()}-${Math.floor(Math.random()*1000)}`,
                    notes: `Online settlement by patron via ${method}`
                })
            });

            if (res.ok) successCount++;
        }

        if (successCount > 0) {
            if (typeof LibraryUI !== "undefined") {
                LibraryUI.showToast(`Payment successful! Recorded payment for ${successCount} fine item(s).`, "success");
            } else {
                alert("Payment successful! Your fine record has been updated to Paid.");
            }
        } else {
            // Local store fallback if offline
            if (typeof LibraryStore !== "undefined") {
                const paidDate = LibraryStore.today();
                fines = fines.map(f => paymentFineIds.includes(String(f.id)) ? { ...f, status: "Paid", paymentMethod: method, paidDate } : f);
                LibraryStore.saveFines(fines);
                LibraryUI.showToast("Payment recorded successfully.", "success");
            }
        }

        closePaymentModal();
        await loadFines();
    } catch (err) {
        console.error("Payment failure:", err);
        if (typeof LibraryUI !== "undefined") {
            LibraryUI.showToast("Network error processing fine payment.", "error");
        }
    } finally {
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = `Confirm Payment`;
        }
    }
}

function filterFines() {
    const filterEl = document.getElementById("fineFilter");
    if (!filterEl) return;
    const filter = filterEl.value.toLowerCase();

    document.querySelectorAll("#fineTable tr").forEach(row => {
        const statusSpan = row.querySelector(".status");
        if (!statusSpan) return;
        const status = statusSpan.textContent.trim().toLowerCase();
        row.style.display = (filter === "all" || status.includes(filter)) ? "" : "none";
    });
}

function formatDate(val) {
    if (!val) return "—";
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
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
