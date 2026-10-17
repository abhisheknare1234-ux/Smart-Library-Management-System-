require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const { router: authRouter } = require("./routes/auth");
const booksRouter = require("./routes/books");
const membersRouter = require("./routes/members");
const librariansRouter = require("./routes/librarians");
const issuesRouter = require("./routes/issues");
const finesRouter = require("./routes/fines");
const reservationsRouter = require("./routes/reservations");
const notificationsRouter = require("./routes/notifications");
const backupsRouter = require("./routes/backups");
const statsRouter = require("./routes/stats");
const settingsRouter = require("./routes/settings");

const app = express();

// Security headers
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false, // Allow inline styles/scripts for frontend compatibility
}));

// CORS configuration
const corsOrigins = (process.env.CORS_ORIGIN || "http://localhost:3000,http://127.0.0.1:3000,http://localhost:8000,http://127.0.0.1:8000,http://localhost:5500,http://127.0.0.1:5500").split(",").map(o => o.trim());
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin or file:// (origin: 'null') or development localhost
        if (!origin || origin === "null") return callback(null, true);
        if (corsOrigins.includes(origin) || process.env.NODE_ENV !== "production" || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
            return callback(null, true);
        }
        return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
}));

// Rate limiting (bypassed in test environment)
const limiter = (process.env.NODE_ENV === "test")
    ? (req, res, next) => next()
    : rateLimit({
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
        max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
        message: { success: false, message: "Too many requests, please try again later." },
        standardHeaders: true,
        legacyHeaders: false,
    });
app.use(limiter);

// Stricter rate limiting for auth endpoints (bypassed in test environment)
const authLimiter = (process.env.NODE_ENV === "test")
    ? (req, res, next) => next()
    : rateLimit({
        windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
        max: parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS) || 10,
        message: { success: false, message: "Too many authentication attempts, please try again later." },
        standardHeaders: true,
        legacyHeaders: false,
    });

// Body parser with size limit
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// Logging
if (process.env.NODE_ENV !== "test") {
    app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
}

const path = require("path");

// Serve Frontend static files
app.use(express.static(path.join(__dirname, "..", "Frontend")));

// Health check
app.get("/api/health", (req, res) => res.json({ success: true, message: "Library Hub API is running." }));
app.get("/", (req, res) => {
    res.redirect("/Landing%20Page(PB)/index.html");
});

// API routes
app.use("/api/auth", authLimiter, authRouter);
app.use("/api/books", booksRouter);
app.use("/api/members", membersRouter);
app.use("/api/librarians", librariansRouter);
app.use("/api/issues", issuesRouter);
app.use("/api/fines", finesRouter);
app.use("/api/reservations", reservationsRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/backups", backupsRouter);
app.use("/api/stats", statsRouter);
app.use("/api/settings", settingsRouter);

// 404 handler
app.use((req, res) => res.status(404).json({ success: false, message: "Endpoint not found." }));

// Central error handler (catches anything unexpected)
app.use((err, req, res, next) => {
    console.error("Unhandled error:", err);
    // Don't leak error details in production
    const message = process.env.NODE_ENV === "production" 
        ? "Something went wrong on the server." 
        : err.message;
    res.status(500).json({ success: false, message });
});

const PORT = process.env.PORT || 5000;
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Library Hub API listening on http://localhost:${PORT}`);
    });
}

module.exports = app;
