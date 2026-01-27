import pool from "../config/mysql.js";

// POST /api/agent/customer-visit/start
export const startCustomerVisit = async (req, res) => {
  try {
    const agent_id = req.user?.id;
    const { customer_id } = req.body;

    if (!agent_id) return res.status(401).json({ message: "Unauthorized" });
    if (!customer_id) return res.status(400).json({ message: "customer_id is required" });

    const [result] = await pool.query(
      `INSERT INTO agent_customer_visits (agent_id, customer_id, entry_time) VALUES (?, ?, NOW())`,
      [agent_id, customer_id]
    );

    return res.json({ visit_id: result.insertId });
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

    const [result] = await pool.query(
      `UPDATE agent_customer_visits SET exit_time = NOW() WHERE id = ? AND exit_time IS NULL`,
      [visit_id]
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({ message: "Visit already closed or not found" });
    }

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
      `,
      [customer_id]
    );

    return res.json({ history: rows });
  } catch (err) {
    console.error("getCustomerVisitHistory error:", err);
    res.status(500).json({ message: "Failed to fetch visit history" });
  }
};
