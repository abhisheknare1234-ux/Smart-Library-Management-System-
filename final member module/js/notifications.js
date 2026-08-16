(function () {
    function formatTime(item) {
        if (item && item.createdAt) {
            try {
                const d = new Date(item.createdAt);
                if (!isNaN(d.getTime())) return d.toLocaleString();
            } catch (_) { }
        }
        return item.time || "Recently";
    }

    function loadNotifications() {
        const list = LibraryStore.getNotifications();
        const container = document.getElementById("notificationList");
        if (!container) return;

        // Clear container
        container.innerHTML = "";

        if (!list.length) {
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.style.display = 'block';
            empty.style.textAlign = 'center';
            empty.style.padding = '40px';

            const iconWrap = document.createElement('div');
            iconWrap.className = 'empty-icon';
            iconWrap.style.fontSize = '2rem';
            iconWrap.style.color = '#94a3b8';
            iconWrap.innerHTML = '<i class="fa-solid fa-bell-slash"></i>';

            const p = document.createElement('p');
            p.style.color = '#64748b';
            p.textContent = 'No notifications found.';

            empty.appendChild(iconWrap);
            empty.appendChild(p);
            container.appendChild(empty);

            if (window.updateMemberIdentity) updateMemberIdentity();
            return;
        }

        // Build DOM elements safely to avoid HTML injection
        list.forEach(item => {
            const article = document.createElement('article');
            article.className = 'notification-card' + (item.read ? '' : ' unread');
            article.setAttribute('data-id', item.id);
            article.style.cursor = 'default';

            const iconDiv = document.createElement('div');
            iconDiv.className = 'notification-icon';
            iconDiv.setAttribute('aria-hidden', 'true');
            const icon = document.createElement('i');
            icon.className = 'fa-solid ' + (item.icon || 'fa-bell');
            iconDiv.appendChild(icon);

            const content = document.createElement('div');
            content.className = 'notification-content';
            const h3 = document.createElement('h3');
            h3.textContent = item.title || 'Notification';
            if (!item.read) {
                const span = document.createElement('span');
                span.className = 'badge-new';
                span.textContent = 'New';
                span.style.marginLeft = '6px';
                span.style.fontSize = '0.75rem';
                span.style.background = '#2563eb';
                span.style.color = '#fff';
                span.style.padding = '2px 6px';
                span.style.borderRadius = '10px';
                h3.appendChild(span);
            }
            const p = document.createElement('p');
            p.textContent = item.message || '';
            content.appendChild(h3);
            content.appendChild(p);

            const meta = document.createElement('div');
            meta.className = 'notification-meta';
            const time = document.createElement('span');
            time.className = 'notification-time';
            time.textContent = formatTime(item);

            const actions = document.createElement('div');
            actions.className = 'notification-actions';
            const markBtn = document.createElement('button');
            markBtn.className = 'mark-read-btn';
            markBtn.setAttribute('data-id', item.id);
            markBtn.setAttribute('aria-label', 'Mark as read');
            markBtn.textContent = 'Mark as read';

            const delBtn = document.createElement('button');
            delBtn.className = 'delete-notif-btn';
            delBtn.setAttribute('data-id', item.id);
            delBtn.setAttribute('aria-label', 'Delete notification');
            delBtn.textContent = 'Delete';

            actions.appendChild(markBtn);
            actions.appendChild(delBtn);
            meta.appendChild(time);
            meta.appendChild(actions);

            article.appendChild(iconDiv);
            article.appendChild(content);
            article.appendChild(meta);

            container.appendChild(article);
        });

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
                const markBtn = event.target.closest(".mark-read-btn[data-id]");
                const delBtn = event.target.closest(".delete-notif-btn[data-id]");
                const card = event.target.closest(".notification-card[data-id]");
                if (markBtn) {
                    const id = markBtn.dataset.id;
                    LibraryStore.markNotificationAsRead(id);
                    loadNotifications();
                    return;
                }
                if (delBtn) {
                    const id = delBtn.dataset.id;
                    if (confirm("Delete this notification?")) {
                        const notifs = LibraryStore.getNotifications().filter(n => n.id !== id);
                        LibraryStore.saveNotifications(notifs);
                        loadNotifications();
                    }
                    return;
                }
                if (card) {
                    const id = card.dataset.id;
                    // Toggle read state by clicking on the card body
                    const item = LibraryStore.getNotifications().find(n => n.id === id);
                    if (item && !item.read) LibraryStore.markNotificationAsRead(id);
                    loadNotifications();
                }
            });
        }
    });

    window.markAllRead = markAllRead;
}());