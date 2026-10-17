/**
 * Library Hub — Database Migration Runner
 * Sets up all normalized relational tables, constraints, foreign keys, and indexes.
 * Works transparently on both SQLite and MySQL.
 *
 * Run with: node scripts/migrate.js
 */

const pool = require("../config/db");

async function migrate() {
    console.log(`[MIGRATE] Starting database migration for dialect: ${pool.dialect}...`);

    const isMysql = pool.dialect === "mysql";

    const statements = [
        // 1. Admins
        `CREATE TABLE IF NOT EXISTS admins (
            id ${isMysql ? "INT AUTO_INCREMENT" : "INTEGER"} PRIMARY KEY ${isMysql ? "" : "AUTOINCREMENT"},
            username VARCHAR(50) NOT NULL UNIQUE,
            email VARCHAR(150) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )${isMysql ? " ENGINE=InnoDB DEFAULT CHARSET=utf8mb4" : ""};`,

        // 2. Librarians
        `CREATE TABLE IF NOT EXISTS librarians (
            id VARCHAR(20) PRIMARY KEY,
            name VARCHAR(150) NOT NULL,
            email VARCHAR(150) NOT NULL UNIQUE,
            phone VARCHAR(20),
            address VARCHAR(255),
            password_hash VARCHAR(255) NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'Active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )${isMysql ? " ENGINE=InnoDB DEFAULT CHARSET=utf8mb4" : ""};`,

        // 3. Members
        `CREATE TABLE IF NOT EXISTS members (
            id VARCHAR(20) PRIMARY KEY,
            name VARCHAR(150) NOT NULL,
            email VARCHAR(150) NOT NULL UNIQUE,
            phone VARCHAR(20),
            department VARCHAR(100),
            type VARCHAR(20) NOT NULL DEFAULT 'Student',
            password_hash VARCHAR(255) NOT NULL,
            membership VARCHAR(50) DEFAULT 'Student Member',
            member_since DATE DEFAULT (CURRENT_DATE),
            status VARCHAR(20) NOT NULL DEFAULT 'Active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )${isMysql ? " ENGINE=InnoDB DEFAULT CHARSET=utf8mb4" : ""};`,

        // 4. Categories
        `CREATE TABLE IF NOT EXISTS categories (
            id ${isMysql ? "INT AUTO_INCREMENT" : "INTEGER"} PRIMARY KEY ${isMysql ? "" : "AUTOINCREMENT"},
            name VARCHAR(100) NOT NULL UNIQUE,
            description VARCHAR(255)
        )${isMysql ? " ENGINE=InnoDB DEFAULT CHARSET=utf8mb4" : ""};`,

        // 5. Books
        `CREATE TABLE IF NOT EXISTS books (
            id VARCHAR(20) PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            author VARCHAR(255) NOT NULL,
            category VARCHAR(100),
            publisher VARCHAR(150),
            isbn VARCHAR(30),
            published_year INT,
            pages INT,
            description TEXT,
            image_url VARCHAR(255),
            location VARCHAR(150),
            shelf VARCHAR(50),
            rating DECIMAL(2,1) DEFAULT 0,
            reviews_count INT DEFAULT 0,
            total_quantity INT NOT NULL DEFAULT 0,
            available_quantity INT NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )${isMysql ? " ENGINE=InnoDB DEFAULT CHARSET=utf8mb4" : ""};`,

        // 6. Physical Book Copies
        `CREATE TABLE IF NOT EXISTS book_copies (
            id VARCHAR(30) PRIMARY KEY,
            book_id VARCHAR(20) NOT NULL,
            copy_number INT NOT NULL,
            barcode VARCHAR(50) NOT NULL UNIQUE,
            status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE',
            condition_notes TEXT DEFAULT 'Good',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
            UNIQUE (book_id, copy_number)
        )${isMysql ? " ENGINE=InnoDB DEFAULT CHARSET=utf8mb4" : ""};`,

        // 7. Issues (Loans)
        `CREATE TABLE IF NOT EXISTS issues (
            id ${isMysql ? "INT AUTO_INCREMENT" : "INTEGER"} PRIMARY KEY ${isMysql ? "" : "AUTOINCREMENT"},
            book_id VARCHAR(20) NOT NULL,
            copy_id VARCHAR(30) NULL,
            member_id VARCHAR(20) NOT NULL,
            librarian_id VARCHAR(20) NULL,
            issue_date DATE NOT NULL,
            due_date DATE NOT NULL,
            return_date DATE NULL,
            renewals INT NOT NULL DEFAULT 0,
            status VARCHAR(20) NOT NULL DEFAULT 'Active',
            fine_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
            fine_status VARCHAR(20) NOT NULL DEFAULT 'None',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
            FOREIGN KEY (copy_id) REFERENCES book_copies(id) ON DELETE SET NULL,
            FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
            FOREIGN KEY (librarian_id) REFERENCES librarians(id) ON DELETE SET NULL
        )${isMysql ? " ENGINE=InnoDB DEFAULT CHARSET=utf8mb4" : ""};`,

        // 8. Fine Payments
        `CREATE TABLE IF NOT EXISTS payments (
            id ${isMysql ? "INT AUTO_INCREMENT" : "INTEGER"} PRIMARY KEY ${isMysql ? "" : "AUTOINCREMENT"},
            issue_id INT NOT NULL,
            member_id VARCHAR(20) NOT NULL,
            amount DECIMAL(10,2) NOT NULL,
            payment_method VARCHAR(50) NOT NULL DEFAULT 'Cash',
            transaction_ref VARCHAR(100),
            collected_by VARCHAR(50),
            notes VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE,
            FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
        )${isMysql ? " ENGINE=InnoDB DEFAULT CHARSET=utf8mb4" : ""};`,

        // 9. Reservations
        `CREATE TABLE IF NOT EXISTS reservations (
            id ${isMysql ? "INT AUTO_INCREMENT" : "INTEGER"} PRIMARY KEY ${isMysql ? "" : "AUTOINCREMENT"},
            book_id VARCHAR(20) NOT NULL,
            member_id VARCHAR(20) NOT NULL,
            reserved_date DATE NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'Pending',
            queue_position INT NOT NULL DEFAULT 1,
            assigned_copy_id VARCHAR(30) NULL,
            ready_date DATE NULL,
            expiry_date DATE NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
            FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
            FOREIGN KEY (assigned_copy_id) REFERENCES book_copies(id) ON DELETE SET NULL
        )${isMysql ? " ENGINE=InnoDB DEFAULT CHARSET=utf8mb4" : ""};`,

        // 10. Notifications
        `CREATE TABLE IF NOT EXISTS notifications (
            id ${isMysql ? "INT AUTO_INCREMENT" : "INTEGER"} PRIMARY KEY ${isMysql ? "" : "AUTOINCREMENT"},
            member_id VARCHAR(20) NULL,
            librarian_id VARCHAR(20) NULL,
            admin_id INT NULL,
            icon VARCHAR(50) DEFAULT 'fa-circle-info',
            title VARCHAR(150) NOT NULL,
            message VARCHAR(500) NOT NULL,
            is_read INT NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
            FOREIGN KEY (librarian_id) REFERENCES librarians(id) ON DELETE CASCADE,
            FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
        )${isMysql ? " ENGINE=InnoDB DEFAULT CHARSET=utf8mb4" : ""};`,

        // 11. Library Settings
        `CREATE TABLE IF NOT EXISTS library_settings (
            setting_key VARCHAR(50) PRIMARY KEY,
            setting_value TEXT NOT NULL,
            description VARCHAR(255),
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_by VARCHAR(50)
        )${isMysql ? " ENGINE=InnoDB DEFAULT CHARSET=utf8mb4" : ""};`,

        // 12. Backups
        `CREATE TABLE IF NOT EXISTS backups (
            id VARCHAR(30) PRIMARY KEY,
            file_name VARCHAR(255) NOT NULL,
            size_bytes BIGINT NOT NULL DEFAULT 0,
            size_label VARCHAR(30) DEFAULT '0 MB',
            status VARCHAR(20) DEFAULT 'Completed',
            admin_id INT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL
        )${isMysql ? " ENGINE=InnoDB DEFAULT CHARSET=utf8mb4" : ""};`,

        // 13. Audit Logs
        `CREATE TABLE IF NOT EXISTS audit_logs (
            id ${isMysql ? "INT AUTO_INCREMENT" : "INTEGER"} PRIMARY KEY ${isMysql ? "" : "AUTOINCREMENT"},
            actor_role VARCHAR(20),
            actor_id VARCHAR(50),
            action VARCHAR(150) NOT NULL,
            details VARCHAR(500),
            ip_address VARCHAR(45),
            user_agent TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )${isMysql ? " ENGINE=InnoDB DEFAULT CHARSET=utf8mb4" : ""};`,

        // 14. Password Resets
        `CREATE TABLE IF NOT EXISTS password_resets (
            id ${isMysql ? "INT AUTO_INCREMENT" : "INTEGER"} PRIMARY KEY ${isMysql ? "" : "AUTOINCREMENT"},
            user_type VARCHAR(20) NOT NULL,
            user_id VARCHAR(50) NOT NULL,
            token VARCHAR(64) NOT NULL UNIQUE,
            expires_at TIMESTAMP NOT NULL,
            used INT NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )${isMysql ? " ENGINE=InnoDB DEFAULT CHARSET=utf8mb4" : ""};`
    ];

    // Indexes
    const indexes = [
        "CREATE INDEX IF NOT EXISTS idx_librarians_email ON librarians (email);",
        "CREATE INDEX IF NOT EXISTS idx_members_email ON members (email);",
        "CREATE INDEX IF NOT EXISTS idx_books_title ON books (title);",
        "CREATE INDEX IF NOT EXISTS idx_books_author ON books (author);",
        "CREATE INDEX IF NOT EXISTS idx_books_category ON books (category);",
        "CREATE INDEX IF NOT EXISTS idx_book_copies_book ON book_copies (book_id);",
        "CREATE INDEX IF NOT EXISTS idx_book_copies_status ON book_copies (status);",
        "CREATE INDEX IF NOT EXISTS idx_issues_member ON issues (member_id);",
        "CREATE INDEX IF NOT EXISTS idx_issues_book ON issues (book_id);",
        "CREATE INDEX IF NOT EXISTS idx_issues_status ON issues (status);",
        "CREATE INDEX IF NOT EXISTS idx_issues_due ON issues (due_date);",
        "CREATE INDEX IF NOT EXISTS idx_payments_issue ON payments (issue_id);",
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_tx_ref ON payments (transaction_ref);",
        "CREATE INDEX IF NOT EXISTS idx_reservations_book ON reservations (book_id);",
        "CREATE INDEX IF NOT EXISTS idx_reservations_member ON reservations (member_id);",
        "CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations (status);",
        "CREATE INDEX IF NOT EXISTS idx_notifications_member ON notifications (member_id);",
        "CREATE INDEX IF NOT EXISTS idx_notifications_librarian ON notifications (librarian_id);",
        "CREATE INDEX IF NOT EXISTS idx_notifications_admin ON notifications (admin_id);",
        "CREATE INDEX IF NOT EXISTS idx_issues_perf ON issues (status, issue_date, id);",
        "CREATE INDEX IF NOT EXISTS idx_issues_perf_desc ON issues (status, issue_date DESC, id DESC);",
        "CREATE INDEX IF NOT EXISTS idx_issues_due_perf ON issues (status, due_date);",
        "CREATE INDEX IF NOT EXISTS idx_issues_fine_perf ON issues (fine_status, fine_amount);",
        "CREATE INDEX IF NOT EXISTS idx_issues_fined_members ON issues (fine_amount, member_id);"
    ];

    for (const sql of statements) {
        await pool.query(sql);
    }
    for (const idx of indexes) {
        await pool.query(idx);
    }

    console.log("[MIGRATE] Database migration completed successfully!");
}

if (require.main === module) {
    migrate().then(() => process.exit(0)).catch(err => {
        console.error("[MIGRATE] Error running migration:", err);
        process.exit(1);
    });
}

module.exports = migrate;
