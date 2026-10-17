// ==========================================================================
// Member Reservations (Hold Requests) Script
// Real Backend API Queueing, Status Tracking & Confirmation Dialogs
// ==========================================================================

(function () {
    let reservations = [];

    async function loadReservations() {
        const container = document.getElementById("reservationsList");
        const emptyState = document.getElementById("emptyReservations");

        if (window.LibraryAPI && typeof window.LibraryAPI.getReservations === "function") {
            try {
                reservations = await window.LibraryAPI.getReservations();
            } catch (err) {
                console.warn("API reservations fetch failed:", err);
                reservations = typeof LibraryStore !== "undefined" ? LibraryStore.getReservations() : [];
            }
        } else if (typeof LibraryStore !== "undefined") {
            reservations = LibraryStore.getReservations();
        }

        updateReservationSummary();
        renderReservations();
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

    function renderReservations() {
        const container = document.getElementById("reservationsList");
        const emptyState = document.getElementById("emptyReservations");
        if (!container) return;

        if (!reservations.length) {
            container.innerHTML = "";
            if (emptyState) emptyState.style.display = "block";
            return;
        }

        if (emptyState) emptyState.style.display = "none";
        container.innerHTML = "";

        reservations.forEach(res => {
            const title = res.bookTitle || res.title || "Book";
            const author = res.bookAuthor || res.author || "Unknown Author";
            const isReady = res.status === "Ready";
            const isCancelled = res.status === "Cancelled";

            let badgeClass = "status-badge pending";
            let statusText = `Queue #${res.queuePosition || 1} (Waiting)`;
            if (isReady) {
                badgeClass = "status-badge active";
                statusText = "Ready for Collection!";
            } else if (isCancelled) {
                badgeClass = "status-badge overdue";
                statusText = "Cancelled";
            }

            const card = document.createElement("div");
            card.className = "reservation-card";
            card.style.borderLeft = `4px solid ${isReady ? 'var(--color-success)' : (isCancelled ? 'var(--color-text-subtle)' : 'var(--color-primary)')}`;
            card.innerHTML = `
                <div class="reservation-icon" style="color: var(--color-primary);">
                    <i class="fa-solid fa-bookmark"></i>
                </div>
                <div class="reservation-info">
                    <h3>${escapeHtml(title)}</h3>
                    <p>By ${escapeHtml(author)}</p>
                    <div class="reservation-date" style="font-size: 0.8rem; color: var(--color-text-muted); margin-top: 4px;">
                        Reserved on: ${formatDate(res.reservedDate)}
                    </div>
                </div>
                <div class="reservation-actions">
                    <span class="${badgeClass}">
                        <i class="fa-solid ${isReady ? 'fa-circle-check' : 'fa-clock'}"></i> ${statusText}
                    </span>
                    ${!isCancelled && res.status !== "Fulfilled" ? `
                        <button class="cancel-btn" type="button" data-res-id="${res.id}" style="padding: 6px 12px; font-size: 0.8rem; border-radius: var(--radius-sm); cursor: pointer;">
                            <i class="fa-solid fa-xmark"></i> Cancel Hold
                        </button>
                    ` : ""}
                </div>`;
            container.appendChild(card);
        });
    }

    function handleCancel(id) {
        const res = reservations.find(r => String(r.id) === String(id));
        const title = res ? (res.bookTitle || res.title || "this book") : "this reservation";

        const doCancel = async () => {
            try {
                let ok = false;
                if (window.LibraryAPI && typeof window.LibraryAPI.cancelReservationAPI === "function") {
                    const result = await window.LibraryAPI.cancelReservationAPI(id);
                    ok = result && result.success;
                } else if (typeof LibraryStore !== "undefined") {
                    LibraryStore.cancelReservation(id);
                    ok = true;
                }

                if (ok) {
                    LibraryUI.showToast("Hold reservation cancelled successfully.", "info");
                    await loadReservations();
                } else {
                    LibraryUI.showToast("Could not cancel reservation.", "warning");
                }
            } catch (err) {
                console.error("Cancel res error:", err);
                LibraryUI.showToast("Network error cancelling hold.", "error");
            }
        };

        if (typeof LibraryUI !== "undefined" && typeof LibraryUI.confirmDialog === "function") {
            LibraryUI.confirmDialog({
                title: "Cancel Hold Reservation",
                message: `Are you sure you want to cancel your reservation for "${title}"? This will release your position in queue.`,
                confirmText: "Yes, Cancel Hold",
                isDanger: true,
                onConfirm: doCancel
            });
        } else {
            if (confirm(`Cancel reservation for "${title}"?`)) doCancel();
        }
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

    document.addEventListener("DOMContentLoaded", async () => {
        await loadReservations();

        const container = document.getElementById("reservationsList");
        if (container) {
            container.addEventListener("click", event => {
                const btn = event.target.closest("button[data-res-id]");
                if (btn) handleCancel(btn.dataset.resId);
            });
        }
    });
}());
