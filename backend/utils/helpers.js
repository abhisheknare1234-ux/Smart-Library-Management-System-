const pool = require("../config/db");

const DEFAULT_FINE_PER_DAY = 5; // rupees per day overdue
const DEFAULT_LOAN_DAYS = 15;   // default loan period in days
const DEFAULT_MAX_BOOKS = 3;
const DEFAULT_MAX_RENEWALS = 2;

async function getSetting(dbPool, key, defaultValue) {
    try {
        const [rows] = await dbPool.query("SELECT setting_value FROM library_settings WHERE setting_key = ?", [key]);
        if (rows.length && rows[0].setting_value !== undefined && rows[0].setting_value !== null) {
            return rows[0].setting_value;
        }
    } catch (_) {}
    return defaultValue;
}

function isValidEmail(email) {
    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(String(email || "").trim());
}

function isValidPhone(phone) {
    const cleaned = String(phone || "").replace(/[\s\-()+]/g, "");
    return /^\d{7,15}$/.test(cleaned);
}

function isValidName(name) {
    const trimmed = String(name || "").trim();
    return trimmed.length >= 2 && /^[a-zA-Z\s.'-]+$/.test(trimmed);
}

function isValidISBN(isbn) {
    if (!isbn) return true; // ISBN is optional
    const cleaned = String(isbn).replace(/[-\s]/g, "");
    // ISBN-10 or ISBN-13
    return /^(\d{9}[\dX]|\d{13})$/i.test(cleaned);
}

function isValidCategory(category) {
    if (!category) return true;
    const validCategories = [
        "Programming", "Database", "Networking", "Operating Systems",
        "Artificial Intelligence", "Computer Science", "Finance",
        "Fiction", "Self Development", "Science", "Mathematics",
        "Physics", "Chemistry", "Biology", "History", "Literature",
        "Other"
    ];
    return validCategories.includes(category) || category.length <= 100;
}

function sanitizeString(str, maxLength = 255) {
    if (typeof str !== "string") return "";
    return str.trim().slice(0, maxLength);
}

function sanitizeHtml(str) {
    if (typeof str !== "string") return "";
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Generates sequential ID for a table, e.g. nextId(pool, "books", "B", 3) -> "B021"
async function nextId(dbPool, table, prefix, padLength = 3) {
    const [rows] = await dbPool.query(
        "SELECT id FROM " + table + " WHERE id LIKE ? ORDER BY LENGTH(id) DESC, id DESC LIMIT 1",
        [prefix + "%"]
    );
    if (!rows.length) return prefix + "1".padStart(padLength, "0");
    const lastNum = parseInt(String(rows[0].id).replace(prefix, ""), 10) || 0;
    return prefix + String(lastNum + 1).padStart(padLength, "0");
}

function formatCopyId(bookId, copyNumber) {
    return `BC-${bookId}-${String(copyNumber).padStart(2, "0")}`;
}

function formatBarcode(bookId, copyNumber) {
    return `BAR-${bookId}-${String(copyNumber).padStart(3, "0")}`;
}

function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + Number(days));
    return d;
}

function toDateOnly(date) {
    if (!date) return null;
    const d = new Date(date);
    if (isNaN(d.getTime())) return String(date).slice(0, 10);
    return d.toISOString().slice(0, 10);
}

function calcFine(dueDate, returnDate = new Date(), finePerDay = DEFAULT_FINE_PER_DAY) {
    const due = new Date(toDateOnly(dueDate) + "T00:00:00");
    const ret = new Date(toDateOnly(returnDate) + "T00:00:00");
    const overdueDays = Math.max(0, Math.ceil((ret - due) / 86400000));
    return { overdueDays, fineAmount: overdueDays * Number(finePerDay) };
}

module.exports = {
    DEFAULT_FINE_PER_DAY,
    DEFAULT_LOAN_DAYS,
    DEFAULT_MAX_BOOKS,
    DEFAULT_MAX_RENEWALS,
    getSetting,
    isValidEmail,
    isValidPhone,
    isValidName,
    isValidISBN,
    isValidCategory,
    sanitizeString,
    sanitizeHtml,
    nextId,
    formatCopyId,
    formatBarcode,
    addDays,
    toDateOnly,
    calcFine,
};