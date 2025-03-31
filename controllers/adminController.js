const Admin = require('../models/admin');
const Doctor = require('../models/doctor');
const { sendEmail } = require('../utils/emailService');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Admin Dashboard - View Pending Doctors
exports.getPendingDoctors = async (req, res) => {
  try {
    const pendingDoctors = await Doctor.find({ isApproved: false });
    res.render('adminDashboard', { pendingDoctors });
  } catch (error) {
    console.error('Error fetching pending doctors:', error);
    res.status(500).send('Internal Server Error');
  }
};

// Admin Login
exports.adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await Admin.findOne({ email });

    if (!admin || !(await bcrypt.compare(password, admin.password))) {
      return res.status(401).send('Invalid email or password');
    }

    // Create JWT for admin session
    const token = jwt.sign({ id: admin._id, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1d' });

    req.session.adminToken = token;
    res.redirect('/admin/dashboard');
  } catch (error) {
    console.error('Error logging in admin:', error);
    res.status(500).send('Internal Server Error');
  }
};

// Admin Logout
exports.adminLogout = (req, res) => {
  req.session.destroy(() => {
    res.redirect('/admin/login');
  });
};

// Approve Doctor
exports.approveDoctor = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const doctor = await Doctor.findById(doctorId);

    if (!doctor) return res.status(404).send('Doctor not found');

    doctor.isApproved = true;
    await doctor.save();

    // Notify Doctor about approval
    await sendEmail(doctor.email, 'Approval Notification', 'Your doctor profile has been approved.');

    res.redirect('/admin/dashboard');
  } catch (error) {
    console.error('Error approving doctor:', error);
    res.status(500).send('Internal Server Error');
  }
};

// Reject Doctor
exports.rejectDoctor = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const doctor = await Doctor.findByIdAndDelete(doctorId);

    if (!doctor) return res.status(404).send('Doctor not found');

    // Notify Doctor about rejection
    await sendEmail(doctor.email, 'Rejection Notification', 'Your doctor profile has been rejected.');

    res.redirect('/admin/dashboard');
  } catch (error) {
    console.error('Error rejecting doctor:', error);
    res.status(500).send('Internal Server Error');
  }
};

// Send Doctor Details to Admins (Multi-Admin Review Process)
exports.notifyAdminsForApproval = async (doctor) => {
  try {
    const admins = await Admin.find({});
    const adminEmails = admins.map((admin) => admin.email);

    const subject = 'Doctor Approval Request';
    const message = `
      Doctor Name: ${doctor.firstName} ${doctor.lastName}
      Specialization: ${doctor.specialization}
      Email: ${doctor.email}
      Review and approve: ${process.env.BASE_URL}/admin/dashboard
    `;

    // Loop through the admin emails and send email notifications
    for (const email of adminEmails) {
      await sendEmail(email, subject, message);
    }
  } catch (error) {
    console.error('Error notifying admins:', error);
  }
};

// Admin Access Middleware
exports.isAdminAuthenticated = (req, res, next) => {
  if (!req.session.adminToken) {
    return res.redirect('/admin/login');
  }
  try {
    const decoded = jwt.verify(req.session.adminToken, process.env.JWT_SECRET);
    req.adminId = decoded.id;
    next();
  } catch (error) {
    console.error('JWT Verification Error:', error);
    res.redirect('/admin/login');
  }
};

// Function to handle doctor registration and notify admins
exports.registerDoctor = async (req, res) => {
  try {
    const { firstName, lastName, email, specialization, licenseNumber, documents } = req.body;

    // Create new Doctor document
    const newDoctor = new Doctor({
      firstName,
      lastName,
      email,
      specialization,
      licenseNumber,
      documents,
      isApproved: false, // Pending approval by admin
    });

    await newDoctor.save();

    // Send the doctor registration info to admins for approval
    await exports.notifyAdminsForApproval(newDoctor);

    res.status(200).json({ success: true, message: 'Doctor registered successfully. Admins have been notified.' });
  } catch (error) {
    console.error('Error registering doctor:', error);
    res.status(500).send('Internal Server Error');
  }
};
