const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../models/user');
const { loginUser } = require('../controllers/authController');

describe('Authentication Tests', () => {
  beforeAll(async () => {
    await mongoose.connect('mongodb://localhost:27017/doctor-patient-test');
  });

  beforeEach(async () => {
    await User.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('Login Functionality', () => {
    it('should successfully login with correct credentials', async () => {
      // Create test user with minimum required fields
      const plainPassword = 'testPassword123';

      const testUser = new User({
        role: 'patient',
        firstName: 'Test',
        lastName: 'User',
        dob: new Date('1990-01-01'),
        gender: 'Male',
        email: 'test@example.com',
        phone: '1234567890',
        emergencyContact: '9876543210',
        languages: ['English'],
        bloodGroup: 'O+',
        medicalHistory: 'None',
        medicalFiles: [],
        password: plainPassword // Use plain password, let model middleware hash it
      });

      // Save user
      await testUser.save();

      // Verify saved user
      const savedUser = await User.findOne({ email: testUser.email }).select('+password');
      console.log('Saved user verification:', {
        email: savedUser.email,
        hasPassword: !!savedUser.password,
        hashLength: savedUser.password?.length
      });

      // Create mock request
      const req = {
        body: {
          email: testUser.email,
          password: plainPassword, // Use plain password for login
          role: testUser.role
        }
      };

      // Create mock response
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        cookie: jest.fn()
      };

      // Attempt login
      await loginUser(req, res);

      // Verify password comparison
      const passwordValid = await bcrypt.compare(plainPassword, savedUser.password);
      console.log('Password validation check:', {
        plainPassword,
        passwordValid,
        hashInDb: savedUser.password?.substring(0, 10) + '...'
      });

      // Assertions
      expect(res.status).not.toHaveBeenCalledWith(401);
      expect(res.json).not.toHaveBeenCalledWith(
        expect.objectContaining({
          error: "Invalid credentials"
        })
      );
    });
  });
});