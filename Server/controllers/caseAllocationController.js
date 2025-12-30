import pool from "../config/mysql.js";

/**
 * ADMIN – Allocate cases to agent
 */
export const allocateCasesToAgent = async (req, res) => {
  const { agentId, campaignId, limit = 100 } = req.body;

  if (!agentId || !campaignId) {
    return res.status(400).json({ message: "agentId and campaignId required" });
  }

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [result] = await conn.query(
      `
      INSERT INTO agent_cases (
        agent_id,
        campaign_id,
        coll_data_id,
        allocation_date,
        customer_name,
        phone,
        loan_id,
        status
      )
      SELECT
        ?,
        cd.campaign_id,
        cd.id,
        CURDATE(),
        cd.cust_name,
        cd.mobileno,
        cd.loan_agreement_no,
        'NEW'
      FROM coll_data cd
      WHERE cd.campaign_id = ?
        AND cd.agent_id = ?
        AND NOT EXISTS (
          SELECT 1 FROM agent_cases ac
          WHERE ac.coll_data_id = cd.id
        )
      ORDER BY cd.dpd DESC
      LIMIT ?
      `,
      [agentId, campaignId, limit]
    );

    await conn.commit();

    return res.json({
      message: "Cases allocated successfully",
      allocated: result.affectedRows,
    });
  } catch (err) {
    await conn.rollback();
    console.error("Allocation error:", err);
    return res.status(500).json({ message: "Allocation failed" });
  } finally {
    conn.release();
  }
};
