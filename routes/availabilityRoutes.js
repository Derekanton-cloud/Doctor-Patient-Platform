const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const availabilityController = require('../controllers/availabilityController');
const auth = require('../middleware/auth');

// Utility function to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Get doctor's availability
// Public route - anyone can view a doctor's availability
router.get('/doctor/:doctorId', availabilityController.getDoctorAvailability);

// Get current doctor's availability (for the doctor's dashboard)
router.get('/my-availability', auth, availabilityController.getDoctorAvailability);

// Update doctor's entire availability
router.put(
  '/update',
  auth, // Only authenticated users can access
  [
    check('availableSlots', 'Available slots must be an array').optional().isArray(),
    check('isOnLeave', 'isOnLeave must be a boolean').optional().isBoolean(),
    check('leaveStartDate', 'Invalid leave start date').optional().isISO8601(),
    check('leaveEndDate', 'Invalid leave end date').optional().isISO8601(),
  ],
  handleValidationErrors,
  availabilityController.updateAvailability
);

// Add a new time slot
router.post(
  '/add-slot',
  auth, // Only authenticated users can access
  [
    check('day', 'Day is required').notEmpty(),
    check('day', 'Invalid day of the week').isIn([
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ]),
    check('startTime', 'Start time is required').notEmpty(),
    check('endTime', 'End time is required').notEmpty(),
    check('slotDuration', 'Slot duration must be a number').optional().isNumeric(),
  ],
  handleValidationErrors,
  availabilityController.addTimeSlot
);

// Delete a time slot
router.delete(
  '/delete-slot/:slotId',
  auth, // Only authenticated users can access
  availabilityController.deleteTimeSlot
);

// Update leave status
router.put(
  '/leave-status',
  auth, // Only authenticated users can access
  [
    check('isOnLeave', 'isOnLeave is required').notEmpty().isBoolean(),
    check('leaveStartDate', 'Invalid leave start date').optional().isISO8601(),
    check('leaveEndDate', 'Invalid leave end date').optional().isISO8601(),
  ],
  handleValidationErrors,
  availabilityController.updateLeaveStatus
);

module.exports = router;