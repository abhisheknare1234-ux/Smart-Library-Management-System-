(function () {
    function loadNotifications() {
        const list = LibraryStore.getNotifications();
        const container = document.getElementById("notificationList");
        if (!container) return;

        if (!list.length) {
            container.innerHTML = `<div class="empty-state" style="display:block; text-align:center; padding:40px;"><div class="empty-icon" style="font-size:2rem; color:#94a3b8;"><i class="fa-solid fa-bell-slash"></i></div><p style="color:#64748b;">No notifications found.</p></div>`;
            return;
        }

        container.innerHTML = list.map(item => `
            <article class="notification-card ${item.read ? "" : "unread"}" data-id="${item.id}" style="cursor: pointer;">
                <div class="notification-icon">
                    <i class="fa-solid ${item.icon || "fa-bell"}"></i>
                </div>
                <div class="notification-content">
                    <h3>${item.title} ${item.read ? "" : '<span style="font-size:0.75rem; background:#2563eb; color:#fff; padding:2px 6px; border-radius:10px; margin-left:6px;">New</span>'}</h3>
                    <p>${item.message}</p>
                </div>
                <span class="notification-time">${item.time || "Recently"}</span>
            </article>
        `).join("");

        if (window.updateMemberIdentity) updateMemberIdentity();
    }

    function markAllRead() {
        LibraryStore.markAllNotificationsAsRead();
        loadNotifications();
        alert("All notifications marked as read.");
    }

    document.addEventListener("DOMContentLoaded", () => {
        loadNotifications();

        const markBtn = document.querySelector(".mark-all-btn") || document.getElementById("markAllBtn");
        if (markBtn) {
            markBtn.addEventListener("click", markAllRead);
        }

        const container = document.getElementById("notificationList");
        if (container) {
            container.addEventListener("click", event => {
                const card = event.target.closest(".notification-card[data-id]");
                if (card) {
                    const id = card.dataset.id;
                    LibraryStore.markNotificationAsRead(id);
                    loadNotifications();
                }
            });
        }
    });

    window.markAllRead = markAllRead;
}());