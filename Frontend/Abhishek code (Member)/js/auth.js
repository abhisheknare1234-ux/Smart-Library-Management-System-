// ===============================
// MEMBER AUTHENTICATION SYSTEM
// ===============================

document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("loginForm");
    if (!loginForm) return;

    // Check if already logged in -> redirect to dashboard
    if (localStorage.getItem("isLoggedIn") === "true") {
        window.location.href = "pages/dashboard.html";
        return;
    }

    loginForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const emailInput = document.getElementById("email");
        const passwordInput = document.getElementById("password");
        const errorMessage = document.getElementById("errorMessage");

        const email = emailInput ? emailInput.value.trim().toLowerCase() : "";
        const password = passwordInput ? passwordInput.value.trim() : "";

        if (errorMessage) errorMessage.textContent = "";

        // Reject empty fields
        if (!email || !password) {
            if (errorMessage) errorMessage.textContent = "Please enter both email address and password.";
            return;
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            if (errorMessage) errorMessage.textContent = "Please enter a valid email address (e.g. member@library.com).";
            return;
        }

        // Validate password length
        if (password.length < 6) {
            if (errorMessage) errorMessage.textContent = "Password must be at least 6 characters long.";
            return;
        }

        try {
            const response = await fetch("http://localhost:5000/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    identifier: email,
                    password: password,
                    role: "Member"
                })
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                if (errorMessage) errorMessage.textContent = result.message || "Invalid email or password.";
                return;
            }

            // Real backend session
            sessionStorage.setItem("token", result.token);
            localStorage.setItem("token", result.token);
            localStorage.setItem("isLoggedIn", "true");
            localStorage.setItem("memberEmail", result.user.email);
            localStorage.setItem("library_auth", JSON.stringify({
                memberId: result.user.id,
                email: result.user.email,
                fullName: result.user.name,
                membership: result.user.membership || "Student Member",
                memberSince: result.user.memberSince || "2025"
            }));

            // Seed initial profile
            const profileKey = `library_user_${result.user.id}_profile`;
            localStorage.setItem(profileKey, JSON.stringify({
                fullName: result.user.name,
                email: result.user.email,
                phone: result.user.phone || "+91 98765 43210",
                memberId: result.user.id,
                membership: result.user.membership || "Student Member",
                memberSince: result.user.memberSince || "2025"
            }));

            // Redirect to dashboard
            window.location.href = "pages/dashboard.html";
        } catch (err) {
            console.error(err);
            if (errorMessage) errorMessage.textContent = "Unable to connect to authentication server.";
        }
    });
});

// Show / Hide password toggle
function togglePassword() {
    const passwordInput = document.getElementById("password");
    const eyeIcon = document.getElementById("eyeIcon");
    if (!passwordInput || !eyeIcon) return;

    if (passwordInput.type === "password") {
        passwordInput.type = "text";
        eyeIcon.classList.remove("fa-eye");
        eyeIcon.classList.add("fa-eye-slash");
    } else {
        passwordInput.type = "password";
        eyeIcon.classList.remove("fa-eye-slash");
        eyeIcon.classList.add("fa-eye");
    }
}
