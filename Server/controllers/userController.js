import pool from "../config/mysql.js";

// Get all users with optional filters (role, isActive)
export const getAllUsers = async (req, res) => {
  try {
    const { role, isActive } = req.query;
    
    let query = 'SELECT id, firstName, lastName, username, role, isActive, createdAt FROM users WHERE 1=1';
    const params = [];

    if (role) {
      query += ' AND role = ?';
      params.push(role);
    }

    if (isActive !== undefined) {
      query += ' AND isActive = ?';
      params.push(isActive === 'true' ? 1 : 0);
    }

    const [users] = await pool.query(query, params);
    res.json(users);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get user by ID
export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      'SELECT id, firstName, lastName, username, role, isActive, createdAt FROM users WHERE id = ?',
      [id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
