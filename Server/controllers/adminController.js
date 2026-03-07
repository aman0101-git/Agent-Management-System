import ExcelJS from "exceljs";
import pool from "../config/mysql.js";

export const exportMasterData = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "ADMIN") {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { from, to, agents, campaigns } = req.query;

    let whereClauses = [];
    let params = [];

    // 1. Date Filter (Filtering by customer upload/creation date)
    if (from && to) {
      whereClauses.push(`cd.created_at BETWEEN ? AND ?`);
      params.push(`${from} 00:00:00`, `${to} 23:59:59`);
    } else if (from) {
      whereClauses.push(`cd.created_at >= ?`);
      params.push(`${from} 00:00:00`);
    } else if (to) {
      whereClauses.push(`cd.created_at <= ?`);
      params.push(`${to} 23:59:59`);
    }

    // 2. Agents Filter (Multi-select)
    if (agents) {
      const agentIds = agents.split(',').map(id => id.trim());
      const placeholders = agentIds.map(() => '?').join(',');
      whereClauses.push(`ac.agent_id IN (${placeholders})`);
      params.push(...agentIds);
    }

    // 3. Campaigns Filter (Multi-select)
    if (campaigns) {
      const campaignIds = campaigns.split(',').map(id => id.trim());
      const placeholders = campaignIds.map(() => '?').join(',');
      whereClauses.push(`cd.campaign_id IN (${placeholders})`);
      params.push(...campaignIds);
    }

    let whereSQL = whereClauses.length > 0 ? `WHERE ` + whereClauses.join(' AND ') : '';

    // 1. Fetch Master Data (One row per unique customer, with dynamic WHERE)
    const mainQuery = `
      SELECT 
        cd.*,
        ac.id AS case_id,
        ac.status AS case_status,
        ac.first_call_at,
        ac.last_call_at,
        c.campaign_name,
        CONCAT(u.firstName, ' ', u.lastName) AS agent_name,
        u.username AS agent_username,
        latest_ad.disposition AS latest_disposition,
        latest_ad.promise_amount AS latest_promise_amount,
        latest_ad.payment_date AS latest_payment_date,
        latest_ad.follow_up_date AS latest_follow_up_date,
        latest_ad.remarks AS latest_remarks,
        IF(coc_ptp.id IS NOT NULL, 'YES', 'NO') AS EVER_PTP,
        IF(coc_prt.id IS NOT NULL, 'YES', 'NO') AS EVER_PRT
      FROM coll_data cd
      LEFT JOIN agent_cases ac ON cd.id = ac.coll_data_id
      LEFT JOIN campaigns c ON cd.campaign_id = c.id
      LEFT JOIN users u ON ac.agent_id = u.id
      LEFT JOIN (
        SELECT ad1.* FROM agent_dispositions ad1
        JOIN (SELECT agent_case_id, MAX(id) as max_id FROM agent_dispositions GROUP BY agent_case_id) ad2 
        ON ad1.id = ad2.max_id
      ) latest_ad ON latest_ad.agent_case_id = ac.id
      LEFT JOIN customer_once_constraints coc_ptp 
        ON coc_ptp.coll_data_id = cd.id AND coc_ptp.constraint_type = 'ONCE_PTP'
      LEFT JOIN customer_once_constraints coc_prt 
        ON coc_prt.coll_data_id = cd.id AND coc_prt.constraint_type = 'ONCE_PRT'
      ${whereSQL}
      ORDER BY cd.id DESC
    `;

    const [mainData] = await pool.query(mainQuery, params);

    if (!mainData.length) {
      return res.status(404).json({ message: "No data available to export for the selected filters." });
    }

    // 2. Fetch Disposition History ONLY for the filtered cases
    const caseIds = mainData.map(row => row.case_id).filter(id => id != null);
    let historyData = [];

    if (caseIds.length > 0) {
      const historyPlaceholders = caseIds.map(() => '?').join(',');
      const [hData] = await pool.query(`
        SELECT agent_case_id, disposition, promise_amount, created_at, remarks
        FROM agent_dispositions
        WHERE agent_case_id IN (${historyPlaceholders})
        ORDER BY agent_case_id, created_at ASC
      `, caseIds);
      historyData = hData;
    }

    // Group history by case_id to find max columns needed
    const historyMap = {};
    let maxEdits = 0;
    
    historyData.forEach(row => {
      if (!historyMap[row.agent_case_id]) {
        historyMap[row.agent_case_id] = [];
      }
      historyMap[row.agent_case_id].push(row);
      if (historyMap[row.agent_case_id].length > maxEdits) {
        maxEdits = historyMap[row.agent_case_id].length;
      }
    });

    // 3. Prepare Excel Workbook
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Master Customer Report");

    // Extract headers from the main SQL query
    const firstRowKeys = Object.keys(mainData[0]);
    const columns = firstRowKeys.map(key => ({
      header: key.toUpperCase(),
      key: key
    }));

    // Generate Dynamic Header Columns based on max attempt counts
    for (let i = 1; i <= maxEdits; i++) {
      columns.push({ header: `ATTEMPT_${i}_DISPOSITION`, key: `attempt_${i}_disp` });
      columns.push({ header: `ATTEMPT_${i}_AMOUNT`, key: `attempt_${i}_amt` });
      columns.push({ header: `ATTEMPT_${i}_DATE`, key: `attempt_${i}_date` });
      columns.push({ header: `ATTEMPT_${i}_REMARKS`, key: `attempt_${i}_remarks` });
    }
    sheet.columns = columns;

    // 4. Merge data and populate rows
    mainData.forEach(row => {
      const rowData = { ...row };

      // Format SQL Date objects safely for Excel
      firstRowKeys.forEach(key => {
        if (rowData[key] instanceof Date) {
          const d = rowData[key];
          const day = String(d.getDate()).padStart(2, '0');
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const year = d.getFullYear();
          rowData[key] = `${day}/${month}/${year}`;
        }
      });

      // Append Dynamic History Data horizontally into the columns
      if (rowData.case_id && historyMap[rowData.case_id]) {
        const caseHistory = historyMap[rowData.case_id];
        caseHistory.forEach((hist, index) => {
          const i = index + 1;
          rowData[`attempt_${i}_disp`] = hist.disposition || "";
          rowData[`attempt_${i}_amt`] = hist.promise_amount || "";
          
          if (hist.created_at instanceof Date) {
            const d = hist.created_at;
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            const time = d.toTimeString().split(' ')[0];
            rowData[`attempt_${i}_date`] = `${day}/${month}/${year} ${time}`;
          } else {
            rowData[`attempt_${i}_date`] = hist.created_at || "";
          }
          
          rowData[`attempt_${i}_remarks`] = hist.remarks || "";
        });
      }

      sheet.addRow(rowData);
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="Filtered_Master_Report.xlsx"`
    );

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error("MASTER EXPORT ERROR:", err);
    res.status(500).json({ message: "Master Export failed" });
  }
};
/**
 * POST /api/admin/agent-targets
 * Admin assigns monthly target to an agent
 */
export const assignAgentTarget = async (req, res) => {
  try {
    const adminId = req.user.id; // Admin ID from JWT
    const { agentId, month, targetAmount } = req.body;

    // Validate inputs
    if (!agentId || !month || targetAmount === undefined) {
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
        message: "targetAmount must be a non-negative number" 
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
      `SELECT id, firstName, lastName FROM users WHERE id = ? AND role = 'AGENT'`,
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
        name: `${agent.firstName} ${agent.lastName}`,
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
        CONCAT(u.firstName, ' ', u.lastName) AS agent_name,
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

    query += ` ORDER BY at.month DESC, CONCAT(u.firstName, ' ', u.lastName) ASC`;

    const [targets] = await pool.query(query, params);

    // Calculate total target amount (sum of all target_amounts)
    const total_target_amount = targets.reduce((sum, t) => sum + (t.target_amount || 0), 0);

    res.json({ 
      filters: { month: month || 'all' },
      targets: targets,
      count: targets.length,
      total_target_amount
    });

  } catch (err) {
    console.error("getAllAgentTargets error:", err.message, err.stack);
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

    if (targetAmount === undefined || typeof targetAmount !== 'number' || targetAmount < 0) {
      return res.status(400).json({ 
        message: "targetAmount must be a non-negative number" 
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
