# Library Hub — Production Setup & System Documentation

A modern, production-ready, full-stack **Library Management System** built with **Node.js, Express, and a dual-dialect Relational Database Architecture (SQLite & MySQL 8)**, providing unified, secure backend persistence across all 4 frontend interfaces:
- **Landing Page & Role Router** (`Frontend/Landing Page(PB)`)
- **System Administrator Portal** (`Frontend/Admin Dashboard(Siddhesh,Soham)`)
- **Head Librarian Operations Console** (`Frontend/librarian Dashboard(Sid)`)
- **Member / Student Self-Service Portal** (`Frontend/final member module`)

Every feature operates on the strict architectural model:
**Frontend UI → Secure REST API → Business Logic & Concurrency Control → Relational Database → JSON Response → Frontend UI**.

---

## 1. System Requirements

- **Node.js**: v18.0.0 or higher (v20+ or v24 recommended)
- **Database Options**:
  - **Zero-Setup Mode (Default)**: Uses the built-in, native SQLite engine (`backend/data/library_hub.sqlite`). Starts instantly without installing or configuring external services.
  - **Enterprise Mode (MySQL 8+ / MariaDB 10.6+)**: Fully supported via the connection pool in `backend/config/db.js`.
- **Static Web Server**: Any static web server (VS Code Live Server, Python `http.server`, or Nginx).

---

## 2. Quick Start (Zero-Configuration)

Clone or open the repository, then navigate to `backend/`:

```bash
cd backend
npm install
npm run seed      # Automatically executes migrations and seeds initial database
npm start         # Starts backend API on http://localhost:5000
```

Verify backend health:
```bash
curl http://localhost:5000/api/health
# Response: {"success":true,"message":"Library Hub API is running."}
```

---

## 3. Automated Test Suite

Run the full automated test suite covering RBAC, physical copy tracking, issue/renew/return workflows, reservation queues, fine payments with discrete receipt records, and operational settings:

```bash
cd backend
npm test
```

Expected output: **30/30 tests passing (100% pass rate)**.

---

## 4. Enterprise MySQL Setup (Optional)

If running in enterprise environments with an active MySQL 8 service:

1. Create the MySQL user and database:
```sql
CREATE DATABASE IF NOT EXISTS library_hub CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'library_admin'@'localhost' IDENTIFIED BY 'your_password';
CREATE USER IF NOT EXISTS 'library_admin'@'127.0.0.1' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON library_hub.* TO 'library_admin'@'localhost';
GRANT ALL PRIVILEGES ON library_hub.* TO 'library_admin'@'127.0.0.1';
FLUSH PRIVILEGES;
```

2. Configure `backend/.env`:
```env
PORT=5000
NODE_ENV=production
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=library_hub
DB_USER=library_admin
DB_PASSWORD=your_password
JWT_SECRET=your_production_secret_key_here
```

3. Run migrations and seeds:
```bash
npm run migrate
npm run seed
```

---

## 5. Seed Accounts & Credentials

The database is seeded with realistic records and bcrypt-hashed credentials (10 rounds):

| Role | Username / Identifier | Password | Access Level |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin` | `admin123` | System oversight, staff management, book catalog, backups, reports |
| **Librarian** | `soham@library.com` | `librarian123` | Book issues, returns, student accounts, fine collection, settings |
| **Librarian** | `priya@library.com` | `librarian123` | Branch operations |
| **Member** | `rahul@gmail.com` | `member123` | Catalog browsing, borrowing history, reservations, profile |
| **Member** | `priya@gmail.com` | `member123` | Faculty member loans |

---

## 6. Accessing the Web Frontends

Serve the `Frontend/` folder using any local HTTP server:

```bash
cd Frontend
# Using Python:
python -m http.server 8000

# Or using Node:
npx serve -p 8000 .
```

Navigate to:
- **Landing Page**: `http://localhost:8000/Landing%20Page(PB)/index.html`
- **Admin Dashboard**: `http://localhost:8000/Admin%20Dashboard(Siddhesh,Soham)/Final%20Project%20(Siddhesh%20&%20Soham)/login.html`
- **Librarian Dashboard**: `http://localhost:8000/librarian%20Dashboard(Sid)/librarian/login.html`
- **Member Portal**: `http://localhost:8000/final%20member%20module/login.html`

*(Note: If opening files directly via `file://`, the backend CORS policy automatically permits `null` origins for local development).*

---

## 7. Database Architecture & Schema

The system implements a normalized, relational 3NF schema comprising **14 tables and 18 indexes**:

1. **`admins`**: System administrators (`id`, `username`, `email`, `password_hash`, `created_at`).
2. **`librarians`**: Staff accounts (`id`, `name`, `email`, `phone`, `address`, `password_hash`, `status`).
3. **`members`**: Student and faculty borrowers (`id`, `name`, `email`, `phone`, `department`, `type`, `membership`, `password_hash`, `status`).
4. **`books`**: Bibliographic titles (`id`, `title`, `author`, `category`, `publisher`, `isbn`, `quantity`, `available_quantity`, `location`, `shelf`).
5. **`book_copies`**: Individual physical copies tracking (`id`, `book_id`, `copy_number`, `barcode`, `status`: `AVAILABLE`/`ISSUED`/`RESERVED`/`LOST`/`DAMAGED`, `condition_notes`).
6. **`issues`**: Loan transactions (`id`, `book_id`, `copy_id`, `member_id`, `librarian_id`, `issue_date`, `due_date`, `return_date`, `renewals`, `status`, `fine_amount`, `fine_status`).
7. **`reservations`**: Hold requests with priority queues (`id`, `book_id`, `member_id`, `reserved_date`, `status`: `Pending`/`Ready`/`Fulfilled`/`Cancelled`, `queue_position`).
8. **`payments`**: Discrete financial payment receipts (`id`, `issue_id`, `member_id`, `amount`, `payment_method`, `receipt_number`, `collected_by`, `paid_at`).
9. **`library_settings`**: Dynamic operational policies (`setting_key`, `setting_value`, `updated_at`, `updated_by`).
10. **`notifications`**: User alert dispatch (`id`, `user_role`, `user_id`, `icon`, `title`, `message`, `is_read`, `created_at`).
11. **`audit_logs`**: Immutable security audit trail (`id`, `user_role`, `user_id`, `action`, `details`, `ip_address`, `timestamp`).
12. **`backups`**: Database backup registry (`id`, `file_name`, `size_label`, `status`, `created_by`, `created_at`).
13. **`categories`**: Catalog taxonomy.
14. **`publishers`**: Publishing entities.

---

## 8. Real Library Business Rules Implemented

- **Physical Copy Allocation**: Borrowing a book allocates an exact physical item from `book_copies` with unique barcode and copy number, preventing race conditions or double-borrowing.
- **Overdue Fine Engine**: Return operations automatically calculate overdue days past `due_date` multiplied by `fine_per_day` setting.
- **Reservation Queue Fulfillment**: When a copy of a reserved title is returned, the system automatically checks the reservation queue, promotes the #1 queued member, sets copy status to `RESERVED`, and emits an unread notification.
- **Renewal Safeguards**: Renewals verify that the book is not overdue, that the member has not exceeded `max_renewals`, and that no pending reservations are waiting for that title.
- **Discrete Payment Receipts**: Paying fines generates permanent transaction records in `payments` with unique receipt numbers (`REC-XXXXXXXX`) and method tracking (Cash, Card, UPI).
- **Dynamic Policy Rules**: Fine rates, loan durations, and borrowing limits are stored in the database and editable via the settings API in real-time.

---

## 9. Security Hardening Summary

- **Bcrypt Password Hashing**: Cost factor 10. No plaintext credentials stored.
- **JWT Authentication**: Cryptographically signed tokens with configurable expiration (`JWT_EXPIRES_IN=7d`).
- **Role-Based Access Control (RBAC)**: Strict server-side middleware enforcement (`requireRole`). Frontend role claims are never trusted.
- **SQL Injection Prevention**: 100% parameterized queries via DB adapter.
- **Rate Limiting**: Multi-tiered rate limiters protecting against brute-force attacks (`express-rate-limit`).
- **Security Headers**: HTTP security headers configured via `helmet`.
- **CORS Protection**: Origin filtering with whitelist support for production domains.
