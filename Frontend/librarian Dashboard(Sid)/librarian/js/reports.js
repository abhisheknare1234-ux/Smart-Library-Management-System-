// ==========================================
// LIBRARIAN REPORTS
// Powered by Library Hub Backend API (LibAPI)
// ==========================================

const LibAPI = window.LibAPI;

// Elements
const reportBooks = document.getElementById("reportBooks");
const reportStudents = document.getElementById("reportStudents");
const reportIssued = document.getElementById("reportIssued");
const reportFine = document.getElementById("reportFine");
const reportType = document.getElementById("reportType");
const reportTitle = document.getElementById("reportTitle");
const reportHead = document.getElementById("reportHead");
const reportBody = document.getElementById("reportBody");
const searchReport = document.getElementById("searchReport");

let currentReportData = [];

// Load Summary Tiles from real backend
async function loadDashboard() {
    try {
        const stats = await LibAPI.getStats();
        if (reportBooks) reportBooks.textContent = stats.totalBooks || 0;
        if (reportStudents) reportStudents.textContent = stats.totalStudents || 0;

        const activeIssues = await LibAPI.getIssues("Active");
        if (reportIssued) reportIssued.textContent = activeIssues.length;

        const fines = await LibAPI.getFines();
        const totalFine = fines.reduce((sum, f) => sum + Number(f.amount || f.fineAmount || 0), 0);
        if (reportFine) reportFine.textContent = "₹" + totalFine.toLocaleString();
    } catch (err) {
        console.error("Failed to load reports summary:", err);
    }
}

// Load Report Table by Type
async function loadReport(type) {
    if (!reportHead || !reportBody) return;
    reportHead.innerHTML = "";
    reportBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px;">Loading report data...</td></tr>`;

    try {
        switch (type) {
            case "books":
                await loadBooksReport();
                break;
            case "students":
                await loadStudentsReport();
                break;
            case "issued":
                await loadIssuedReport();
                break;
            case "returned":
                await loadReturnedReport();
                break;
            case "fines":
                await loadFineReport();
                break;
            default:
                await loadBooksReport();
        }
    } catch (err) {
        console.error("Report load error:", err);
        reportBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: red; padding: 20px;">Failed to load report data.</td></tr>`;
    }
}

async function loadBooksReport() {
    if (reportTitle) reportTitle.textContent = "Books Inventory Report";
    reportHead.innerHTML = `
        <tr>
            <th>Book ID</th>
            <th>Title</th>
            <th>Author</th>
            <th>Category</th>
            <th>Location</th>
            <th>Total Copies</th>
            <th>Available Copies</th>
        </tr>
    `;

    const books = await LibAPI.getBooks();
    currentReportData = books;
    renderBooksRows(books);
}

function renderBooksRows(list) {
    reportBody.innerHTML = "";
    if (!list.length) {
        reportBody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 20px; color: #64748b;">No books found.</td></tr>`;
        return;
    }
    list.forEach(book => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${book.id}</td>
            <td><strong>${book.name || book.title}</strong></td>
            <td>${book.author}</td>
            <td>${book.category}</td>
            <td>${book.location || 'Main Library'} (${book.shelf || 'A-101'})</td>
            <td>${book.totalQuantity || book.quantity}</td>
            <td><span style="color: ${book.availableCopies > 0 ? '#16a34a' : '#dc2626'}; font-weight: 600;">${book.availableCopies}</span></td>
        `;
        reportBody.appendChild(row);
    });
}

async function loadStudentsReport() {
    if (reportTitle) reportTitle.textContent = "Members / Students Directory Report";
    reportHead.innerHTML = `
        <tr>
            <th>Member ID</th>
            <th>Name</th>
            <th>Department / Course</th>
            <th>Type</th>
            <th>Phone</th>
            <th>Status</th>
        </tr>
    `;

    const students = await LibAPI.getStudents();
    currentReportData = students;
    renderStudentsRows(students);
}

function renderStudentsRows(list) {
    reportBody.innerHTML = "";
    if (!list.length) {
        reportBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: #64748b;">No students found.</td></tr>`;
        return;
    }
    list.forEach(s => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${s.id}</td>
            <td>${s.name}</td>
            <td>${s.course || s.department || "General"}</td>
            <td>${s.year || s.type || "Student"}</td>
            <td>${s.phone || "-"}</td>
            <td><span class="status ${s.status === 'Active' ? 'active' : 'inactive'}">${s.status || 'Active'}</span></td>
        `;
        reportBody.appendChild(row);
    });
}

async function loadIssuedReport() {
    if (reportTitle) reportTitle.textContent = "Active Book Loans Report";
    reportHead.innerHTML = `
        <tr>
            <th>Loan ID</th>
            <th>Member</th>
            <th>Book Title</th>
            <th>Physical Copy</th>
            <th>Issue Date</th>
            <th>Due Date</th>
            <th>Status</th>
        </tr>
    `;

    const issues = await LibAPI.getIssues("Active");
    currentReportData = issues;
    renderIssuesRows(issues);
}

async function loadReturnedReport() {
    if (reportTitle) reportTitle.textContent = "Returned Books History Report";
    reportHead.innerHTML = `
        <tr>
            <th>Loan ID</th>
            <th>Member</th>
            <th>Book Title</th>
            <th>Issue Date</th>
            <th>Return Date</th>
            <th>Fine Incurred</th>
            <th>Status</th>
        </tr>
    `;

    const issues = await LibAPI.getIssues("Returned");
    currentReportData = issues;
    renderReturnedRows(issues);
}

function renderIssuesRows(list) {
    reportBody.innerHTML = "";
    if (!list.length) {
        reportBody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 20px; color: #64748b;">No active loans found.</td></tr>`;
        return;
    }
    list.forEach(i => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>#${i.id || i.issueId}</td>
            <td>${i.studentName || i.memberName || i.studentId}</td>
            <td>${i.bookName || i.bookTitle}</td>
            <td>${i.copyId || "Standard"}</td>
            <td>${i.issueDate || 'N/A'}</td>
            <td>${i.dueDate || i.returnDate || 'N/A'}</td>
            <td><span class="status active">${i.status}</span></td>
        `;
        reportBody.appendChild(row);
    });
}

function renderReturnedRows(list) {
    reportBody.innerHTML = "";
    if (!list.length) {
        reportBody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 20px; color: #64748b;">No returned records found.</td></tr>`;
        return;
    }
    list.forEach(i => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>#${i.id || i.issueId}</td>
            <td>${i.studentName || i.memberName || i.studentId}</td>
            <td>${i.bookName || i.bookTitle}</td>
            <td>${i.issueDate || 'N/A'}</td>
            <td>${i.actualReturnDate || i.returnDate || 'N/A'}</td>
            <td>₹${i.fine || i.fineAmount || 0}</td>
            <td><span class="status active">Returned</span></td>
        `;
        reportBody.appendChild(row);
    });
}

async function loadFineReport() {
    if (reportTitle) reportTitle.textContent = "Fines & Penalties Report";
    reportHead.innerHTML = `
        <tr>
            <th>Fine ID</th>
            <th>Member</th>
            <th>Book</th>
            <th>Due Date</th>
            <th>Fine Amount</th>
            <th>Payment Status</th>
        </tr>
    `;

    const fines = await LibAPI.getFines();
    currentReportData = fines;
    renderFinesRows(fines);
}

function renderFinesRows(list) {
    reportBody.innerHTML = "";
    if (!list.length) {
        reportBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: #64748b;">No fine records found.</td></tr>`;
        return;
    }
    list.forEach(f => {
        const isPaid = f.status === "Paid";
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>#${f.fineId || f.issueId}</td>
            <td>${f.studentName || f.memberName || f.memberId}</td>
            <td>${f.bookName || f.book}</td>
            <td>${f.dueDate || f.createdDate || 'N/A'}</td>
            <td>₹${f.fineAmount || f.amount}</td>
            <td><span class="status ${isPaid ? 'active' : 'pending'}">${f.status}</span></td>
        `;
        reportBody.appendChild(row);
    });
}

// Event Listeners
if (reportType) {
    reportType.addEventListener("change", function () {
        loadReport(reportType.value);
    });
}

if (searchReport) {
    searchReport.addEventListener("input", function () {
        const q = searchReport.value.trim().toLowerCase();
        if (!q) {
            loadReport(reportType ? reportType.value : "books");
            return;
        }
        const filtered = currentReportData.filter(item => {
            return Object.values(item).some(val =>
                val && String(val).toLowerCase().includes(q)
            );
        });
        const type = reportType ? reportType.value : "books";
        if (type === "books") renderBooksRows(filtered);
        else if (type === "students") renderStudentsRows(filtered);
        else if (type === "issued") renderIssuesRows(filtered);
        else if (type === "returned") renderReturnedRows(filtered);
        else if (type === "fines") renderFinesRows(filtered);
    });
}

// Initial Load
document.addEventListener("DOMContentLoaded", async function () {
    await loadDashboard();
    await loadReport(reportType ? reportType.value : "books");
});
