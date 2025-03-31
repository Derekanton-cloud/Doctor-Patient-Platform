const twilio = require('twilio');

// Twilio Credentials
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

// Generate Twilio Room
const generateTwilioRoom = async (roomName) => {
  try {
    const room = await client.video.rooms.create({
      uniqueName: roomName,
      type: 'group',
      recordParticipantsOnConnect: true,
    });
    return room;
  } catch (error) {
    console.error("Error creating Twilio room:", error);
    throw new Error("Failed to create video room");
  }
};

module.exports = { generateTwilioRoom };
