export const CollData = {

  /**
   * Fetch all loan records assigned to a specific agent
   * @param {object} pool - MySQL connection pool
   * @param {number} agentId - Logged-in agent ID
   */
  findByAgentId: async (pool, agentId) => {
    const query = `
      SELECT
        cd.id,
        cd.loan_agreement_no,
        cd.cust_name,
        cd.mobileno,
        cd.appl_id,
        cd.branch_name,
        cd.hub_name,
        cd.amt_outst,
        cd.pos,
        cd.bom_bucket,
        cd.dpd,
        cd.emi_pending_count,
        cd.last_paid_amount,
        cd.last_paid_date,
        cd.state,
        cd.loan_status,
        cd.tenure,
        cd.disb_date,
        cd.maturity_date,
        cd.ptp_date,
        cd.feedback,
        cd.res_addr,
        cd.off_addr,
        cd.campaign_id,
        cd.extra_fields,
        cd.created_at
      FROM Coll_Data cd
      INNER JOIN campaign_agents ca ON cd.campaign_id = ca.campaign_id
      WHERE ca.agent_id = ?
        AND cd.is_active = TRUE
      ORDER BY cd.id DESC
    `;

    const [rows] = await pool.query(query, [agentId]);
    return rows;
  },

  /**
   * Fetch customer by ID with full details
   * @param {object} pool - MySQL connection pool
   * @param {number} customerId - Customer ID
   * @param {number} agentId - Agent ID to verify access
   */
  findByIdWithAccess: async (pool, customerId, agentId) => {
    const query = `
      SELECT cd.*
      FROM Coll_Data cd
      INNER JOIN campaign_agents ca ON cd.campaign_id = ca.campaign_id
      WHERE cd.id = ?
        AND ca.agent_id = ?
        AND cd.is_active = TRUE
    `;

    const [rows] = await pool.query(query, [customerId, agentId]);
    return rows[0] || null;
  },

};

export default CollData;
