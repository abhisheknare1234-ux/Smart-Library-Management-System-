/* Shared identity, navigation, dynamic greeting, notification badge, and route guard. */
(function () {
    const isMemberPage = () => /[\\/]pages[\\/]/.test(window.location.pathname) || /\/pages\//.test(window.location.pathname);
    const loginPath = () => isMemberPage() ? "../login.html" : "login.html";
    const notificationsPath = () => isMemberPage() ? "notifications.html" : "pages/notifications.html";

    const auth = () => {
        try {
            return JSON.parse(localStorage.getItem("library_auth"));
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
        }

        document.querySelectorAll(".notification-btn").forEach(btn => {
            btn.style.cursor = "pointer";
            btn.onclick = function (e) {
                e.preventDefault();
                window.location.href = notificationsPath();
            };
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
