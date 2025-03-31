const dotenv = require('dotenv');
dotenv.config();

module.exports = {
  port: process.env.PORT,
  mongoURI: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  emailUser: process.env.EMAIL_USER,
  emailPass: process.env.EMAIL_PASS,
  twilioAccountSID: process.env.TWILIO_ACCOUNT_SID,
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
  twilioApiKey: process.env.TWILIO_API_KEY,
  twilioApiSecret: process.env.TWILIO_API_SECRET,
  callbackURL: process.env.CALLBACK_URL,
  sessionSecret: process.env.SESSION_SECRET,
};
