import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/mysql.js';
import User from '../models/userModel.js';

// SECURITY CHECK: Fail fast if no secret is provided in .env
if (!process.env.JWT_SECRET && !process.env.JWT_ACCESS_SECRET) {
  console.error("FATAL ERROR: JWT_SECRET is missing in environment variables.");
  process.exit(1); // Stop server to prevent insecure startup
}

const JWT_SECRET = process.env.JWT_SECRET || process.env.JWT_ACCESS_SECRET;
const EXPIRY_DURATION = '24h'; 
const COOKIE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 Hours in milliseconds

// REGISTER
export const register = async (req, res) => {
  try {
    const { firstName, lastName, username, password, role } = req.body;

    // Validate inputs
    if (!firstName || !lastName || !username || !password || !role) {
      return res.status(400).json({ success: false, message: 'All fields required' });
    }

    if (!['ADMIN', 'AGENT'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }

    // Check if user exists
    const existingUser = await User.findByUsername(pool, username);
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Username already exists' });
    }

    // Hash password and create user
    const hashedPassword = await bcrypt.hash(password, 10);
    await User.create(pool, {
      firstName,
      lastName,
      username,
      password: hashedPassword,
      role,
    });

    res.status(201).json({ success: true, message: 'Registration successful' });
  } catch (err) {
    console.error("Register Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// LOGIN
export const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password required' });
    }

    // Find user
    const user = await User.findByUsername(pool, username);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check Active Status (CRITICAL for production: Block fired agents)
    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account is inactive. Contact Admin.' });
    }

    // Validate password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign(
      { id: user.id, role: user.role }, 
      JWT_SECRET, 
      { expiresIn: EXPIRY_DURATION }
    );

    const expiresAt = new Date(Date.now() + COOKIE_MAX_AGE).toISOString();

    // Role-based redirect path
    const redirectTo = user.role === 'ADMIN' ? '/admin/dashboard' : '/agent/dashboard';

    res.status(200).json({
      success: true,
      token,
      redirectTo,
      expiresAt,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// LOGOUT
export const logout = (req, res) => {
  res.status(200).json({ success: true, message: 'Logged out successfully' });
};