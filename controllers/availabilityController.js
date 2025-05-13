const User = require("../models/user");
const DoctorAvailability = require('../models/availability');
const { validationResult } = require('express-validator');

// Get doctor's availability
exports.getDoctorAvailability = async (req, res) => {
  try {
    const doctorId = req.params.doctorId || req.user._id;
    
    let availability = await DoctorAvailability.findOne({ doctor: doctorId });
    
    if (!availability) {
      // If no availability record exists, create a default one with empty slots
      availability = new DoctorAvailability({
        doctor: doctorId,
        availableSlots: []
      });
      await availability.save();
    }
    
    return res.status(200).json({
      success: true,
      data: availability
    });
  } catch (error) {
    console.error('Error fetching doctor availability:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching availability',
      error: error.message
    });
  }
};

// Update doctor's availability
exports.updateAvailability = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  try {
    const doctorId = req.user._id;
    const { availableSlots, isOnLeave, leaveStartDate, leaveEndDate, leaveReason } = req.body;

    // Verify the user is a doctor
    const user = await User.findById(doctorId);
    if (!user || user.role !== 'doctor') {
      return res.status(403).json({
        success: false,
        message: 'Only doctors can update availability'
      });
    }

    // Update or create availability
    let availability = await DoctorAvailability.findOne({ doctor: doctorId });
    
    if (!availability) {
      availability = new DoctorAvailability({
        doctor: doctorId,
        availableSlots: availableSlots || [],
        isOnLeave: isOnLeave || false,
        leaveStartDate,
        leaveEndDate,
        leaveReason
      });
    } else {
      // Update existing record
      if (availableSlots) availability.availableSlots = availableSlots;
      if (isOnLeave !== undefined) availability.isOnLeave = isOnLeave;
      if (leaveStartDate) availability.leaveStartDate = leaveStartDate;
      if (leaveEndDate) availability.leaveEndDate = leaveEndDate;
      if (leaveReason) availability.leaveReason = leaveReason;
    }

    await availability.save();

    return res.status(200).json({
      success: true,
      message: 'Availability updated successfully',
      data: availability
    });
  } catch (error) {
    console.error('Error updating doctor availability:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while updating availability',
      error: error.message
    });
  }
};

// Add a new time slot
exports.addTimeSlot = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  try {
    const doctorId = req.user._id;
    const { day, startTime, endTime, slotDuration } = req.body;

    // Validate the time format and ensure start time is before end time
    if (!isValidTimeFormat(startTime) || !isValidTimeFormat(endTime)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid time format. Please use HH:MM format.'
      });
    }

    if (!isStartTimeBeforeEndTime(startTime, endTime)) {
      return res.status(400).json({
        success: false,
        message: 'Start time must be before end time'
      });
    }

    let availability = await DoctorAvailability.findOne({ doctor: doctorId });
    
    if (!availability) {
      availability = new DoctorAvailability({
        doctor: doctorId,
        availableSlots: []
      });
    }

    // Add new time slot
    const newSlot = {
      day,
      startTime,
      endTime,
      isAvailable: true,
      slotDuration: slotDuration || 30
    };

    availability.availableSlots.push(newSlot);
    await availability.save();

    return res.status(201).json({
      success: true,
      message: 'Time slot added successfully',
      data: availability
    });
  } catch (error) {
    console.error('Error adding time slot:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while adding time slot',
      error: error.message
    });
  }
};

// Delete a time slot
exports.deleteTimeSlot = async (req, res) => {
  try {
    const doctorId = req.user._id;
    const slotId = req.params.slotId;

    const availability = await DoctorAvailability.findOne({ doctor: doctorId });
    
    if (!availability) {
      return res.status(404).json({
        success: false,
        message: 'Availability record not found'
      });
    }

    // Find and remove the time slot
    const slotIndex = availability.availableSlots.findIndex(
      slot => slot._id.toString() === slotId
    );

    if (slotIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Time slot not found'
      });
    }

    availability.availableSlots.splice(slotIndex, 1);
    await availability.save();

    return res.status(200).json({
      success: true,
      message: 'Time slot deleted successfully',
      data: availability
    });
  } catch (error) {
    console.error('Error deleting time slot:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while deleting time slot',
      error: error.message
    });
  }
};

// Update doctor leave status
exports.updateLeaveStatus = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  try {
    const doctorId = req.user._id;
    const { isOnLeave, leaveStartDate, leaveEndDate, leaveReason } = req.body;

    let availability = await DoctorAvailability.findOne({ doctor: doctorId });
    
    if (!availability) {
      availability = new DoctorAvailability({
        doctor: doctorId,
        availableSlots: [],
        isOnLeave,
        leaveStartDate,
        leaveEndDate,
        leaveReason
      });
    } else {
      availability.isOnLeave = isOnLeave;
      availability.leaveStartDate = leaveStartDate;
      availability.leaveEndDate = leaveEndDate;
      availability.leaveReason = leaveReason;
    }

    await availability.save();

    return res.status(200).json({
      success: true,
      message: 'Leave status updated successfully',
      data: availability
    });
  } catch (error) {
    console.error('Error updating leave status:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while updating leave status',
      error: error.message
    });
  }
};

// Helper functions
function isValidTimeFormat(time) {
  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(time);
}

function isStartTimeBeforeEndTime(startTime, endTime) {
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);
  
  if (startHour < endHour) return true;
  if (startHour === endHour && startMinute < endMinute) return true;
  return false;
}