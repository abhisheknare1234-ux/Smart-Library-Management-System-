// ===============================
// MEMBER AUTHENTICATION SYSTEM
// ===============================

let _isSubmitting = false; // prevent double submissions

document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("loginForm");
    if (!loginForm) return;

    const loginButton = loginForm.querySelector("button[type='submit']");
    const rememberCheckbox = document.getElementById("rememberMe");

    // If remembered credentials exist (email only), populate
    try {
        const remembered = JSON.parse(localStorage.getItem("library_remember"));
        if (remembered && remembered.email) {
            const emailInput = document.getElementById("email");
            if (emailInput) emailInput.value = remembered.email;
            if (rememberCheckbox) rememberCheckbox.checked = true;
        }
    } catch (_) { }

    // If already logged in -> redirect to dashboard (preserve behavior)
    if (localStorage.getItem("isLoggedIn") === "true") {
        window.location.href = "pages/dashboard.html";
        return;
    }

    // Attach password toggle handler via addEventListener instead of inline onclick
    const pwToggleBtn = loginForm.querySelector('.password-toggle');
    if (pwToggleBtn) pwToggleBtn.addEventListener('click', togglePassword);

    loginForm.addEventListener("submit", function (event) {
        event.preventDefault();
        if (_isSubmitting) return; // prevent multiple requests
        _isSubmitting = true;
        if (loginButton) {
            loginButton.disabled = true;
            loginButton.setAttribute("aria-disabled", "true");
        }

        const emailInput = document.getElementById("email");
        const passwordInput = document.getElementById("password");
        const errorMessage = document.getElementById("errorMessage");

        const email = emailInput ? emailInput.value.trim().toLowerCase() : "";
        const password = passwordInput ? passwordInput.value.trim() : "";

        if (errorMessage) errorMessage.textContent = "";

        // Reject empty fields (BUG-016)
        if (!email || !password) {
            if (errorMessage) errorMessage.textContent = "Please enter both email address and password.";
            _isSubmitting = false;
            if (loginButton) { loginButton.disabled = false; loginButton.removeAttribute("aria-disabled"); }
            return;
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            if (errorMessage) errorMessage.textContent = "Please enter a valid email address (e.g. member@library.com).";
            _isSubmitting = false;
            if (loginButton) { loginButton.disabled = false; loginButton.removeAttribute("aria-disabled"); }
            return;
        }

        // Validate password length
        if (password.length < 6) {
            if (errorMessage) errorMessage.textContent = "Password must be at least 6 characters long.";
            _isSubmitting = false;
            if (loginButton) { loginButton.disabled = false; loginButton.removeAttribute("aria-disabled"); }
            return;
        }

        // Generate stable memberId from email
        const sanitizedId = email.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        const memberId = `member-${sanitizedId || "demo"}`;
        const namePart = email.split("@")[0] || "Member";
        const fullName = namePart.charAt(0).toUpperCase() + namePart.slice(1);

        // Remember me -> store email only
        try {
            if (rememberCheckbox && rememberCheckbox.checked) {
                localStorage.setItem("library_remember", JSON.stringify({ email }));
            } else {
                localStorage.removeItem("library_remember");
            }
        } catch (_) { }

        // Store authenticated session (minimal info)
        try {
            localStorage.setItem("isLoggedIn", "true");
            localStorage.setItem("memberEmail", email);
            // session token with expiry (client-side simulated)
            const session = {
                memberId,
                email,
                fullName,
                membership: "Student Member",
                memberSince: "2025",
                createdAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 6).toISOString() // 6 hours
            };
            localStorage.setItem("library_auth", JSON.stringify(session));
        } catch (_) { }

        // Seed initial profile if not present
        const profileKey = `library_user_${memberId}_profile`;
        if (!localStorage.getItem(profileKey)) {
            try {
                localStorage.setItem(profileKey, JSON.stringify({
                    fullName,
                    email,
                    phone: "+91 98765 43210",
                    memberId,
                    membership: "Student Member",
                    memberSince: "2025"
                }));
            } catch (_) { }
        }

        // Small delay to simulate processing then redirect
        setTimeout(() => {
            _isSubmitting = false;
            if (loginButton) { loginButton.disabled = false; loginButton.removeAttribute("aria-disabled"); }
            window.location.href = "pages/dashboard.html";
        }, 300);
    });
});

// Show / Hide password toggle
function togglePassword() {
    const passwordInput = document.getElementById("password");
    const eyeIcon = document.getElementById("eyeIcon");
    const btn = document.querySelector(".password-toggle");
    if (!passwordInput || !eyeIcon || !btn) return;

    const isHidden = passwordInput.type === "password";
    passwordInput.type = isHidden ? "text" : "password";

    eyeIcon.classList.toggle("fa-eye", !isHidden);
    eyeIcon.classList.toggle("fa-eye-slash", isHidden);

    // Accessibility
    btn.setAttribute("aria-pressed", String(isHidden));
    passwordInput.focus();
}
