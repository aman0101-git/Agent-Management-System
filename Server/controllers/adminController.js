import pool from '../config/mysql.js';

/**
 * POST /api/admin/agent-targets
 * Admin assigns monthly target to an agent
 */
export const assignAgentTarget = async (req, res) => {
  try {
    const adminId = req.user.id; // Admin ID from JWT
    const { agentId, month, targetAmount } = req.body;

    // Validate inputs
    if (!agentId || !month || !targetAmount) {
      return res.status(400).json({ 
        message: "agentId, month (YYYY-MM), and targetAmount required" 
      });
    }

    // Validate month format (YYYY-MM)
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ 
        message: "Invalid month format. Use YYYY-MM" 
      });
    }

    // Validate target amount
    if (typeof targetAmount !== 'number' || targetAmount < 0) {
      return res.status(400).json({ 
        message: "targetAmount must be a positive number" 
      });
    }

    // Verify agent exists
    const [[agent]] = await pool.query(
      `SELECT id FROM users WHERE id = ? AND role = 'AGENT'`,
      [agentId]
    );

    if (!agent) {
      return res.status(404).json({ message: "Agent not found" });
    }

    // Insert or update target
    const [result] = await pool.query(
      `
      INSERT INTO agent_targets (agent_id, month, target_amount, created_by, created_at)
      VALUES (?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        target_amount = VALUES(target_amount),
        updated_at = NOW()
      `,
      [agentId, month, targetAmount, adminId]
    );

    res.status(200).json({ 
      message: "Target assigned successfully",
      data: {
        agentId,
        month,
        targetAmount,
      }
    });

  } catch (err) {
    console.error("assignAgentTarget error:", err);
    res.status(500).json({ message: "Failed to assign target" });
  }
};

/**
 * GET /api/admin/agents/:agentId/targets
 * Admin views all targets for a specific agent
 */
export const getAgentTargets = async (req, res) => {
  try {
    const { agentId } = req.params;

    // Verify agent exists
    const [[agent]] = await pool.query(
      `SELECT id, name FROM users WHERE id = ? AND role = 'AGENT'`,
      [agentId]
    );

    if (!agent) {
      return res.status(404).json({ message: "Agent not found" });
    }

    // Fetch all targets for this agent
    const [targets] = await pool.query(
      `
      SELECT
        id,
        agent_id,
        month,
        target_amount,
        created_by,
        created_at,
        updated_at
      FROM agent_targets
      WHERE agent_id = ?
      ORDER BY month DESC
      `,
      [agentId]
    );

    res.json({ 
      agent: {
        id: agent.id,
        name: agent.name,
      },
      targets: targets,
      count: targets.length 
    });

  } catch (err) {
    console.error("getAgentTargets error:", err);
    res.status(500).json({ message: "Failed to fetch targets" });
  }
};

/**
 * GET /api/admin/agent-targets
 * Admin views all targets for all agents (with optional month filter)
 */
export const getAllAgentTargets = async (req, res) => {
  try {
    const { month } = req.query;

    let query = `
      SELECT
        at.id,
        at.agent_id,
        u.name AS agent_name,
        at.month,
        at.target_amount,
        at.created_at,
        at.updated_at
      FROM agent_targets at
      JOIN users u ON at.agent_id = u.id
    `;

    const params = [];

    if (month) {
      if (!/^\d{4}-\d{2}$/.test(month)) {
        return res.status(400).json({ 
          message: "Invalid month format. Use YYYY-MM" 
        });
      }
      query += ` WHERE at.month = ?`;
      params.push(month);
    }

    query += ` ORDER BY at.month DESC, u.name ASC`;

    const [targets] = await pool.query(query, params);

    res.json({ 
      filters: { month: month || 'all' },
      targets: targets,
      count: targets.length 
    });

  } catch (err) {
    console.error("getAllAgentTargets error:", err);
    res.status(500).json({ message: "Failed to fetch targets" });
  }
};

/**
 * PUT /api/admin/agent-targets/:id
 * Admin updates a specific target
 */
export const updateAgentTarget = async (req, res) => {
  try {
    const { id } = req.params;
    const { targetAmount } = req.body;

    if (!targetAmount || typeof targetAmount !== 'number' || targetAmount < 0) {
      return res.status(400).json({ 
        message: "targetAmount must be a positive number" 
      });
    }

    // Fetch existing target
    const [[target]] = await pool.query(
      `SELECT * FROM agent_targets WHERE id = ?`,
      [id]
    );

    if (!target) {
      return res.status(404).json({ message: "Target not found" });
    }

    // Update target
    await pool.query(
      `
      UPDATE agent_targets
      SET target_amount = ?, updated_at = NOW()
      WHERE id = ?
      `,
      [targetAmount, id]
    );

    res.json({ 
      message: "Target updated successfully",
      data: {
        id,
        agentId: target.agent_id,
        month: target.month,
        targetAmount,
      }
    });

  } catch (err) {
    console.error("updateAgentTarget error:", err);
    res.status(500).json({ message: "Failed to update target" });
  }
};

/**
 * DELETE /api/admin/agent-targets/:id
 * Admin deletes a specific target
 */
export const deleteAgentTarget = async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch existing target
    const [[target]] = await pool.query(
      `SELECT * FROM agent_targets WHERE id = ?`,
      [id]
    );

    if (!target) {
      return res.status(404).json({ message: "Target not found" });
    }

    // Delete target
    await pool.query(
      `DELETE FROM agent_targets WHERE id = ?`,
      [id]
    );

    res.json({ 
      message: "Target deleted successfully",
      data: {
        id,
        agentId: target.agent_id,
        month: target.month,
      }
    });

  } catch (err) {
    console.error("deleteAgentTarget error:", err);
    res.status(500).json({ message: "Failed to delete target" });
  }
};
