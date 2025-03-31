const express = require('express');
const router = express.Router();
const { authenticateUser, authorizeRole } = require('../middleware/authMiddleware');
const twilio = require('twilio');
require('dotenv').config();

const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// Generate Access Token for Video Call (Doctors and Patients only)
router.get('/token', authenticateUser, authorizeRole(['doctor', 'patient']), async (req, res) => {
  try {
    const AccessToken = twilio.jwt.AccessToken;
    const VideoGrant = AccessToken.VideoGrant;

    // Create a unique video room for doctor-patient consultation
    const roomName = `room_${req.user._id}_${Date.now()}`;

    // Generate Access Token for the authenticated user
    const token = new AccessToken(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_API_KEY,
      process.env.TWILIO_API_SECRET,
      { ttl: 3600 }
    );

    token.identity = req.user.email; // Set user identity to their email
    token.addGrant(new VideoGrant({ room: roomName })); // Grant access to video room

    res.status(200).json({ token: token.toJwt(), roomName });
  } catch (error) {
    console.error('Error generating Twilio token:', error);
    res.status(500).json({ error: 'Failed to generate video token' });
  }
});

// Check Room Status (Doctors and Patients only)
router.get('/room/:roomName', authenticateUser, authorizeRole(['doctor', 'patient']), async (req, res) => {
  try {
    const roomName = req.params.roomName;
    const room = await twilioClient.video.v1.rooms(roomName).fetch();
    res.status(200).json({ status: room.status });
  } catch (error) {
    res.status(404).json({ error: 'Room not found or inactive' });
  }
});

// End Video Call (Doctors only)
router.post('/room/:roomName/end', authenticateUser, authorizeRole(['doctor']), async (req, res) => {
  try {
    const roomName = req.params.roomName;
    await twilioClient.video.v1.rooms(roomName).update({ status: 'completed' });
    res.status(200).json({ message: 'Room ended successfully' });
  } catch (error) {
    console.error('Error ending Twilio room:', error);
    res.status(500).json({ error: 'Failed to end room' });
  }
});

module.exports = router;
