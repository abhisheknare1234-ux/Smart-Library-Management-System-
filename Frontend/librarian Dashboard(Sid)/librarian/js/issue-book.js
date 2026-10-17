// ==========================================================================
// Librarian Issue Book Workflow
// High-Speed Circulation Desk Connected Directly to Live Backend API
// ==========================================================================

const API_BASE = "http://localhost:5000/api";

function getToken() {
    return sessionStorage.getItem("token");
}

let students = [];
let books = [];
let allIssues = [];

if (!getToken()) {
    window.location.href = "login.html";
}

document.addEventListener("DOMContentLoaded", async function () {
    initLibrarianProfile();
    initDatePickers();

    // Load Data Concurrently
    await Promise.all([
        loadStudentsRegistry(),
        loadBooksCatalog(),
        loadIssuesTable()
    ]);

    // Attach Event Handlers
    setupFormEvents();
    setupSearchFilter();
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

function initDatePickers() {
    const today = new Date();
    const issueInput = document.getElementById("issueDate");
    const returnInput = document.getElementById("returnDate");

    const dueDate = new Date();
    dueDate.setDate(today.getDate() + 14);

    if (issueInput) issueInput.value = today.toISOString().slice(0, 10);
    if (returnInput) returnInput.value = dueDate.toISOString().slice(0, 10);
}

// 1. Fetch Students
async function loadStudentsRegistry() {
    const select = document.getElementById("studentSelect");
    try {
        const res = await fetch(`${API_BASE}/members?limit=200`, {
            headers: { "Authorization": `Bearer ${getToken()}` }
        });
        if (!res.ok) throw new Error("Failed to fetch students");
        const data = await res.json();
        students = data.members || [];

        select.innerHTML = `<option value="">-- Choose Registered Student (${students.length} found) --</option>`;
        students.forEach(s => {
            select.innerHTML += `<option value="${s.id}">${escapeHtml(s.name)} (${s.id}) — ${s.department || "General"}</option>`;
        });
    } catch (err) {
        console.error("Students error:", err);
        select.innerHTML = `<option value="">Error loading student directory</option>`;
    }
}

// 2. Fetch Books
async function loadBooksCatalog() {
    const select = document.getElementById("bookSelect");
    try {
        const res = await fetch(`${API_BASE}/books?limit=200`, {
            headers: { "Authorization": `Bearer ${getToken()}` }
        });
        if (!res.ok) throw new Error("Failed to fetch books");
        const data = await res.json();
        books = data.books || [];

        select.innerHTML = `<option value="">-- Choose Book Title (${books.length} found) --</option>`;
        books.forEach(b => {
            const avail = b.availableQuantity ?? b.availableCopies ?? 0;
            const availText = avail > 0 ? `${avail} copies available` : `Currently Out of Stock`;
            select.innerHTML += `<option value="${b.id}" ${avail <= 0 ? 'disabled' : ''}>
                ${escapeHtml(b.title)} by ${escapeHtml(b.author || "Unknown")} [${availText}]
            </option>`;
        });
    } catch (err) {
        console.error("Books error:", err);
        select.innerHTML = `<option value="">Error loading book catalog</option>`;
    }
}

// 3. Fetch Issues Table
async function loadIssuesTable() {
    const tbody = document.getElementById("issuesTableBody");
    const countEl = document.getElementById("totalIssuedCount");

    try {
        const res = await fetch(`${API_BASE}/issues?limit=100`, {
            headers: { "Authorization": `Bearer ${getToken()}` }
        });
        if (!res.ok) throw new Error("Failed to load issues");
        const data = await res.json();
        allIssues = data.issues || [];

        if (countEl) countEl.textContent = allIssues.length;
        renderIssuesRows(allIssues);
    } catch (err) {
        console.error("Issues table error:", err);
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--color-danger); padding: 20px;">Could not load active loans.</td></tr>`;
    }
}

function renderIssuesRows(issues) {
    const tbody = document.getElementById("issuesTableBody");
    tbody.innerHTML = "";

    if (!issues.length) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 28px; color: var(--color-text-muted);">No matching loan records found.</td></tr>`;
        return;
    }

    issues.forEach(issue => {
        const tr = document.createElement("tr");
        const isOverdue = issue.status === "Active" && issue.dueDate && new Date(issue.dueDate) < new Date();
        const badgeClass = isOverdue ? "status overdue" : (issue.status === "Active" ? "status pending" : "status active");
        const statusLabel = isOverdue ? "Overdue" : (issue.status === "Active" ? "Active" : "Returned");

        tr.innerHTML = `
            <td><strong>#${issue.id}</strong></td>
            <td>${escapeHtml(issue.studentName || issue.memberId)}</td>
            <td>${escapeHtml(issue.bookTitle || issue.bookName || "Book")}</td>
            <td>${issue.issueDate || "—"}</td>
            <td>${issue.dueDate || "—"}</td>
            <td><span class="${badgeClass}">${statusLabel}</span></td>
            <td>
                ${issue.status === "Active" 
                    ? `<a href="return-book.html?issueId=${issue.id}" class="return-btn" style="text-decoration:none; padding: 4px 10px; font-size: 0.78rem;">
                         <i class="fa-solid fa-rotate-left"></i> Return
                       </a>` 
                    : `<span style="color: var(--color-text-muted); font-size: 0.8rem;">Completed</span>`}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function setupFormEvents() {
    const studentSelect = document.getElementById("studentSelect");
    const bookSelect = document.getElementById("bookSelect");
    const form = document.getElementById("issueForm");
    const submitBtn = document.getElementById("submitIssueBtn");

    // Dynamic Student info
    studentSelect.addEventListener("change", function () {
        const student = students.find(s => String(s.id) === String(this.value));
        const box = document.getElementById("studentDetailBox");
        if (student) {
            document.getElementById("dispStudentId").textContent = student.id;
            document.getElementById("dispStudentDept").textContent = student.department || "General";
            document.getElementById("dispStudentPhone").textContent = student.phone || "Not recorded";
            box.style.display = "flex";
        } else {
            box.style.display = "none";
        }
    });

    // Dynamic Book info
    bookSelect.addEventListener("change", function () {
        const book = books.find(b => String(b.id) === String(this.value));
        const box = document.getElementById("bookDetailBox");
        if (book) {
            document.getElementById("dispBookAuthor").textContent = book.author || "Unknown";
            document.getElementById("dispBookCategory").textContent = book.category || "General";
            const copies = book.availableQuantity ?? book.availableCopies ?? 0;
            document.getElementById("dispBookCopies").textContent = `${copies} available`;
            box.style.display = "flex";
        } else {
            box.style.display = "none";
        }
    });

    // Form Submission
    form.addEventListener("submit", async function (e) {
        e.preventDefault();

        const memberId = studentSelect.value;
        const bookId = bookSelect.value;
        const issueDate = document.getElementById("issueDate").value;
        const dueDate = document.getElementById("returnDate").value;

        if (!memberId || !bookId) {
            LibraryUI.showToast("Please select both a student and an available book.", "warning");
            return;
        }

        // Disable button while processing to prevent double-click
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Processing Loan...`;

        try {
            const res = await fetch(`${API_BASE}/issues`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${getToken()}`
                },
                body: JSON.stringify({
                    member_id: memberId,
                    book_id: bookId,
                    issue_date: issueDate,
                    return_date: dueDate
                })
            });

            const result = await res.json();

            if (!res.ok) {
                LibraryUI.showToast(result.message || "Failed to issue book.", "error");
                return;
            }

            LibraryUI.showToast("Book issued successfully! Copy status locked.", "success");
            
            // Reset form
            form.reset();
            document.getElementById("studentDetailBox").style.display = "none";
            document.getElementById("bookDetailBox").style.display = "none";
            initDatePickers();

            // Refresh books and issues table
            await Promise.all([
                loadBooksCatalog(),
                loadIssuesTable()
            ]);
        } catch (err) {
            console.error("Issue error:", err);
            LibraryUI.showToast("Network error issuing book. Please check server.", "error");
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<i class="fa-solid fa-check"></i> Confirm Loan & Checkout`;
        }
    });
}

function setupSearchFilter() {
    const input = document.getElementById("searchIssue");
    if (!input) return;

    input.addEventListener("input", LibraryUI.debounce(function () {
        const q = input.value.trim().toLowerCase();
        if (!q) {
            renderIssuesRows(allIssues);
            return;
        }
        const filtered = allIssues.filter(i => 
            String(i.id).includes(q) ||
            (i.studentName && i.studentName.toLowerCase().includes(q)) ||
            (i.memberId && i.memberId.toLowerCase().includes(q)) ||
            (i.bookTitle && i.bookTitle.toLowerCase().includes(q)) ||
            (i.bookName && i.bookName.toLowerCase().includes(q))
        );
        renderIssuesRows(filtered);
    }, 250));
}

function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}