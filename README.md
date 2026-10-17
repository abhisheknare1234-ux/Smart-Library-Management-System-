# Library Hub — Production-Ready Library Management System

A complete, secure, responsive, full-stack Library Management System built with Node.js/Express, MySQL, and vanilla JavaScript frontends.

## Features

### Three User Roles
- **Administrator**: Full system control — manage books, members, librarians, fines, reports, backups, notifications, system statistics
- **Librarian**: Daily operations — issue/return books, manage reservations, handle fines, search books, manage members
- **Member**: Self-service — browse/search books, borrow/return books, reserve books, view fines, notifications, profile management

### Core Functionality
- **Book Management**: Full CRUD with search, filtering, pagination, availability tracking
- **Book Issue/Return**: Transactional workflow with concurrency control, due dates, renewals
- **Reservations**: Queue-based reservation system with status tracking
- **Fines**: Automatic calculation based on overdue days, payment status tracking
- **Notifications**: Real-time notifications for issues, returns, fines, reservations, announcements
- **Reports & Statistics**: Role-based dashboards with real-time data
- **Database Backup**: Admin-only SQL dump generation and download
- **Password Reset**: Secure token-based password reset flow

## Tech Stack

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js 5
- **Database**: MySQL 8.0+ (via mysql2)
- **Authentication**: JWT (jsonwebtoken) with bcryptjs password hashing
- **Validation**: express-validator, custom sanitization
- **Security**: helmet, cors, express-rate-limit, morgan logging
- **Environment**: dotenv

### Frontend
- **Admin Dashboard**: Bootstrap 5, vanilla ES6 JavaScript
- **Librarian Dashboard**: Bootstrap 5, vanilla ES6 JavaScript
- **Member Dashboard**: Custom CSS (Poppins font), vanilla ES6 JavaScript
- **Landing Page**: Custom CSS, vanilla JavaScript

### Database
- **MySQL** with InnoDB engine
- Foreign key constraints with cascading
- Proper indexes for query performance
- Check constraints for data integrity

## Project Structure

```
Library Hub/
├── backend/
│   ├── config/
│   │   └── db.js              # MySQL connection pool
│   ├── middleware/
│   │   └── auth.js            # JWT authentication & authorization
│   ├── routes/
│   │   ├── auth.js            # Login, register, password reset, change password
│   │   ├── books.js           # Book CRUD, search
│   │   ├── members.js         # Member CRUD, profile
│   │   ├── librarians.js      # Librarian CRUD, profile
│   │   ├── issues.js          # Issue/return/renew workflow
│   │   ├── fines.js           # Fine management
│   │   ├── reservations.js    # Reservation workflow
│   │   ├── notifications.js   # Notifications + broadcast
│   │   ├── backups.js         # Database backup
│   │   └── stats.js           # Role-based statistics
│   ├── utils/
│   │   └── helpers.js         # Validation, ID generation, date utils, fine calc
│   ├── schema.sql             # Complete database schema
│   ├── seed.js                # Development seed data
│   ├── server.js              # Express app entry point
│   ├── package.json
│   └── .env.example
├── Frontend/
│   ├── Admin Dashboard(Siddhesh,Soham)/
│   │   └── Final Project (Siddhesh & Soham)/
│   │       ├── *.html         # Admin pages
│   │       ├── css/
│   │       └── js/
│   │           ├── db.js      # Admin API client
│   │           ├── auth.js    # Auth middleware
│   │           └── config.js  # API base URL
│   ├── final member module/
│   │   ├── *.html             # Member pages (in pages/)
│   │   ├── css/
│   │   └── js/
│   │       ├── api-client.js  # Member API client (sessionStorage)
│   │       ├── app.js         # Shared app logic
│   │       ├── auth.js        # Login/registration
│   │       └── *.js           # Page-specific logic
│   ├── librarian Dashboard(Sid)/
│   │   └── librarian/
│   │       ├── *.html         # Librarian pages
│   │       ├── css/
│   │       ├── data/
│   │       └── js/
│   │           ├── api-client.js  # Librarian API client
│   │           └── *.js           # Page-specific logic
│   └── Landing Page(PB)/
│       ├── index.html
│       ├── style.css
│       └── script.js
```

## Requirements

- **Node.js**: 18.0.0 or higher
- **npm**: 9.0.0 or higher (comes with Node.js)
- **MySQL**: 8.0 or higher (or MariaDB 10.5+)
- **Modern Browser**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+

## Installation

### 1. Clone the Repository
```bash
git clone <repository-url>
cd "Library Hub"
```

### 2. Backend Setup
```bash
cd backend
npm install
```

### 3. Database Setup
```bash
# Create database and tables
mysql -u root -p < schema.sql

# Seed development data (creates demo accounts)
npm run seed
```

### 4. Environment Configuration
```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your configuration
# Required: DB_PASSWORD, JWT_SECRET
```

### 5. Start Backend
```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

Backend runs on `http://localhost:5000` by default.

### 6. Frontend Access
Open the landing page in a browser:
```
Frontend/Landing Page(PB)/index.html
```

Or serve via a static server:
```bash
cd "Frontend/Landing Page(PB)"
npx serve .
```

Then navigate to role-specific dashboards:
- **Admin**: `Frontend/Admin Dashboard(Siddhesh,Soham)/Final Project (Siddhesh & Soham)/login.html`
- **Librarian**: `Frontend/librarian Dashboard(Sid)/librarian/login.html`
- **Member**: `Frontend/final member module/login.html`

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Backend port | `5000` |
| `DB_HOST` | MySQL host | `127.0.0.1` |
| `DB_PORT` | MySQL port | `3306` |
| `DB_NAME` | Database name | `library_hub` |
| `DB_USER` | Database user | `library_admin` |
| `DB_PASSWORD` | Database password | **Required** |
| `DB_CONNECTION_LIMIT` | Connection pool size | `10` |
| `JWT_SECRET` | JWT signing secret | **Required** |
| `JWT_EXPIRES_IN` | Token expiration | `7d` |
| `CORS_ORIGIN` | Allowed origins (comma-separated) | `http://localhost:3000` |
| `RATE_LIMIT_WINDOW_MS` | General rate limit window | `900000` (15 min) |
| `RATE_LIMIT_MAX_REQUESTS` | General rate limit max | `100` |
| `AUTH_RATE_LIMIT_WINDOW_MS` | Auth rate limit window | `900000` (15 min) |
| `AUTH_RATE_LIMIT_MAX_REQUESTS` | Auth rate limit max | `10` |
| `FRONTEND_URL` | Frontend base URL | `http://localhost:3000` |
| `BACKUP_DIR` | Backup storage directory | `./backups_files` |

## Default Credentials (Development Only)

> ⚠️ **DEVELOPMENT ONLY — CHANGE/REMOVE BEFORE PRODUCTION**

| Role | Username/Email | Password |
|------|----------------|----------|
| Admin | `admin` / `admin@smartlibrary.com` | `admin123` |
| Librarian | `soham@library.com` / `LIB001` | `librarian123` |
| Member | `rahul@gmail.com` / `MEM001` | `member123` |

## API Endpoints

### Authentication
- `POST /api/auth/login` — Login (all roles)
- `POST /api/auth/register` — Member self-registration
- `GET /api/auth/me` — Get current user profile
- `POST /api/auth/change-password` — Change password (authenticated)
- `POST /api/auth/forgot-password` — Request password reset
- `POST /api/auth/reset-password` — Reset password with token

### Books
- `GET /api/books` — List books (search, category filter)
- `GET /api/books/:id` — Get book details
- `POST /api/books` — Create book (Admin/Librarian)
- `PUT /api/books/:id` — Update book (Admin/Librarian)
- `DELETE /api/books/:id` — Delete book (Admin/Librarian)

### Members
- `GET /api/members` — List members (Admin/Librarian)
- `GET /api/members/:id/profile` — Get profile (self or Admin/Librarian)
- `PUT /api/members/:id/profile` — Update profile (self)
- `POST /api/members` — Create member (Admin/Librarian)
- `PUT /api/members/:id` — Update member (Admin/Librarian)
- `DELETE /api/members/:id` — Delete member (Admin/Librarian)

### Librarians
- `GET /api/librarians/me` — Get own profile (Librarian/Admin)
- `PUT /api/librarians/me` — Update own profile (Librarian/Admin)
- `GET /api/librarians` — List librarians (Admin)
- `POST /api/librarians` — Create librarian (Admin)
- `PUT /api/librarians/:id` — Update librarian (Admin)
- `DELETE /api/librarians/:id` — Delete librarian (Admin)

### Issues (Borrow/Return)
- `GET /api/issues` — List issues (Admin/Librarian, with filters)
- `GET /api/issues/mine` — Member's active loans
- `GET /api/issues/history/mine` — Member's return history
- `POST /api/issues` — Issue book (Admin/Librarian/Member self)
- `POST /api/issues/:id/return` — Return book
- `POST /api/issues/:id/renew` — Renew book

### Fines
- `GET /api/fines` — List fines (Admin/Librarian)
- `GET /api/fines/mine` — Member's fines
- `POST /api/fines/:issueId/pay` — Mark fine as paid

### Reservations
- `GET /api/reservations` — List reservations (Admin/Librarian)
- `GET /api/reservations/mine` — Member's reservations
- `POST /api/reservations` — Create reservation (Member)
- `PUT /api/reservations/:id/cancel` — Cancel reservation
- `PUT /api/reservations/:id/ready` — Mark ready for pickup (Admin/Librarian)

### Notifications
- `GET /api/notifications/mine` — Member's notifications
- `GET /api/notifications/librarian` — Librarian's notifications
- `GET /api/notifications/admin` — Admin's notifications
- `PUT /api/notifications/mark-all-read` — Mark all read (Member)
- `PUT /api/notifications/librarian/mark-all-read` — Mark all read (Librarian)
- `PUT /api/notifications/admin/mark-all-read` — Mark all read (Admin)
- `POST /api/notifications/broadcast` — Broadcast announcement (Admin/Librarian)

### Backups
- `GET /api/backups` — List backups (Admin)
- `POST /api/backups` — Create backup (Admin)
- `GET /api/backups/:id/download` — Download backup file (Admin)

### Statistics
- `GET /api/stats/admin` — Admin dashboard stats
- `GET /api/stats/librarian` — Librarian dashboard stats
- `GET /api/stats/member` — Member dashboard stats

## Database Schema

Key tables:
- `admins` — System administrators
- `librarians` — Library staff
- `members` — Library members (students, faculty, general)
- `books` — Book catalog with availability tracking
- `issues` — Book loan transactions (issue → return lifecycle)
- `reservations` — Book reservations with queue status
- `notifications` — User notifications (members, librarians, admins)
- `backups` — Backup operation logs
- `audit_logs` — System audit trail
- `password_resets` — Password reset tokens

## Security Features

- **Password Hashing**: bcryptjs with cost factor 10
- **JWT Authentication**: Secure tokens with configurable expiration
- **Role-Based Access Control**: Middleware-enforced permissions
- **SQL Injection Prevention**: Parameterized queries only
- **XSS Mitigation**: Input sanitization, CSP headers
- **Rate Limiting**: General + stricter auth endpoint limits
- **CORS Configuration**: Origin whitelist with credentials support
- **Security Headers**: Helmet.js with appropriate policies
- **Request Size Limits**: 10KB body parser limit
- **Audit Logging**: All critical actions logged

## Development

### Running Tests
```bash
cd backend
npm test
```

### Linting
```bash
cd backend
npm run lint
```

### Database Migrations
The `schema.sql` file contains the complete schema. For production, use a migration tool like `db-migrate` or run the SQL directly.

## Production Deployment

### 1. Build Frontend (if using build step)
The frontend uses vanilla JS/CSS — no build step required. Serve static files via nginx or Apache.

### 2. Environment Configuration
```bash
# Production .env
NODE_ENV=production
PORT=5000
DB_HOST=your-db-host
DB_PASSWORD=your-secure-password
JWT_SECRET=your-64-char-random-secret
CORS_ORIGIN=https://yourdomain.com,https://admin.yourdomain.com
```

### 3. Process Manager
Use PM2 or systemd:
```bash
pm2 start server.js --name library-hub
pm2 startup
pm2 save
```

### 4. Reverse Proxy (nginx)
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 5. HTTPS
Use Let's Encrypt with Certbot for SSL certificates.

### 6. Database Backup
Schedule regular backups via cron:
```bash
0 2 * * * cd /path/to/backend && node -e "require('./routes/backups').createBackup()"
```

Or use the admin dashboard's backup feature.

## Recovery Procedures

### Database Restore
1. Stop the application
2. Create a fresh database: `mysql -u root -p -e "CREATE DATABASE library_hub;"`
3. Restore from backup: `mysql -u root -p library_hub < backup_file.sql`
4. Run any pending migrations
5. Restart the application

### Credential Recovery
If admin credentials are lost:
1. Access the database directly
2. Update the `admins` table with a new bcrypt hash
3. Or use the password reset flow via email

## API Response Format

### Success
```json
{
  "success": true,
  "data": {},
  "message": "Operation successful"
}
```

### Error
```json
{
  "success": false,
  "message": "Human-readable error message"
}
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

ISC License — See LICENSE file for details.

## Support

For issues and feature requests, please open a GitHub issue.

## Changelog

### v1.0.0 (Current)
- Initial production-ready release
- Three-role authentication system
- Complete book/issue/reservation/fine workflows
- Admin, Librarian, and Member dashboards
- Database backup/restore
- Password reset flow
- Comprehensive input validation
- Security hardening