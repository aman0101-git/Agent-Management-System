export const CollData = {

  /**
   * Fetch all loan records assigned to a specific agent
   * @param {object} pool - MySQL connection pool
   * @param {number} agentId - Logged-in agent ID
   */
  findByAgentId: async (pool, agentId) => {
    const query = `
      SELECT
        id,
        cust_name,
        mobileno,
        appl_id,
        amt_outst,
        pos,
        dpd,
        emi_pending_count,
        last_paid_amount,
        last_paid_date,
        state,
        created_at
      FROM Coll_Data
      WHERE agent_id = ?
        AND is_active = TRUE
      ORDER BY id DESC
    `;

    const [rows] = await pool.query(query, [agentId]);
    return rows;
  },

};

export default CollData;
