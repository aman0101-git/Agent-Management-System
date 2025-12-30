import jwt from 'jsonwebtoken';
import pool from '../config/mysql.js';

const JWT_SECRET =
  process.env.JWT_ACCESS_SECRET ||
  process.env.JWT_SECRET ||
  'fallback_secret_key';

/**
 * Authenticate user & attach fresh DB user
 */
export const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authorization token missing' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    // decoded MUST contain userId
    if (!decoded?.id) {
      return res.status(401).json({ message: 'Invalid token payload' });
    }

    // Fetch fresh user from DB (NO TRUSTING JWT blindly)
    const [rows] = await pool.query(
      'SELECT id, role, isActive FROM users WHERE id = ?',
      [decoded.id]
    );

    if (!rows.length || !rows[0].isActive) {
      return res.status(401).json({ message: 'User not active' });
    }

    // Attach normalized user object
    req.user = {
      id: rows[0].id,
      role: rows[0].role,
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }

    return res.status(401).json({ message: 'Invalid token' });
  }
};

/**
 * Role-based access control
 */
export const allowRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    next();
  };
};
