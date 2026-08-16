/* Shared identity, navigation, dynamic greeting, notification badge, and route guard. */
(function () {
    const isMemberPage = () => /[\\/]pages[\\/]/.test(window.location.pathname) || /\/pages\//.test(window.location.pathname);

    // Resolve commonly used paths depending on where the HTML file sits (root or pages/)
    const basePrefix = isMemberPage() ? "../" : "";

    window.resolvePage = function (relPath) {
        if (!relPath) return relPath;
        // If caller passes an absolute-looking path (starts with ./ or ../) preserve it
        if (/^(?:\.\/.+|\.\/.+|[a-zA-Z]:|\/)/.test(relPath)) return relPath;
        return basePrefix + relPath;
    };

    window.resolveAsset = function (assetPath) {
        if (!assetPath) return assetPath;
        // If asset already includes ../ or /, return as-is
        if (assetPath.startsWith("../") || assetPath.startsWith("/")) return assetPath;
        return basePrefix + assetPath;
    };

    const loginPath = () => isMemberPage() ? "../login.html" : "login.html";
    const notificationsPath = () => isMemberPage() ? "notifications.html" : "pages/notifications.html";

    const auth = () => {
        try {
            const a = JSON.parse(localStorage.getItem("library_auth"));
            // Basic expiry check to reduce session fixation
            if (a && a.expiresAt && new Date(a.expiresAt) < new Date()) {
                // session expired
                localStorage.removeItem("isLoggedIn");
                localStorage.removeItem("library_auth");
                return null;
            }
            return a;
        } catch (_) {
            return null;
        }
    };

    window.getMemberProfile = function () {
        const saved = window.LibraryStore ? LibraryStore.getProfile() : {};
        const member = auth() || {};
        return {
            fullName: saved.fullName || member.fullName || "Akshay Member",
            email: saved.email || member.email || "akshay@example.com",
            phone: saved.phone || "+91 98765 43210",
            membership: saved.membership || member.membership || "Student Member",
            memberId: saved.memberId || member.memberId || "demo-member",
            memberSince: saved.memberSince || member.memberSince || "2025"
        };
    };

    // BUG-023: Dynamic greeting based on current local time
    window.getTimeGreeting = function () {
        const hour = new Date().getHours();
        if (hour >= 0 && hour < 12) return "Good Morning";
        if (hour >= 12 && hour < 17) return "Good Afternoon";
        if (hour >= 17 && hour < 21) return "Good Evening";
        return "Good Night";
    };

    window.updateMemberIdentity = function () {
        const profile = getMemberProfile();
        const initial = (profile.fullName.trim().charAt(0) || "M").toUpperCase();

        document.querySelectorAll(".profile-mini").forEach(mini => {
            const avatar = mini.querySelector(".avatar");
            const name = mini.querySelector("h4");
            const role = mini.querySelector("p");
            if (avatar) avatar.textContent = initial;
            if (name) name.textContent = profile.fullName;
            if (role) role.textContent = profile.membership || "Member";
        });

        const greeting = document.getElementById("dashboardGreeting");
        if (greeting) {
            greeting.textContent = `${getTimeGreeting()}, ${profile.fullName} 👋`;
        }

        // BUG-021 & BUG-018: Header Notification Badge & Navigation
        const badge = document.querySelector(".notification-badge");
        if (badge && window.LibraryStore) {
            const count = LibraryStore.getUnreadNotificationCount();
            badge.textContent = count;
            badge.style.display = count > 0 ? "inline-flex" : "none";
            badge.setAttribute("aria-label", `${count} unread notifications`);
        }

        document.querySelectorAll(".notification-btn").forEach(btn => {
            btn.style.cursor = "pointer";
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                window.location.href = resolvePage("pages/notifications.html");
            });
        });

        // Attach logout button listeners (replace inline onclick handlers in HTML)
        document.querySelectorAll('.logout-btn').forEach(btn => {
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                window.logout();
            });
        });
    };

    // BUG-022: Secure logout feature
    window.logout = function () {
        if (confirm("Are you sure you want to logout?")) {
            localStorage.removeItem("isLoggedIn");
            localStorage.removeItem("memberEmail");
            localStorage.removeItem("library_auth");
            // Prevent back navigation to protected pages
            window.location.replace(loginPath());
        }
    };

    document.addEventListener("DOMContentLoaded", () => {
        const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";
        const currentPath = window.location.pathname;
        const isLoginPage = currentPath.endsWith("login.html");

        if (!isLoginPage && (!auth() || !isLoggedIn)) {
            window.location.replace(loginPath());
            return;
        }

        updateMemberIdentity();
    });
}());
