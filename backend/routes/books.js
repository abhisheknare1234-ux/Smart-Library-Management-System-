const express = require("express");
const pool = require("../config/db");
const { requireAuth, requireRole } = require("../middleware/auth");
const { nextId, isValidISBN, isValidCategory, sanitizeString, formatCopyId, formatBarcode } = require("../utils/helpers");
const { logAudit } = require("./auth");

const router = express.Router();

function mapBook(row) {
    return {
        id: row.id,
        name: row.title,
        title: row.title,
        author: row.author,
        category: row.category,
        categoryLabel: row.category,
        publisher: row.publisher,
        isbn: row.isbn,
        published: row.published_year,
        pages: row.pages,
        description: row.description,
        image: row.image_url,
        location: row.location,
        shelf: row.shelf,
        rating: row.rating,
        reviews: row.reviews_count ? `${row.reviews_count} Reviews` : "0 Reviews",
        reviews_count: row.reviews_count,
        quantity: row.total_quantity,
        totalCopies: row.total_quantity,
        availableCopies: row.available_quantity,
        availableQuantity: row.available_quantity,
    };
}

function mapCopy(row) {
    return {
        id: row.id,
        bookId: row.book_id,
        copyNumber: row.copy_number,
        barcode: row.barcode,
        status: row.status,
        conditionNotes: row.condition_notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function validateBookInput(b, isUpdate = false) {
    const errors = [];
    const title = b.name || b.title;
    const author = b.author;
    const category = b.category;
    const isbn = b.isbn;
    const published = b.published || b.published_year;
    const pages = b.pages;
    const quantity = b.quantity ?? b.totalCopies;

    if (!isUpdate || title !== undefined) {
        if (!title || !String(title).trim()) {
            errors.push("Book title is required.");
        } else if (String(title).trim().length > 255) {
            errors.push("Book title must be 255 characters or less.");
        }
    }
    if (!isUpdate || author !== undefined) {
        if (!author || !String(author).trim()) {
            errors.push("Author is required.");
        } else if (String(author).trim().length > 255) {
            errors.push("Author must be 255 characters or less.");
        }
    }
    if (category !== undefined && category !== null && !isValidCategory(category)) {
        errors.push("Invalid category.");
    }
    if (isbn !== undefined && isbn !== null && !isValidISBN(isbn)) {
        errors.push("Invalid ISBN format. Use ISBN-10 or ISBN-13.");
    }
    if (published !== undefined && published !== null) {
        const year = Number(published);
        if (isNaN(year) || year < 1000 || year > new Date().getFullYear() + 1) {
            errors.push(`Published year must be a valid year between 1000 and ${new Date().getFullYear() + 1}.`);
        }
    }
    if (pages !== undefined && pages !== null) {
        const p = Number(pages);
        if (isNaN(p) || p < 1 || p > 10000) {
            errors.push("Pages must be a number between 1 and 10000.");
        }
    }
    if (!isUpdate || quantity !== undefined) {
        const q = Number(quantity ?? 0);
        if (isNaN(q) || q < 0 || q > 1000) {
            errors.push("Quantity must be a number between 0 and 1000.");
        }
    }
    return errors;
}

// GET /api/books — public catalog (search + category filter)
router.get("/", async (req, res) => {
    try {
        const { search, category, page, limit } = req.query;
        let sql = "SELECT * FROM books WHERE 1=1";
        const params = [];
        if (category && category !== "all") {
            sql += " AND LOWER(category) = LOWER(?)";
            params.push(category);
        }
        if (search) {
            sql += " AND (title LIKE ? OR author LIKE ? OR isbn LIKE ? OR id LIKE ?)";
            const like = `%${search}%`;
            params.push(like, like, like, like);
        }
        sql += " ORDER BY title ASC";

        if (limit) {
            const l = Math.max(1, parseInt(limit) || 10);
            const p = Math.max(1, parseInt(page) || 1);
            sql += ` LIMIT ${l} OFFSET ${(p - 1) * l}`;
        }

        const [rows] = await pool.query(sql, params);
        res.json({ success: true, books: rows.map(mapBook) });
    } catch (err) {
        console.error("Failed to load books:", err);
        res.status(500).json({ success: false, message: "Failed to load books." });
    }
});

// GET /api/books/:id — details
router.get("/:id", async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM books WHERE id = ?", [req.params.id]);
        if (!rows.length) return res.status(404).json({ success: false, message: "Book not found." });
        res.json({ success: true, book: mapBook(rows[0]) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Failed to load book." });
    }
});

// GET /api/books/:id/copies — list physical copies of a book
router.get("/:id/copies", async (req, res) => {
    try {
        const [rows] = await pool.query(
            "SELECT * FROM book_copies WHERE book_id = ? ORDER BY copy_number ASC",
            [req.params.id]
        );
        res.json({ success: true, copies: rows.map(mapCopy) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Failed to load book copies." });
    }
});

// POST /api/books — Admin or Librarian (creates book + physical copies)
router.post("/", requireAuth, requireRole("Admin", "Librarian"), async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const b = req.body;
        const errors = validateBookInput(b);
        if (errors.length) return res.status(400).json({ success: false, message: errors.join(" ") });

        const id = b.id && b.id.trim() ? b.id.trim() : await nextId(pool, "books", "B", 3);
        const [existing] = await conn.query("SELECT id FROM books WHERE id = ?", [id]);
        if (existing.length) return res.status(409).json({ success: false, message: `Book ID "${id}" already exists.` });

        const qty = Number(b.quantity ?? b.totalCopies ?? 1);

        await conn.beginTransaction();

        await conn.query(
            `INSERT INTO books (id, title, author, category, publisher, isbn, published_year, pages, description, image_url, location, shelf, total_quantity, available_quantity)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [
                id,
                sanitizeString(b.name || b.title),
                sanitizeString(b.author),
                sanitizeString(b.category || "Other"),
                sanitizeString(b.publisher || null),
                sanitizeString(b.isbn || null),
                b.published ? Number(b.published) : null,
                b.pages ? Number(b.pages) : null,
                sanitizeString(b.description || null),
                sanitizeString(b.image || b.imageUrl || "images/clean-code.jpeg"),
                sanitizeString(b.location || "Main Library - 1st Floor"),
                sanitizeString(b.shelf || "A-101"),
                qty,
                qty
            ]
        );

        // Generate physical copies
        for (let i = 1; i <= qty; i++) {
            const copyId = formatCopyId(id, i);
            const barcode = formatBarcode(id, i);
            await conn.query(
                `INSERT INTO book_copies (id, book_id, copy_number, barcode, status, condition_notes)
                 VALUES (?, ?, ?, ?, 'AVAILABLE', 'Good')`,
                [copyId, id, i, barcode]
            );
        }

        await conn.commit();
        await logAudit(req.user.role, req.user.id, "Book added", `${id} (${qty} copies)`);
        res.status(201).json({ 
            success: true, 
            message: "Book Added Successfully!", 
            id, 
            book: { id, title: b.title || b.name, author: b.author, category: b.category, quantity: qty },
            copiesCreated: qty 
        });
    } catch (err) {
        await conn.rollback();
        console.error("Add book error:", err);
        res.status(500).json({ success: false, message: "Failed to add book." });
    } finally {
        conn.release();
    }
});

// POST /api/books/:id/copies — Add additional physical copies
router.post("/:id/copies", requireAuth, requireRole("Admin", "Librarian"), async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const bookId = req.params.id;
        const count = Math.max(1, parseInt(req.body.count || 1));
        const condition = sanitizeString(req.body.condition || "Good");

        await conn.beginTransaction();

        const [books] = await conn.query("SELECT * FROM books WHERE id = ?", [bookId]);
        if (!books.length) {
            await conn.rollback();
            return res.status(404).json({ success: false, message: "Book not found." });
        }

        const [existingCopies] = await conn.query("SELECT MAX(copy_number) as maxCopy FROM book_copies WHERE book_id = ?", [bookId]);
        let nextNum = (existingCopies[0].maxCopy || 0) + 1;

        const newCopyIds = [];
        for (let i = 0; i < count; i++) {
            const copyId = formatCopyId(bookId, nextNum);
            const barcode = formatBarcode(bookId, nextNum);
            await conn.query(
                `INSERT INTO book_copies (id, book_id, copy_number, barcode, status, condition_notes)
                 VALUES (?, ?, ?, ?, 'AVAILABLE', ?)`,
                [copyId, bookId, nextNum, barcode, condition]
            );
            newCopyIds.push(copyId);
            nextNum++;
        }

        await conn.query(
            "UPDATE books SET total_quantity = total_quantity + ?, available_quantity = available_quantity + ? WHERE id = ?",
            [count, count, bookId]
        );

        await conn.commit();
        await logAudit(req.user.role, req.user.id, "Added copies", `${bookId}: +${count}`);
        res.status(201).json({ success: true, message: `${count} copy(ies) added successfully!`, copyIds: newCopyIds });
    } catch (err) {
        await conn.rollback();
        console.error("Add copies error:", err);
        res.status(500).json({ success: false, message: "Failed to add book copies." });
    } finally {
        conn.release();
    }
});

// PUT /api/books/copies/:copyId — Update physical copy condition or status
router.put("/copies/:copyId", requireAuth, requireRole("Admin", "Librarian"), async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const copyId = req.params.copyId;
        const { status, conditionNotes } = req.body;

        await conn.beginTransaction();

        const [copies] = await conn.query("SELECT * FROM book_copies WHERE id = ?", [copyId]);
        if (!copies.length) {
            await conn.rollback();
            return res.status(404).json({ success: false, message: "Physical copy not found." });
        }
        const copy = copies[0];

        const validStatuses = ["AVAILABLE", "ISSUED", "RESERVED", "LOST", "DAMAGED", "MAINTENANCE", "ARCHIVED"];
        if (status && !validStatuses.includes(status)) {
            await conn.rollback();
            return res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${validStatuses.join(", ")}.` });
        }

        // Adjust book available_quantity if moving to/from unavailable
        if (status && status !== copy.status) {
            if (copy.status === "AVAILABLE" && status !== "AVAILABLE") {
                await conn.query("UPDATE books SET available_quantity = MAX(0, available_quantity - 1) WHERE id = ?", [copy.book_id]);
            } else if (copy.status !== "AVAILABLE" && status === "AVAILABLE") {
                await conn.query("UPDATE books SET available_quantity = available_quantity + 1 WHERE id = ?", [copy.book_id]);
            }
        }

        await conn.query(
            "UPDATE book_copies SET status = ?, condition_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            [status || copy.status, conditionNotes !== undefined ? sanitizeString(conditionNotes) : copy.condition_notes, copyId]
        );

        await conn.commit();
        await logAudit(req.user.role, req.user.id, "Copy updated", `${copyId}: ${status || copy.status}`);
        res.json({ success: true, message: "Physical copy updated successfully!" });
    } catch (err) {
        await conn.rollback();
        console.error("Update copy error:", err);
        res.status(500).json({ success: false, message: "Failed to update copy." });
    } finally {
        conn.release();
    }
});

// PUT /api/books/:id — Admin or Librarian (updates book metadata)
router.put("/:id", requireAuth, requireRole("Admin", "Librarian"), async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM books WHERE id = ?", [req.params.id]);
        if (!rows.length) return res.status(404).json({ success: false, message: "Book not found." });
        const existing = rows[0];
        const b = req.body;

        const errors = validateBookInput(b, true);
        if (errors.length) return res.status(400).json({ success: false, message: errors.join(" ") });

        const newQty = b.quantity ?? b.totalCopies;
        let totalQty = existing.total_quantity;
        let availableQty = existing.available_quantity;

        if (newQty !== undefined) {
            const diff = Number(newQty) - existing.total_quantity;
            totalQty = Number(newQty);
            availableQty = Math.max(0, existing.available_quantity + diff);
        }

        await pool.query(
            `UPDATE books SET title=?, author=?, category=?, publisher=?, isbn=?, published_year=?, pages=?, description=?, image_url=?, location=?, shelf=?, total_quantity=?, available_quantity=?, updated_at=CURRENT_TIMESTAMP
             WHERE id=?`,
            [
                sanitizeString(b.name || b.title || existing.title),
                sanitizeString(b.author || existing.author),
                sanitizeString(b.category ?? existing.category),
                sanitizeString(b.publisher ?? existing.publisher),
                sanitizeString(b.isbn ?? existing.isbn),
                b.published !== undefined ? (b.published ? Number(b.published) : null) : existing.published_year,
                b.pages !== undefined ? (b.pages ? Number(b.pages) : null) : existing.pages,
                sanitizeString(b.description ?? existing.description),
                sanitizeString(b.image ?? b.imageUrl ?? existing.image_url),
                sanitizeString(b.location ?? existing.location),
                sanitizeString(b.shelf ?? existing.shelf),
                totalQty,
                availableQty,
                req.params.id
            ]
        );
        await logAudit(req.user.role, req.user.id, "Book updated", req.params.id);
        res.json({ success: true, message: "Book Updated Successfully!" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Failed to update book." });
    }
});

// DELETE /api/books/:id — Admin or Librarian
router.delete("/:id", requireAuth, requireRole("Admin", "Librarian"), async (req, res) => {
    try {
        const [active] = await pool.query("SELECT id FROM issues WHERE book_id = ? AND status = 'Active'", [req.params.id]);
        if (active.length) {
            return res.status(409).json({ success: false, message: "Cannot delete: this book currently has active loans." });
        }
        await pool.query("DELETE FROM books WHERE id = ?", [req.params.id]);
        await logAudit(req.user.role, req.user.id, "Book deleted", req.params.id);
        res.json({ success: true, message: "Book Deleted Successfully!" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Failed to delete book." });
    }
});

module.exports = router;
