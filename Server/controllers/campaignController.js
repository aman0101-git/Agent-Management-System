import pool from "../config/mysql.js";

// Create campaign
export const createCampaign = async (req, res) => {
  try {
    const { campaign_name, description } = req.body;
    if (!campaign_name)
      return res.status(400).json({ message: "Campaign name required" });

    const [result] = await pool.query(
      "INSERT INTO campaigns (campaign_name, description, status) VALUES (?, ?, ?)",
      [campaign_name, description || null, 'ACTIVE']
    );

    res.status(201).json({ message: "Campaign created", id: result.insertId });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// List ONLY ACTIVE campaigns (default behavior)
export const listCampaigns = async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, campaign_name, description, status, created_at FROM campaigns WHERE status = 'ACTIVE' ORDER BY created_at DESC"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Rename campaign (ONLY if active)
export const updateCampaignName = async (req, res) => {
  try {
    const { id } = req.params;
    const { campaign_name, description } = req.body;

    if (!campaign_name)
      return res.status(400).json({ message: "Campaign name required" });

    const [campaign] = await pool.query(
      "SELECT id FROM campaigns WHERE id = ? AND status = 'ACTIVE'",
      [id]
    );

    if (!campaign.length)
      return res.status(400).json({ message: "Inactive campaign cannot be edited" });

    await pool.query(
      "UPDATE campaigns SET campaign_name = ?, description = ? WHERE id = ?",
      [campaign_name, description || null, id]
    );

    res.json({ message: "Campaign name updated" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// List ALL campaigns (for management screen)
export const listAllCampaigns = async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, campaign_name, description, status, created_at FROM campaigns ORDER BY created_at DESC"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Deactivate campaign
export const deactivateCampaign = async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(
      "UPDATE campaigns SET status = 'INACTIVE' WHERE id = ?",
      [id]
    );

    res.json({ message: "Campaign deactivated" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Activate campaign
export const activateCampaign = async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(
      "UPDATE campaigns SET status = 'ACTIVE' WHERE id = ?",
      [id]
    );

    res.json({ message: "Campaign activated" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Distribute campaign data equally among assigned agents
export const distributeCampaignData = async (req, res) => {
  const campaignId = req.params.id;

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // 1. Get assigned agents
    const [agents] = await conn.query(
      `SELECT agent_id FROM campaign_agents WHERE campaign_id = ?`,
      [campaignId]
    );

    if (agents.length === 0) {
      await conn.rollback();
      return res.status(400).json({ message: "No agents assigned to campaign" });
    }

    // 2. Get unassigned data
    const [data] = await conn.query(
      `SELECT id FROM Coll_Data
       WHERE campaign_id = ?
         AND agent_id IS NULL
         AND is_active = TRUE
       ORDER BY id`,
      [campaignId]
    );

    if (data.length === 0) {
      await conn.rollback();
      return res.status(400).json({ message: "No unassigned data available" });
    }

    // 3. Equal distribution
    const agentCount = agents.length;
    const perAgent = Math.floor(data.length / agentCount);

    if (perAgent === 0) {
      await conn.rollback();
      return res.status(400).json({
        message: "Not enough data to distribute equally",
      });
    }

    let index = 0;
    let totalAssigned = 0;

    for (const agent of agents) {
      const chunk = data.slice(index, index + perAgent);
      const ids = chunk.map((row) => row.id);

      if (ids.length > 0) {
        await conn.query(
          `UPDATE Coll_Data
           SET agent_id = ?
           WHERE id IN (?)`,
          [agent.agent_id, ids]
        );
        totalAssigned += ids.length;
      }

      index += perAgent;
    }

    await conn.commit();

    res.json({
      success: true,
      campaignId,
      agents: agentCount,
      distributed: totalAssigned,
    });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ message: err.message });
  } finally {
    conn.release();
  }
};

// Campaign distribution summary
export const getCampaignDistributionSummary = async (req, res) => {
  const campaignId = req.params.id;

  try {
    // total data
    const [[total]] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM Coll_Data
       WHERE campaign_id = ? AND is_active = TRUE`,
      [campaignId]
    );

    // unassigned data
    const [[unassigned]] = await pool.query(
      `SELECT COUNT(*) AS unassigned
       FROM Coll_Data
       WHERE campaign_id = ?
         AND agent_id IS NULL
         AND is_active = TRUE`,
      [campaignId]
    );

    // assigned data
    const assigned = total.total - unassigned.unassigned;

    // agent-wise distribution
    const [agentStats] = await pool.query(
      `SELECT
         u.id AS agent_id,
         u.firstName,
         u.lastName,
         COUNT(cd.id) AS allocated_count
       FROM campaign_agents ca
       JOIN users u ON u.id = ca.agent_id
       LEFT JOIN Coll_Data cd
         ON cd.agent_id = u.id
        AND cd.campaign_id = ?
        AND cd.is_active = TRUE
       WHERE ca.campaign_id = ?
       GROUP BY u.id`,
      [campaignId, campaignId]
    );

    res.json({
      campaignId,
      totalRecords: total.total,
      assignedRecords: assigned,
      unassignedRecords: unassigned.unassigned,
      agents: agentStats,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
