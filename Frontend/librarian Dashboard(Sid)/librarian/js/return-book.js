// ==========================================================================
// Librarian Return Book Workflow
// Automated Overdue Fine Computation, Instant Inventory Release & Receipts
// ==========================================================================

const API_BASE = "http://localhost:5000/api";

function getToken() {
    return sessionStorage.getItem("token");
}

if (!getToken()) {
    window.location.href = "login.html";
}

let activeLoans = [];
let selectedIssue = null;

document.addEventListener("DOMContentLoaded", async function () {
    initLibrarianProfile();
    await loadActiveLoans();
    setupModalEvents();
    setupSearchFilter();
    checkUrlParams();
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

function calculateOverdueInfo(dueDateStr) {
    if (!dueDateStr) return { days: 0, fine: 0 };
    const due = new Date(`${dueDateStr}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diffTime = today.getTime() - due.getTime();
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (days > 0) {
        return { days, fine: days * 5 };
    }
    return { days: 0, fine: 0 };
}

async function loadActiveLoans() {
    const tbody = document.getElementById("returnTableBody");
    const countEl = document.getElementById("totalPendingCount");

    try {
        const res = await fetch(`${API_BASE}/issues?status=Active&limit=100`, {
            headers: { "Authorization": `Bearer ${getToken()}` }
        });
        if (!res.ok) throw new Error("Failed to load active loans");
        const data = await res.json();
        activeLoans = data.issues || [];

        if (countEl) countEl.textContent = activeLoans.length;
        renderLoanRows(activeLoans);
    } catch (err) {
        console.error("Return load error:", err);
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--color-danger); padding: 24px;">Failed to load active loan records.</td></tr>`;
        }
    }
}

function renderLoanRows(loans) {
    const tbody = document.getElementById("returnTableBody");
    if (!tbody) return;
    tbody.innerHTML = "";

    if (!loans.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 32px; color: var(--color-text-muted);">
                    <i class="fa-solid fa-circle-check" style="font-size: 2rem; color: var(--color-success); margin-bottom: 8px; display: block;"></i>
                    All issued books have been returned. Zero pending returns!
                </td>
            </tr>
        `;
        return;
    }

    loans.forEach(loan => {
        const { days, fine } = calculateOverdueInfo(loan.dueDate);
        const isOverdue = days > 0;

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>#${loan.id}</strong></td>
            <td>
                <div style="font-weight: 600;">${escapeHtml(loan.studentName || loan.memberId)}</div>
                <small style="color: var(--color-text-muted);">ID: ${escapeHtml(loan.studentId || loan.memberId)}</small>
            </td>
            <td>${escapeHtml(loan.bookTitle || loan.bookName || "Book")}</td>
            <td>${loan.issueDate || "—"}</td>
            <td>${loan.dueDate || "—"}</td>
            <td>
                ${isOverdue 
                    ? `<strong style="color: var(--color-danger);">₹${fine}</strong> <small style="color: var(--color-danger); display:block;">(${days}d late)</small>` 
                    : `<span style="color: var(--color-success-text); font-weight: 600;">₹0</span>`}
            </td>
            <td>
                <span class="status ${isOverdue ? 'overdue' : 'active'}">
                    ${isOverdue ? 'Overdue' : 'Active'}
                </span>
            </td>
            <td>
                <button class="btn-primary open-return-btn" data-id="${loan.id}" style="padding: 6px 12px; font-size: 0.8rem;">
                    <i class="fa-solid fa-rotate-left"></i> Return
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    tbody.querySelectorAll(".open-return-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const id = btn.getAttribute("data-id");
            openReturnModal(id);
        });
    });
}

function openReturnModal(loanId) {
    selectedIssue = activeLoans.find(i => String(i.id) === String(loanId));
    if (!selectedIssue) return;

    const modal = document.getElementById("returnBookModal");
    const { days, fine } = calculateOverdueInfo(selectedIssue.dueDate);

    document.getElementById("modalIssueId").textContent = `#${selectedIssue.id}`;
    document.getElementById("modalStudentName").textContent = selectedIssue.studentName || selectedIssue.memberId;
    document.getElementById("modalBookTitle").textContent = selectedIssue.bookTitle || selectedIssue.bookName || "Book";
    document.getElementById("modalDueDate").textContent = selectedIssue.dueDate || "—";

    const fineAlert = document.getElementById("fineAlertBanner");
    const noFineAlert = document.getElementById("noFineBanner");

    if (days > 0) {
        document.getElementById("modalLateDays").textContent = days;
        document.getElementById("modalFineAmount").textContent = `₹${fine}`;
        fineAlert.style.display = "block";
        noFineAlert.style.display = "none";
    } else {
        fineAlert.style.display = "none";
        noFineAlert.style.display = "block";
    }

    modal.style.display = "flex";
}

function setupModalEvents() {
    const modal = document.getElementById("returnBookModal");
    const closeBtn = document.getElementById("closeReturnModal");
    const cancelBtn = document.getElementById("cancelReturnModal");
    const form = document.getElementById("returnForm");
    const submitBtn = document.getElementById("submitReturnBtn");

    const closeModal = () => {
        modal.style.display = "none";
        selectedIssue = null;
    };

    if (closeBtn) closeBtn.onclick = closeModal;
    if (cancelBtn) cancelBtn.onclick = closeModal;
    window.addEventListener("click", (e) => {
        if (e.target === modal) closeModal();
    });

    form.addEventListener("submit", async function (e) {
        e.preventDefault();
        if (!selectedIssue) return;

        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Processing Return...`;

        try {
            const res = await fetch(`${API_BASE}/issues/${selectedIssue.id}/return`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${getToken()}`
                }
            });

            const result = await res.json();

            if (!res.ok) {
                LibraryUI.showToast(result.message || "Return failed.", "error");
                return;
            }

            let msg = "Book returned and physical copy released successfully!";
            if (result.fineAmount > 0) {
                msg += ` Overdue fine of ₹${result.fineAmount} recorded (${result.overdueDays} days late).`;
            }
            if (result.reservedForNextMember) {
                msg += ` Assigned to the next waiting patron in queue!`;
            }

            LibraryUI.showToast(msg, result.fineAmount > 0 ? "warning" : "success", 5000);
            closeModal();
            await loadActiveLoans();
        } catch (err) {
            console.error("Return error:", err);
            LibraryUI.showToast("Server error processing return.", "error");
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<i class="fa-solid fa-check"></i> Process Return`;
        }
    });
}

function setupSearchFilter() {
    const input = document.getElementById("searchReturn");
    if (!input) return;

    input.addEventListener("input", LibraryUI.debounce(function () {
        const q = input.value.trim().toLowerCase();
        if (!q) {
            renderLoanRows(activeLoans);
            return;
        }
        const filtered = activeLoans.filter(loan =>
            String(loan.id).includes(q) ||
            (loan.studentName && loan.studentName.toLowerCase().includes(q)) ||
            (loan.studentId && loan.studentId.toLowerCase().includes(q)) ||
            (loan.memberId && loan.memberId.toLowerCase().includes(q)) ||
            (loan.bookTitle && loan.bookTitle.toLowerCase().includes(q)) ||
            (loan.bookName && loan.bookName.toLowerCase().includes(q))
        );
        renderLoanRows(filtered);
    }, 250));
}

function checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const issueId = params.get("issueId") || params.get("id");
    if (issueId) {
        setTimeout(() => openReturnModal(issueId), 300);
    }
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