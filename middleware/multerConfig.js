const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create storage directories if they don't exist
const createDirIfNotExists = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// Base upload directory
const UPLOAD_BASE_DIR = 'public/uploads';
createDirIfNotExists(UPLOAD_BASE_DIR);

// Doctor uploads directory
const DOCTOR_UPLOAD_DIR = `${UPLOAD_BASE_DIR}/doctors`;
createDirIfNotExists(DOCTOR_UPLOAD_DIR);

// Patient uploads directory
const PATIENT_UPLOAD_DIR = `${UPLOAD_BASE_DIR}/patients`;
createDirIfNotExists(PATIENT_UPLOAD_DIR);

// Medical records uploads directory
const RECORDS_UPLOAD_DIR = `${UPLOAD_BASE_DIR}/medical-records`;
createDirIfNotExists(RECORDS_UPLOAD_DIR);

// Message attachments directory
const MESSAGE_UPLOAD_DIR = `${UPLOAD_BASE_DIR}/messages`;
createDirIfNotExists(MESSAGE_UPLOAD_DIR);

// Set up storage for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Determine the destination folder based on the file type or route
    let uploadDir = UPLOAD_BASE_DIR;
    
    // Get the route path to determine upload destination
    const routePath = req.originalUrl;
    
    if (routePath.includes('/doctors/')) {
      uploadDir = DOCTOR_UPLOAD_DIR;
    } else if (routePath.includes('/patient/')) {
      uploadDir = PATIENT_UPLOAD_DIR;
    } else if (routePath.includes('/medicalrecords/')) {
      uploadDir = RECORDS_UPLOAD_DIR;
    } else if (routePath.includes('/messages/')) {
      uploadDir = MESSAGE_UPLOAD_DIR;
    }
    
    // Create destination folder if it doesn't exist
    createDirIfNotExists(uploadDir);
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Create a unique filename with original extension
    const fileExt = path.extname(file.originalname);
    const fileName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${fileExt}`;
    cb(null, fileName);
  }
});

// File filter function to validate uploaded files
const fileFilter = (req, file, cb) => {
  // Define allowed file types
  const allowedTypes = [
    'image/jpeg', 
    'image/png', 
    'image/jpg', 
    'application/pdf',
    'application/msword', 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/vnd.ms-excel', 
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'text/plain'
  ];
  
  // Accept or reject file based on mime type
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images, PDFs, Office documents and text files are allowed.'), false);
  }
};

// Configure multer with storage and file filter
const upload = multer({
  storage,
  fileFilter,
  limits: { 
    fileSize: 10 * 1024 * 1024, // 10MB file size limit
    files: 5 // Maximum 5 files per upload
  }
});

// Export the upload middleware
module.exports = upload;