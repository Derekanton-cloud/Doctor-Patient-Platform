const express = require("express");
const session = require("express-session");
const dotenv = require("dotenv");
const path = require("path");
const connectDB = require("./config/db");
const cookieParser = require('cookie-parser');
// Import Routes
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const doctorRoutes = require("./routes/doctorRoutes");
const patientRoutes = require("./routes/patientRoutes");
const appointmentRoutes = require("./routes/appointmentRoutes");
const prescriptionRoutes = require("./routes/prescriptionRoutes");
const availabilityRoutes = require('./routes/availabilityRoutes');

// Load environment variables
dotenv.config();

// Initialize Express
const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Use cookie-parser middleware
app.use(cookieParser());

// Use session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-strong-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production', // Only use secure in production
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Static Files
app.use(express.static(path.join(__dirname, "public")));

// View Engine (EJS Setup)
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Add this before your routes
app.use((req, res, next) => {
  console.log('------ REQUEST PATH:', req.path);
  console.log('------ SESSION DATA:', req.session);
  if (req.session.user) {
    console.log('------ USER ID:', req.session.user.id);
    console.log('------ USER ROLE:', req.session.user.role);
  } else {
    console.log('------ NO USER IN SESSION');
  }
  next();
});

// Add before your routes but after session setup
app.use((req, res, next) => {
  console.log(`🔍 Processing ${req.method} ${req.path}`);
  console.log(`🔐 Auth Status: ${req.session?.user ? 'Authenticated as ' + req.session.user.role : 'Not authenticated'}`);
  next();
});

// Routes
app.use("/auth", authRoutes);
app.use("/admin", adminRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/doctors", doctorRoutes);
app.use("/patient", patientRoutes);
app.use("/appointments", appointmentRoutes);
app.use("/prescriptions", prescriptionRoutes);
app.use('/api/availability', availabilityRoutes);

// Home Route
app.get("/", (req, res) => {
  res.render("index");
});

// Login and Registration Routes
app.get("/login", (req, res) => {
  res.render("login");
});

app.get("/register", (req, res) => {
  res.render("register");
});

// Redirect Admin Dashboard
app.get("/adminDashboard", (req, res) => {
  res.redirect("/admin/dashboard");
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Application error:', err);
  res.status(500).render('error', { message: 'An error occurred' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('error', { message: 'Page not found' });
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});