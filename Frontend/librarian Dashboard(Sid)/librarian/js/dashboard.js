// ==========================================
// LIBRARIAN DASHBOARD SCRIPT
// Real Backend Data & Clean SaaS Architecture
// ==========================================

const API_BASE = "http://localhost:5000/api";

function getToken() {
    return sessionStorage.getItem("token");
}

function getUser() {
    try {
        return JSON.parse(sessionStorage.getItem("user")) || null;
    } catch (_) {
        return null;
    }
}

// Route guard
if (!getToken()) {
    window.location.href = "login.html";
}

document.addEventListener("DOMContentLoaded", function () {
    // 1. Populate Librarian Profile Header
    initProfile();

    // 2. Load Dashboard Statistics & Recent Circulation Activity
    loadDashboardData();

    // 3. Setup Logout Handlers
    document.querySelectorAll(".logout-btn, #logoutBtn, .sidebar-footer a").forEach(btn => {
        btn.addEventListener("click", function (e) {
            e.preventDefault();
            sessionStorage.clear();
            localStorage.removeItem("token");
            window.location.href = "login.html";
        });
    });
});

function initProfile() {
    const user = getUser();
    if (user) {
        const nameEls = document.querySelectorAll(".profile-name, #staffName");
        const roleEls = document.querySelectorAll(".profile-role, #staffRole");
        const avatarEls = document.querySelectorAll(".profile-avatar, #staffAvatar");

        nameEls.forEach(el => el.textContent = user.name || "Librarian");
        roleEls.forEach(el => el.textContent = user.role || "Circulation Staff");
        avatarEls.forEach(el => {
            const initial = (user.name || "L").charAt(0).toUpperCase();
            el.textContent = initial;
        });
    }
}

async function loadDashboardData() {
    const tableBody = document.querySelector(".data-table tbody, .issue-table tbody, #recentIssuesBody");

    try {
        const response = await fetch(`${API_BASE}/stats/librarian`, {
            headers: {
                "Authorization": `Bearer ${getToken()}`
            }
        });

        if (response.status === 401 || response.status === 403) {
            sessionStorage.clear();
            window.location.href = "login.html";
            return;
        }

        if (!response.ok) throw new Error("Failed to load librarian stats");
        const result = await response.json();
        const stats = result.stats || {};

        // Update Operational KPI Badges
        setElementText("totalBooks", Number(stats.totalBooks || 0).toLocaleString());
        setElementText("availableBooks", Number(stats.availableBooks || 0).toLocaleString());
        setElementText("totalStudents", Number(stats.totalStudents || 0).toLocaleString());
        setElementText("issuedToday", Number(stats.issuedToday || 0).toLocaleString());
        setElementText("dueToday", Number(stats.dueToday || 0).toLocaleString());
        setElementText("overdueCount", Number(stats.overdue || 0).toLocaleString());
        setElementText("pendingFines", "₹" + Number(stats.pendingFines || 0).toLocaleString());

        // Render Recent Activity Feed
        if (tableBody) {
            renderRecentIssues(tableBody, result.recentIssues || []);
        }
    } catch (err) {
        console.error("Dashboard error:", err);
        if (tableBody) {
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 24px; color: var(--color-text-muted);">Could not fetch recent transactions.</td></tr>`;
        }
    }
}

function setElementText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function renderRecentIssues(tbody, issues) {
    tbody.innerHTML = "";

    if (!issues || issues.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 32px; color: var(--color-text-muted);">
                    <i class="fa-solid fa-inbox" style="font-size: 2rem; margin-bottom: 8px; display: block; opacity: 0.5;"></i>
                    No circulation activity recorded yet today.
                </td>
            </tr>
        `;
        return;
    }

    issues.forEach(issue => {
        const tr = document.createElement("tr");
        const isOverdue = issue.status === "Active" && issue.due_date && new Date(issue.due_date) < new Date();
        const statusBadgeClass = isOverdue ? "status overdue" : (issue.status === "Active" ? "status pending" : "status active");
        const statusLabel = isOverdue ? "Overdue" : (issue.status === "Active" ? "Borrowed" : "Returned");

        tr.innerHTML = `
            <td><strong>#${issue.id}</strong></td>
            <td>
                <div style="font-weight: 600; color: var(--color-text);">${escapeHtml(issue.title || "Book")}</div>
                <small style="color: var(--color-text-muted);">${escapeHtml(issue.author || "")}</small>
            </td>
            <td>${escapeHtml(issue.member_name || "Student")}</td>
            <td>${formatDate(issue.issue_date)}</td>
            <td>${formatDate(issue.due_date)}</td>
            <td><span class="${statusBadgeClass}">${statusLabel}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

function formatDate(dateStr) {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
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