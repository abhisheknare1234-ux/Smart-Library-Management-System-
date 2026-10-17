/**
 * Library Hub — Universal UI Component Utilities
 * Reusable dialogs, toasts, pagination, skeletons, debouncing, and navigation shell helpers.
 */

(function (window) {
    const LibraryUI = {};

    // ==========================================
    // TOAST NOTIFICATION SYSTEM
    // ==========================================
    let toastContainer = null;

    function getToastContainer() {
        if (!toastContainer || !document.body.contains(toastContainer)) {
            toastContainer = document.createElement("div");
            toastContainer.className = "lh-toast-container";
            toastContainer.setAttribute("aria-live", "polite");
            document.body.appendChild(toastContainer);
        }
        return toastContainer;
    }

    LibraryUI.showToast = function (message, type = "info", duration = 3500) {
        const container = getToastContainer();
        const toast = document.createElement("div");
        toast.className = `lh-toast ${type}`;
        
        const iconMap = {
            success: "fa-solid fa-circle-check",
            error: "fa-solid fa-circle-exclamation",
            warning: "fa-solid fa-triangle-exclamation",
            info: "fa-solid fa-circle-info"
        };
        const iconClass = iconMap[type] || iconMap.info;

        toast.innerHTML = `
            <i class="${iconClass}" style="color: var(--color-${type}); font-size: 1.1rem;"></i>
            <span style="flex: 1; line-height: 1.4;">${LibraryUI.escapeHtml(message)}</span>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = "0";
            toast.style.transform = "translateY(10px)";
            toast.style.transition = "all 0.2s ease";
            setTimeout(() => toast.remove(), 200);
        }, duration);
    };

    // ==========================================
    // CONFIRMATION MODAL DIALOG
    // ==========================================
    LibraryUI.confirmDialog = function ({
        title = "Confirm Action",
        message = "Are you sure you want to proceed?",
        confirmText = "Confirm",
        cancelText = "Cancel",
        isDanger = false,
        onConfirm = () => {}
    }) {
        let backdrop = document.getElementById("lhConfirmBackdrop");
        if (!backdrop) {
            backdrop = document.createElement("div");
            backdrop.id = "lhConfirmBackdrop";
            backdrop.className = "lh-modal-backdrop";
            backdrop.setAttribute("role", "dialog");
            backdrop.setAttribute("aria-modal", "true");
            document.body.appendChild(backdrop);
        }

        backdrop.innerHTML = `
            <div class="lh-modal" style="max-width: 440px;">
                <div class="lh-modal-header">
                    <h3>${LibraryUI.escapeHtml(title)}</h3>
                    <button class="lh-modal-close" id="lhConfirmCloseBtn" aria-label="Close dialog">&times;</button>
                </div>
                <div class="lh-modal-body">
                    <p style="color: var(--color-text-muted); font-size: var(--text-sm); line-height: 1.5;">
                        ${LibraryUI.escapeHtml(message)}
                    </p>
                </div>
                <div class="lh-modal-footer">
                    <button class="lh-btn lh-btn-secondary" id="lhConfirmCancelBtn">${LibraryUI.escapeHtml(cancelText)}</button>
                    <button class="lh-btn ${isDanger ? "lh-btn-danger" : "lh-btn-primary"}" id="lhConfirmOkBtn">${LibraryUI.escapeHtml(confirmText)}</button>
                </div>
            </div>
        `;

        backdrop.classList.add("active");

        const close = () => {
            backdrop.classList.remove("active");
        };

        backdrop.querySelector("#lhConfirmCloseBtn").onclick = close;
        backdrop.querySelector("#lhConfirmCancelBtn").onclick = close;
        backdrop.querySelector("#lhConfirmOkBtn").onclick = () => {
            close();
            onConfirm();
        };

        backdrop.onclick = (e) => {
            if (e.target === backdrop) close();
        };
    };

    // ==========================================
    // SKELETON LOADERS
    // ==========================================
    LibraryUI.showTableSkeleton = function (tbody, rows = 5, cols = 5) {
        if (!tbody) return;
        let html = "";
        for (let r = 0; r < rows; r++) {
            html += `<tr class="lh-tr-hover">`;
            for (let c = 0; c < cols; c++) {
                html += `<td class="lh-td"><div class="lh-skeleton" style="height: 18px; width: ${c === 0 ? "40px" : c === 1 ? "160px" : "100px"};"></div></td>`;
            }
            html += `</tr>`;
        }
        tbody.innerHTML = html;
    };

    // ==========================================
    // EMPTY STATE RENDERER
    // ==========================================
    LibraryUI.renderEmptyState = function (container, {
        icon = "fa-solid fa-folder-open",
        title = "No records found",
        message = "There is currently no data to display.",
        actionText = null,
        onAction = null
    }) {
        if (!container) return;
        container.innerHTML = `
            <div class="lh-empty-state">
                <div class="lh-empty-icon"><i class="${icon}"></i></div>
                <div class="lh-empty-title">${LibraryUI.escapeHtml(title)}</div>
                <div class="lh-empty-desc">${LibraryUI.escapeHtml(message)}</div>
                ${actionText ? `<button class="lh-btn lh-btn-primary lh-btn-sm" id="lhEmptyActionBtn">${LibraryUI.escapeHtml(actionText)}</button>` : ""}
            </div>
        `;
        if (actionText && onAction) {
            const btn = container.querySelector("#lhEmptyActionBtn");
            if (btn) btn.onclick = onAction;
        }
    };

    // ==========================================
    // PAGINATION CONTROLS
    // ==========================================
    LibraryUI.renderPagination = function (container, { page = 1, limit = 50, total = 0, onPageChange }) {
        if (!container) return;
        const totalPages = Math.ceil(total / limit) || 1;
        const start = total === 0 ? 0 : (page - 1) * limit + 1;
        const end = Math.min(page * limit, total);

        container.innerHTML = `
            <div class="lh-pagination">
                <div>Showing <strong>${start}</strong> to <strong>${end}</strong> of <strong>${total}</strong> results</div>
                <div class="lh-pagination-buttons">
                    <button class="lh-btn lh-btn-secondary lh-btn-sm" id="lhPrevPageBtn" ${page <= 1 ? "disabled" : ""}>
                        <i class="fa-solid fa-chevron-left"></i> Previous
                    </button>
                    <span style="display: flex; align-items: center; padding: 0 var(--space-2); font-weight: var(--font-semibold);">
                        Page ${page} of ${totalPages}
                    </span>
                    <button class="lh-btn lh-btn-secondary lh-btn-sm" id="lhNextPageBtn" ${page >= totalPages ? "disabled" : ""}>
                        Next <i class="fa-solid fa-chevron-right"></i>
                    </button>
                </div>
            </div>
        `;

        const prevBtn = container.querySelector("#lhPrevPageBtn");
        const nextBtn = container.querySelector("#lhNextPageBtn");

        if (prevBtn && page > 1) {
            prevBtn.onclick = () => onPageChange(page - 1);
        }
        if (nextBtn && page < totalPages) {
            nextBtn.onclick = () => onPageChange(page + 1);
        }
    };

    // ==========================================
    // DEBOUNCE UTILITY
    // ==========================================
    LibraryUI.debounce = function (func, delay = 300) {
        let timer;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => func.apply(this, args), delay);
        };
    };

    // ==========================================
    // STRING ESCAPING
    // ==========================================
    LibraryUI.escapeHtml = function (str) {
        if (str === null || str === undefined) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    };

    // ==========================================
    // SHELL NAVIGATION SETUP
    // ==========================================
    LibraryUI.setupShell = function () {
        const toggle = document.querySelector(".lh-menu-toggle");
        const sidebar = document.querySelector(".lh-sidebar");

        if (toggle && sidebar) {
            toggle.onclick = () => {
                sidebar.classList.toggle("open");
            };

            // Close sidebar when clicking outside on mobile
            document.addEventListener("click", (e) => {
                if (sidebar.classList.contains("open") && !sidebar.contains(e.target) && !toggle.contains(e.target)) {
                    sidebar.classList.remove("open");
                }
            });
        }
    };

    window.LibraryUI = LibraryUI;
})(window);
