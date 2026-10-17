/**
 * Library Hub — Comprehensive Production-Ready Seed Script
 * Populates real bcrypt hashes, catalog books, physical copies, default members, librarians, settings, and sample loans.
 *
 * Usage: npm run seed
 */

require("dotenv").config();
const bcrypt = require("bcryptjs");
const pool = require("./config/db");
const migrate = require("./scripts/migrate");

async function seed() {
    // Ensure migrations are run first
    await migrate();

    console.log("[SEED] Seeding database...");

    const adminHash = await bcrypt.hash("admin123", 10);
    const librarianHash = await bcrypt.hash("librarian123", 10);
    const memberHash = await bcrypt.hash("member123", 10);

    // 1. Admins
    const [admins] = await pool.query("SELECT id FROM admins WHERE username = 'admin'");
    if (!admins.length) {
        await pool.query(
            "INSERT INTO admins (username, email, password_hash) VALUES (?, ?, ?)",
            ["admin", "admin@smartlibrary.com", adminHash]
        );
    } else {
        await pool.query("UPDATE admins SET password_hash = ? WHERE username = 'admin'", [adminHash]);
    }

    // 2. Librarians
    const librarians = [
        { id: "LIB001", name: "Soham Nagdeve", email: "soham@library.com", phone: "9988776655", address: "Central Library Office" },
        { id: "LIB002", name: "Priya Sharma", email: "priya@library.com", phone: "9988776656", address: "Branch Library Office" },
        { id: "LIB003", name: "Rajesh Kumar", email: "rajesh@library.com", phone: "9988776657", address: "Main Library Desk" },
    ];

    for (const lib of librarians) {
        const [existing] = await pool.query("SELECT id FROM librarians WHERE id = ?", [lib.id]);
        if (!existing.length) {
            await pool.query(
                "INSERT INTO librarians (id, name, email, phone, address, password_hash, status) VALUES (?, ?, ?, ?, ?, ?, 'Active')",
                [lib.id, lib.name, lib.email, lib.phone, lib.address, librarianHash]
            );
        } else {
            await pool.query("UPDATE librarians SET password_hash = ? WHERE id = ?", [librarianHash, lib.id]);
        }
    }

    // 3. Members
    const members = [
        { id: "MEM001", name: "Rahul Sharma", email: "rahul@gmail.com", phone: "9876543210", department: "Computer", type: "Student", membership: "Student Member" },
        { id: "MEM002", name: "Priya Patel", email: "priya@gmail.com", phone: "9123456789", department: "Library Science", type: "Faculty", membership: "Faculty Member" },
        { id: "MEM003", name: "Amit Kumar", email: "amit@gmail.com", phone: "9876500001", department: "Computer", type: "Student", membership: "Student Member" },
        { id: "MEM004", name: "Sneha Joshi", email: "sneha@gmail.com", phone: "9876500002", department: "Electronics", type: "Student", membership: "Student Member" },
        { id: "MEM005", name: "Dr. Rajesh Gupta", email: "rajesh@faculty.edu", phone: "9876500003", department: "Computer Science", type: "Faculty", membership: "Faculty Member" },
        { id: "MEM006", name: "Prof. Meera Singh", email: "meera@faculty.edu", phone: "9876500004", department: "Library Science", type: "Faculty", membership: "Faculty Member" },
        { id: "MEM007", name: "Vikram Patel", email: "vikram@general.com", phone: "9876500005", department: "General", type: "General", membership: "General Member" },
    ];

    for (const m of members) {
        const [existing] = await pool.query("SELECT id FROM members WHERE id = ?", [m.id]);
        if (!existing.length) {
            await pool.query(
                "INSERT INTO members (id, name, email, phone, department, type, password_hash, membership, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Active')",
                [m.id, m.name, m.email, m.phone, m.department, m.type, memberHash, m.membership]
            );
        } else {
            await pool.query("UPDATE members SET password_hash = ? WHERE id = ?", [memberHash, m.id]);
        }
    }

    // 4. Categories
    const categories = [
        "Programming", "Database", "Networking", "Operating Systems",
        "Artificial Intelligence", "Computer Science", "Finance",
        "Fiction", "Self Development", "Science", "Mathematics"
    ];
    for (const cat of categories) {
        const [existing] = await pool.query("SELECT id FROM categories WHERE name = ?", [cat]);
        if (!existing.length) {
            await pool.query("INSERT INTO categories (name, description) VALUES (?, ?)", [cat, `${cat} reference books and textbooks`]);
        }
    }

    // 5. Books Catalog
    const books = [
        { id: "B001", title: "Clean Code", author: "Robert C. Martin", category: "Programming", publisher: "Prentice Hall", isbn: "978-0132350884", published_year: 2008, pages: 464, description: "A handbook of agile software craftsmanship covering clean, readable, and maintainable code.", image_url: "images/clean-code.jpeg", location: "Main Library - 2nd Floor", shelf: "A-204", rating: 4.8, reviews_count: 245, total_quantity: 5, available_quantity: 5 },
        { id: "B002", title: "JavaScript: The Definitive Guide", author: "David Flanagan", category: "Programming", publisher: "O'Reilly Media", isbn: "978-1491952023", published_year: 2020, pages: 704, description: "A comprehensive reference to JavaScript, browser APIs, and modern web development.", image_url: "images/javascript.jpeg", location: "Main Library - 1st Floor", shelf: "P-102", rating: 4.7, reviews_count: 189, total_quantity: 6, available_quantity: 6 },
        { id: "B003", title: "Python Crash Course", author: "Eric Matthes", category: "Programming", publisher: "No Starch Press", isbn: "978-1593279288", published_year: 2019, pages: 544, description: "A hands-on introduction to Python programming and practical projects.", image_url: "images/python-crash-course.jpeg", location: "Main Library - 1st Floor", shelf: "P-108", rating: 4.8, reviews_count: 312, total_quantity: 5, available_quantity: 5 },
        { id: "B004", title: "Data Structures and Algorithms", author: "Michael T. Goodrich", category: "Programming", publisher: "Wiley", isbn: "978-1118290279", published_year: 2014, pages: 768, description: "An introduction to arrays, trees, graphs, sorting, searching, and algorithm analysis.", image_url: "images/data-structures.jpeg", location: "Main Library - 2nd Floor", shelf: "A-210", rating: 4.6, reviews_count: 156, total_quantity: 4, available_quantity: 4 },
        { id: "B005", title: "Introduction to Algorithms", author: "Thomas H. Cormen", category: "Programming", publisher: "MIT Press", isbn: "978-0262033848", published_year: 2009, pages: 1312, description: "A comprehensive textbook covering fundamental algorithms and data structures.", image_url: "images/introduction-to-algorithms.jpeg", location: "Main Library - 2nd Floor", shelf: "A-215", rating: 4.7, reviews_count: 278, total_quantity: 3, available_quantity: 3 },
        { id: "B006", title: "Database System Concepts", author: "Abraham Silberschatz", category: "Database", publisher: "McGraw-Hill", isbn: "978-0078022159", published_year: 2019, pages: 1376, description: "Comprehensive coverage of database architecture, SQL, transactions, and modern data technologies.", image_url: "images/database.jpeg", location: "Main Library - 2nd Floor", shelf: "D-301", rating: 4.6, reviews_count: 198, total_quantity: 5, available_quantity: 5 },
        { id: "B007", title: "The Alchemist", author: "Paulo Coelho", category: "Fiction", publisher: "HarperOne", isbn: "978-0062315007", published_year: 1988, pages: 208, description: "A story about dreams, purpose, and the courage to follow a personal legend.", image_url: "images/alchemist.jpeg", location: "Main Library - Ground Floor", shelf: "F-101", rating: 4.7, reviews_count: 420, total_quantity: 8, available_quantity: 8 },
        { id: "B008", title: "Harry Potter and the Philosopher's Stone", author: "J.K. Rowling", category: "Fiction", publisher: "Bloomsbury", isbn: "978-0747532699", published_year: 1997, pages: 223, description: "The first journey into Hogwarts and the magical world of Harry Potter.", image_url: "images/harry-potter.jpeg", location: "Main Library - Ground Floor", shelf: "F-115", rating: 4.9, reviews_count: 520, total_quantity: 10, available_quantity: 10 },
        { id: "B009", title: "Atomic Habits", author: "James Clear", category: "Self Development", publisher: "Avery", isbn: "978-0735211292", published_year: 2018, pages: 320, description: "A practical framework for building good habits and making lasting improvements.", image_url: "images/atomic-habits.jpeg", location: "Main Library - 1st Floor", shelf: "S-105", rating: 4.8, reviews_count: 650, total_quantity: 7, available_quantity: 7 },
        { id: "B010", title: "Ikigai", author: "Hector Garcia", category: "Self Development", publisher: "Penguin Books", isbn: "978-0143130727", published_year: 2016, pages: 208, description: "An exploration of purpose, happiness, and a meaningful life.", image_url: "images/ikigai.jpeg", location: "Main Library - 1st Floor", shelf: "S-110", rating: 4.6, reviews_count: 340, total_quantity: 5, available_quantity: 5 },
        { id: "B011", title: "Computer Networks", author: "Andrew S. Tanenbaum", category: "Networking", publisher: "Pearson", isbn: "978-0132126953", published_year: 2010, pages: 960, description: "A detailed introduction to networking concepts, protocols, and architectures.", image_url: "images/computer-networks.jpeg", location: "Main Library - 2nd Floor", shelf: "N-204", rating: 4.5, reviews_count: 178, total_quantity: 4, available_quantity: 4 },
        { id: "B012", title: "Operating System Concepts", author: "Abraham Silberschatz", category: "Operating Systems", publisher: "Wiley", isbn: "978-1119456339", published_year: 2018, pages: 976, description: "Fundamental operating-system principles including processes, memory, storage, and security.", image_url: "images/operating-system.jpeg", location: "Main Library - 2nd Floor", shelf: "OS-201", rating: 4.6, reviews_count: 215, total_quantity: 4, available_quantity: 4 },
        { id: "B013", title: "Artificial Intelligence: A Modern Approach", author: "Stuart Russell", category: "Artificial Intelligence", publisher: "Pearson", isbn: "978-0134610993", published_year: 2021, pages: 1152, description: "A comprehensive introduction to intelligent agents, machine learning, robotics, and AI.", image_url: "images/artificial-intelligence.jpeg", location: "Main Library - 3rd Floor", shelf: "AI-301", rating: 4.8, reviews_count: 289, total_quantity: 5, available_quantity: 5 },
        { id: "B014", title: "Rich Dad Poor Dad", author: "Robert T. Kiyosaki", category: "Finance", publisher: "Plata Publishing", isbn: "978-1612680194", published_year: 1997, pages: 336, description: "An introduction to personal finance, investing, and financial independence.", image_url: "images/rich-dad-poor-dad.jpeg", location: "Main Library - 1st Floor", shelf: "F-205", rating: 4.7, reviews_count: 580, total_quantity: 6, available_quantity: 6 },
        { id: "B015", title: "Design Patterns", author: "Erich Gamma", category: "Programming", publisher: "Addison-Wesley", isbn: "978-0201633610", published_year: 1994, pages: 416, description: "Classic book on object-oriented design patterns.", image_url: "images/design-patterns.jpeg", location: "Main Library - 2nd Floor", shelf: "A-220", rating: 4.8, reviews_count: 320, total_quantity: 4, available_quantity: 4 },
        { id: "B016", title: "Refactoring", author: "Martin Fowler", category: "Programming", publisher: "Addison-Wesley", isbn: "978-0134757599", published_year: 2018, pages: 448, description: "Improving the design of existing code.", image_url: "images/refactoring.jpeg", location: "Main Library - 2nd Floor", shelf: "A-225", rating: 4.7, reviews_count: 280, total_quantity: 3, available_quantity: 3 },
        { id: "B017", title: "The Pragmatic Programmer", author: "David Thomas", category: "Programming", publisher: "Addison-Wesley", isbn: "978-0135957059", published_year: 2019, pages: 352, description: "Your journey to mastery.", image_url: "images/pragmatic-programmer.jpeg", location: "Main Library - 1st Floor", shelf: "P-120", rating: 4.8, reviews_count: 450, total_quantity: 5, available_quantity: 5 },
        { id: "B018", title: "Structure and Interpretation of Computer Programs", author: "Harold Abelson", category: "Programming", publisher: "MIT Press", isbn: "978-0262510875", published_year: 1996, pages: 657, description: "A foundational computer science text.", image_url: "images/sicp.jpeg", location: "Main Library - 2nd Floor", shelf: "A-230", rating: 4.9, reviews_count: 500, total_quantity: 2, available_quantity: 2 },
        { id: "B019", title: "Introduction to the Theory of Computation", author: "Michael Sipser", category: "Computer Science", publisher: "Cengage Learning", isbn: "978-1133187790", published_year: 2012, pages: 480, description: "A comprehensive introduction to computability and complexity theory.", image_url: "images/theory-of-computation.jpeg", location: "Main Library - 2nd Floor", shelf: "CS-210", rating: 4.6, reviews_count: 180, total_quantity: 3, available_quantity: 3 },
        { id: "B020", title: "Operating Systems: Three Easy Pieces", author: "Remzi H. Arpaci-Dusseau", category: "Operating Systems", publisher: "CreateSpace", isbn: "978-1985086593", published_year: 2018, pages: 600, description: "A modern textbook on operating systems.", image_url: "images/ostep.jpeg", location: "Main Library - 2nd Floor", shelf: "OS-210", rating: 4.7, reviews_count: 220, total_quantity: 4, available_quantity: 4 },
    ];

    for (const b of books) {
        const [existing] = await pool.query("SELECT id FROM books WHERE id = ?", [b.id]);
        if (!existing.length) {
            await pool.query(
                `INSERT INTO books (id, title, author, category, publisher, isbn, published_year, pages, description, image_url, location, shelf, rating, reviews_count, total_quantity, available_quantity)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
                [b.id, b.title, b.author, b.category, b.publisher, b.isbn, b.published_year, b.pages, b.description, b.image_url, b.location, b.shelf, b.rating, b.reviews_count, b.total_quantity, b.available_quantity]
            );
        }

        // 6. Seed Physical Book Copies
        for (let i = 1; i <= b.total_quantity; i++) {
            const copyId = `BC-${b.id}-${String(i).padStart(2, "0")}`;
            const barcode = `BAR-${b.id}-${String(i).padStart(3, "0")}`;
            const [existingCopy] = await pool.query("SELECT id FROM book_copies WHERE id = ?", [copyId]);
            if (!existingCopy.length) {
                await pool.query(
                    `INSERT INTO book_copies (id, book_id, copy_number, barcode, status, condition_notes)
                     VALUES (?, ?, ?, ?, 'AVAILABLE', 'Good')`,
                    [copyId, b.id, i, barcode]
                );
            }
        }
    }

    // 7. Library Settings
    const defaultSettings = [
        { key: "library_name", value: "Smart Library Hub", desc: "Library display name" },
        { key: "library_address", value: "101 University Boulevard, Knowledge City", desc: "Campus physical address" },
        { key: "library_contact", value: "+91 9876543210", desc: "Official library contact phone" },
        { key: "library_email", value: "contact@libraryhub.edu", desc: "Official library contact email" },
        { key: "fine_per_day", value: "5", desc: "Overdue fine in ₹ per day" },
        { key: "loan_days", value: "15", desc: "Default borrowing loan duration in days" },
        { key: "max_books_per_member", value: "3", desc: "Maximum simultaneous active loans per member" },
        { key: "max_renewals", value: "2", desc: "Maximum times a loan can be renewed" },
    ];

    for (const s of defaultSettings) {
        const [existing] = await pool.query("SELECT setting_key FROM library_settings WHERE setting_key = ?", [s.key]);
        if (!existing.length) {
            await pool.query(
                "INSERT INTO library_settings (setting_key, setting_value, description, updated_by) VALUES (?, ?, ?, 'System')",
                [s.key, s.value, s.desc]
            );
        }
    }

    // 8. Sample Notifications
    const sampleNotifs = [
        { member_id: "MEM001", icon: "fa-book-open", title: "Welcome to Library Hub!", message: "Your student membership is active. You may browse and borrow up to 3 books." },
        { librarian_id: "LIB001", icon: "fa-circle-check", title: "Staff System Online", message: "Library Management System initialized with 20 titles and 94 physical copies." },
        { admin_id: 1, icon: "fa-shield-halved", title: "System Ready", message: "Production database initialized and secured." }
    ];

    for (const n of sampleNotifs) {
        await pool.query(
            "INSERT INTO notifications (member_id, librarian_id, admin_id, icon, title, message, is_read) VALUES (?, ?, ?, ?, ?, ?, 0)",
            [n.member_id || null, n.librarian_id || null, n.admin_id || null, n.icon, n.title, n.message]
        );
    }

    console.log("[SEED] Seeding completed successfully!");
    console.log("------------------------------------------------------------");
    console.log("Demo Credentials:");
    console.log("  Admin:     username: admin           password: admin123");
    console.log("  Librarian: email: soham@library.com  password: librarian123");
    console.log("  Member:    email: rahul@gmail.com    password: member123");
    console.log("------------------------------------------------------------");
}

if (require.main === module) {
    seed().then(() => process.exit(0)).catch(err => {
        console.error("[SEED] Error seeding database:", err);
        process.exit(1);
    });
}

module.exports = seed;
