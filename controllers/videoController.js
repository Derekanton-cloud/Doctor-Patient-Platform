const twilio = require("twilio");
require("dotenv").config();

const AccessToken = twilio.jwt.AccessToken;
const VideoGrant = AccessToken.VideoGrant;

// Generate Twilio Video Token
exports.generateVideoToken = (req, res) => {
  try {
    const { roomName } = req.body;
    const userId = req.user.id; // Ensure user is authenticated

    if (!roomName) return res.status(400).json({ error: "Room name is required" });

    // Create the token
    const token = new AccessToken(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_API_KEY,
      process.env.TWILIO_API_SECRET,
      { identity: userId }
    );

    // Add video permissions to the token
    token.addGrant(new VideoGrant({ room: roomName }));

    res.status(200).json({ token: token.toJwt(), roomName });
  } catch (err) {
    console.error("Error generating video token:", err);
    res.status(500).json({ error: "Error generating video token" });
  }
};
