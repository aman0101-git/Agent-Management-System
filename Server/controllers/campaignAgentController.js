import pool from "../config/mysql.js";

// Get agents assigned to a campaign
export const getCampaignAgents = async (req, res) => {
  const { id } = req.params;

  const [rows] = await pool.query(
    `SELECT u.id, u.firstName, u.lastName, u.username
     FROM campaign_agents ca
     JOIN users u ON ca.agent_id = u.id
     WHERE ca.campaign_id = ? AND u.role = 'AGENT'`,
    [id]
  );

  res.json(rows);
};

// Assign agent to campaign
export const assignAgentToCampaign = async (req, res) => {
  const { id } = req.params; // campaign_id
  const { agentId } = req.body;

  if (!agentId)
    return res.status(400).json({ message: "Agent required" });

  await pool.query(
    `INSERT IGNORE INTO campaign_agents (campaign_id, agent_id)
     VALUES (?, ?)`,
    [id, agentId]
  );

  res.status(201).json({ message: "Agent assigned" });
};

// Remove agent from campaign
export const removeAgentFromCampaign = async (req, res) => {
  const { id, agentId } = req.params;

  await pool.query(
    `DELETE FROM campaign_agents
     WHERE campaign_id = ? AND agent_id = ?`,
    [id, agentId]
  );

  res.json({ message: "Agent removed" });
};
