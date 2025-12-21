export const User = {
  // Find user by username
  findByUsername: async (pool, username) => {
    const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
    return rows[0] || null;
  },

  // Find user by ID
  findById: async (pool, id) => {
    const [rows] = await pool.query('SELECT id, firstName, lastName, username, role, isActive, createdAt FROM users WHERE id = ?', [id]);
    return rows[0] || null;
  },

  // Create new user
  create: async (pool, userData) => {
    const { firstName, lastName, username, password, role } = userData;
    const [result] = await pool.query(
      'INSERT INTO users (firstName, lastName, username, password, role) VALUES (?, ?, ?, ?, ?)',
      [firstName, lastName, username, password, role]
    );
    return result.insertId || result.insertId === 0 ? result.insertId : null;
  },

  // Update user
  update: async (pool, id, userData) => {
    const { firstName, lastName, role, isActive } = userData;
    await pool.query(
      'UPDATE users SET firstName = ?, lastName = ?, role = ?, isActive = ? WHERE id = ?',
      [firstName, lastName, role, isActive, id]
    );
  },

  // Delete user
  delete: async (pool, id) => {
    await pool.query('DELETE FROM users WHERE id = ?', [id]);
  },

  // Get all users
  getAll: async (pool, filters = {}) => {
    let query = 'SELECT id, firstName, lastName, username, role, isActive, createdAt FROM users WHERE 1=1';
    const params = [];

    if (filters.role) {
      query += ' AND role = ?';
      params.push(filters.role);
    }

    if (filters.isActive !== undefined) {
      query += ' AND isActive = ?';
      params.push(filters.isActive);
    }

    const [rows] = await pool.query(query, params);
    return rows;
  },
};

export default User;
