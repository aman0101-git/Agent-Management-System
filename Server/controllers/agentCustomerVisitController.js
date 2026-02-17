import pool from "../config/mysql.js";

// POST /api/agent/customer-visit/start
export const startCustomerVisit = async (req, res) => {
  try {
    const agent_id = req.user?.id;
    const { customer_id } = req.body;

    if (!agent_id) return res.status(401).json({ message: "Unauthorized" });
    if (!customer_id) return res.status(400).json({ message: "customer_id is required" });

    // 1. Check for EXISTING open visit
    const [existing] = await pool.query(
      `SELECT id, entry_time FROM agent_customer_visits 
       WHERE agent_id = ? AND customer_id = ? AND exit_time IS NULL
       LIMIT 1`,
      [agent_id, customer_id]
    );

    if (existing.length > 0) {
      const visit = existing[0];
      const visitTime = new Date(visit.entry_time).getTime();
      const now = Date.now();
      const hoursDiff = (now - visitTime) / (1000 * 60 * 60);

      // 2. SAFETY: If the open visit is > 12 hours old, it's a ghost. Close it.
      if (hoursDiff > 12) {
        await pool.query(`UPDATE agent_customer_visits SET exit_time = NOW() WHERE id = ?`, [visit.id]);
        // Fall through to create NEW visit
      } else {
        // 3. Else, Resume it (prevents duplicates on refresh)
        return res.json({ visit_id: visit.id, status: 'resumed' });
      }
    }

    // 4. Create NEW Visit
    const [result] = await pool.query(
      `INSERT INTO agent_customer_visits (agent_id, customer_id, entry_time) VALUES (?, ?, NOW())`,
      [agent_id, customer_id]
    );

    return res.json({ visit_id: result.insertId, status: 'started' });
  } catch (err) {
    console.error("startCustomerVisit error:", err);
    res.status(500).json({ message: "Failed to start visit" });
  }
};

// POST /api/agent/customer-visit/end
export const endCustomerVisit = async (req, res) => {
  try {
    const { visit_id } = req.body;

    if (!visit_id) return res.status(400).json({ message: "visit_id is required" });

    // Update exit time
    await pool.query(
      `UPDATE agent_customer_visits SET exit_time = NOW() WHERE id = ?`,
      [visit_id]
    );

    // OPTIONAL: Clean up "Instant" visits (noise data < 2 seconds)
    // await pool.query(`DELETE FROM agent_customer_visits WHERE id = ? AND TIMESTAMPDIFF(SECOND, entry_time, exit_time) < 2`, [visit_id]);

    return res.json({ success: true });
  } catch (err) {
    console.error("endCustomerVisit error:", err);
    res.status(500).json({ message: "Failed to end visit" });
  }
};

// GET /api/agent/customer-visit/history/:customer_id
export const getCustomerVisitHistory = async (req, res) => {
  try {
    const { customer_id } = req.params;
    if (!customer_id) return res.status(400).json({ message: "customer_id is required" });

    const [rows] = await pool.query(
      `
      SELECT 
        acv.entry_time, 
        acv.exit_time,
        u.username
      FROM agent_customer_visits acv
      LEFT JOIN users u ON u.id = acv.agent_id
      WHERE acv.customer_id = ? 
      ORDER BY acv.entry_time DESC
      LIMIT 50
      `,
      [customer_id]
    );

    return res.json({ history: rows });
  } catch (err) {
    console.error("getCustomerVisitHistory error:", err);
    res.status(500).json({ message: "Failed to fetch visit history" });
  }
};