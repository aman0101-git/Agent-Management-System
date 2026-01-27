import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/mysql.js';
import User from '../models/userModel.js';

const JWT_SECRET = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || 'fallback_secret_key';

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
    res.status(500).json({ success: false, message: err.message });
  }
};

// LOGIN
export const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate inputs
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password required' });
    }

    // Find user
    const user = await User.findByUsername(pool, username);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Validate password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }

    // Generate token
   const token = jwt.sign(
     { id: user.id, role: user.role, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() }, 
     JWT_SECRET, 
     { expiresIn: '24h' }
   );

    // Role-based redirect path for frontend
    const redirectTo = user.role === 'ADMIN' ? '/admin/dashboard' : '/agent/dashboard';

    res.status(200).json({
      success: true,
      token,
      redirectTo,
     expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        role: user.role,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// LOGOUT
export const logout = (req, res) => {
  // Token is removed on client-side via localStorage.removeItem
  // This endpoint confirms logout on server-side if needed
  res.status(200).json({ success: true, message: 'Logged out successfully' });
};