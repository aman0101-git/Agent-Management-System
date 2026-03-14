import ExcelJS from "exceljs";
import pool from "../config/mysql.js";
import { DISPOSITION_RULES, getResultStatus } from '../config/dispositionRules.js';

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

/**
 * POST /api/admin/search
 * Global search across all customers
 */
export const searchGlobalCustomers = async (req, res) => {
  try {
    const { query } = req.body;
    if (!query || query.trim().length === 0) {
      return res.status(400).json({ message: "Search query required" });
    }

    const searchTerm = `%${query}%`;

    const [customers] = await pool.query(
      `SELECT c.*, 
        (SELECT status FROM agent_cases ac WHERE ac.coll_data_id = c.id ORDER BY created_at DESC LIMIT 1) as loan_status
       FROM coll_data c
       WHERE c.loan_agreement_no LIKE ? OR c.cust_name LIKE ? OR c.mobileno LIKE ?
       ORDER BY c.id DESC LIMIT 50`,
      [searchTerm, searchTerm, searchTerm]
    );

    res.json({ data: customers, count: customers.length });
  } catch (err) {
    console.error("searchGlobalCustomers error:", err);
    res.status(500).json({ message: "Failed to search customers globally" });
  }
};

/**
 * GET /api/admin/cases/:caseId
 * Fetch single case globally (No campaign/agent restrictions)
 */
export const getAdminCaseById = async (req, res) => {
  try {
    const { caseId } = req.params;

    // 1. Fetch main case details
    const [[row]] = await pool.query(
      `SELECT c.*, 
        c.created_at AS allocation_date, c.cust_name AS customer_name, c.mobileno AS phone, c.loan_agreement_no AS loan_id,
        COALESCE(ac.status, 'NEW') AS status, ac.first_call_at, ac.last_call_at, ac.follow_up_date, ac.follow_up_time
       FROM coll_data c
       LEFT JOIN agent_cases ac ON ac.coll_data_id = c.id
       WHERE c.id = ?
       ORDER BY ac.created_at DESC LIMIT 1`,
      [caseId]
    );

    if (!row) return res.status(404).json({ message: "Case not found" });

    // 2. Fetch Disposition History
    const [dispositions] = await pool.query(
      `SELECT ad.*, u.username AS agent_name
       FROM agent_dispositions ad
       INNER JOIN agent_cases ac ON ad.agent_case_id = ac.id
       LEFT JOIN users u ON ad.agent_id = u.id
       WHERE ac.coll_data_id = ?
       ORDER BY ad.created_at DESC`,
      [caseId]
    );

    // 3. Fetch Edit History
    const [editHistory] = await pool.query(
      `SELECT eh.* FROM agent_dispositions_edit_history eh
       INNER JOIN agent_cases ac ON eh.agent_case_id = ac.id
       WHERE ac.coll_data_id = ? ORDER BY eh.edited_at DESC`,
      [caseId]
    );

    function formatTime(val) {
      if (!val) return null;
      if (typeof val === 'string') return val;
      if (val instanceof Date) return val.toTimeString().slice(0, 8);
      return String(val);
    }

    if (row.follow_up_time) row.follow_up_time = formatTime(row.follow_up_time);
    dispositions.forEach(d => { if (d.follow_up_time) d.follow_up_time = formatTime(d.follow_up_time); });
    editHistory.forEach(e => { if (e.follow_up_time) e.follow_up_time = formatTime(e.follow_up_time); });

    return res.json({ case: row, dispositions, editHistory });
  } catch (err) {
    console.error("getAdminCaseById error:", err);
    return res.status(500).json({ message: "Failed to fetch case details" });
  }
};

/**
 * POST /api/admin/cases/:caseId/disposition
 * Admin submits disposition. Associates with the latest agent_case or creates a new one.
 */
export const submitAdminDisposition = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const adminId = req.user.id;
    const { caseId } = req.params;
    const { disposition, remarks, promiseAmount, followUpDate, followUpTime, ptpTarget, paymentDate, paymentTime, isEdit } = req.body;

    const rule = DISPOSITION_RULES[disposition];
    if (!rule) return res.status(400).json({ message: `Unknown disposition: ${disposition}` });

    await conn.beginTransaction();

    // Find the latest agent_case for this customer, regardless of who owns it
    let [[agentCase]] = await conn.query(
      `SELECT id, status, coll_data_id, first_call_at FROM agent_cases WHERE coll_data_id = ? ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
      [caseId]
    );

    // If customer has NO agent_case at all, create an initial one to attach the disposition to
    if (!agentCase) {
      const [newCase] = await conn.query(
        `INSERT INTO agent_cases (agent_id, coll_data_id, status, is_active, created_at) VALUES (?, ?, 'NEW', 1, NOW())`,
        [adminId, caseId] // Log it under admin's ID
      );
      agentCase = { id: newCase.insertId, status: 'NEW', coll_data_id: caseId, first_call_at: null };
    }

    const collDataId = agentCase.coll_data_id;

    // Handle Edit History (Admin overriding existing disposition)
    let targetDispositionId = null;
    if (isEdit) {
      const [[latest]] = await conn.query(`SELECT * FROM agent_dispositions WHERE agent_case_id = ? ORDER BY id DESC LIMIT 1 FOR UPDATE`, [agentCase.id]);
      if (latest) {
        targetDispositionId = latest.id;
        await conn.query(
          `INSERT INTO agent_dispositions_edit_history (agent_case_id, disposition, remarks, promise_amount, follow_up_date, follow_up_time, ptp_target)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [agentCase.id, latest.disposition, latest.remarks, latest.promise_amount, latest.follow_up_date, latest.follow_up_time, latest.ptp_target]
        );
      }
    }

    // Insert or Update Disposition (Using Admin's ID)
    let insertedDispositionId;
    if (isEdit && targetDispositionId) {
      await conn.query(
        `UPDATE agent_dispositions SET disposition = ?, ptp_target = ?, remarks = ?, promise_amount = ?, follow_up_date = ?, follow_up_time = ?, payment_date = ?, payment_time = ?, created_at = NOW() WHERE id = ?`,
        [disposition, ptpTarget || null, remarks || null, promiseAmount || null, followUpDate || null, followUpTime || null, paymentDate || null, paymentTime || null, targetDispositionId]
      );
      insertedDispositionId = targetDispositionId;
    } else {
      const [result] = await conn.query(
        `INSERT INTO agent_dispositions (agent_case_id, agent_id, disposition, ptp_target, remarks, promise_amount, follow_up_date, follow_up_time, payment_date, payment_time, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [agentCase.id, adminId, disposition, ptpTarget || null, remarks || null, promiseAmount || null, followUpDate || null, followUpTime || null, paymentDate || null, paymentTime || null]
      );
      insertedDispositionId = result.insertId;
    }

    // Constraints and Case Status updates
    if (disposition === 'PTP' || disposition === 'PRT') {
      const constraintType = disposition === 'PTP' ? 'ONCE_PTP' : 'ONCE_PRT';
      await conn.query(
        `INSERT INTO customer_once_constraints (coll_data_id, constraint_type, triggered_disposition_id, triggered_at, is_active) VALUES (?, ?, ?, NOW(), 1)
         ON DUPLICATE KEY UPDATE triggered_disposition_id = VALUES(triggered_disposition_id), triggered_at = NOW(), is_active = 1`,
        [collDataId, constraintType, insertedDispositionId]
      );
    }

    const newStatus = getResultStatus(disposition);
    await conn.query(
      `UPDATE agent_cases SET status = ?, is_active = 0, first_call_at = ?, last_call_at = NOW(), follow_up_date = ?, follow_up_time = ? WHERE id = ?`,
      [newStatus, agentCase.first_call_at || new Date(), followUpDate || null, followUpTime || null, agentCase.id]
    );

    if (newStatus === "DONE") {
      await conn.query(`UPDATE customer_once_constraints SET is_active = 0 WHERE coll_data_id = ?`, [collDataId]);
    }

    await conn.commit();
    return res.json({ message: "Admin Disposition saved successfully", status: newStatus });
  } catch (err) {
    await conn.rollback();
    console.error("submitAdminDisposition error:", err);
    return res.status(500).json({ message: "Failed to submit disposition", error: err.message });
  } finally {
    conn.release();
  }
};

// --- Admin Visit History Endpoints ---

export const startAdminCustomerVisit = async (req, res) => {
  try {
    const admin_id = req.user.id;
    const { customer_id } = req.body;

    // 1. Check for EXISTING open visit
    const [existing] = await pool.query(
      `SELECT id, entry_time FROM agent_customer_visits 
       WHERE agent_id = ? AND customer_id = ? AND exit_time IS NULL
       LIMIT 1`,
      [admin_id, customer_id]
    );

    if (existing.length > 0) {
      const visit = existing[0];
      const visitTime = new Date(visit.entry_time).getTime();
      const hoursDiff = (Date.now() - visitTime) / (1000 * 60 * 60);

      // 2. SAFETY: If the open visit is > 12 hours old, close it.
      if (hoursDiff > 12) {
        await pool.query(`UPDATE agent_customer_visits SET exit_time = NOW() WHERE id = ?`, [visit.id]);
      } else {
        // 3. Resume it
        return res.json({ visit_id: visit.id, status: 'resumed' });
      }
    }

    // 4. Create NEW Visit
    const [result] = await pool.query(
      `INSERT INTO agent_customer_visits (agent_id, customer_id, entry_time) VALUES (?, ?, NOW())`,
      [admin_id, customer_id]
    );

    return res.json({ visit_id: result.insertId, status: 'started' });
  } catch (err) {
    console.error("startAdminCustomerVisit error:", err);
    res.status(500).json({ message: 'Failed to start visit' });
  }
};

export const endAdminCustomerVisit = async (req, res) => {
  try {
    const { visit_id } = req.body;
    if (!visit_id) return res.status(400).json({ message: "visit_id is required" });

    await pool.query(`UPDATE agent_customer_visits SET exit_time = NOW() WHERE id = ?`, [visit_id]);
    res.json({ message: 'Visit ended' });
  } catch (err) { 
    res.status(500).json({ message: 'Failed to end visit' }); 
  }
};

export const getAdminCustomerVisitHistory = async (req, res) => {
  try {
    const { customerId } = req.params;
    
    // Exact same rich query as the Agent uses
    const [history] = await pool.query(
      `
      SELECT 
        acv.entry_time, 
        acv.exit_time,
        u.username,
        (
          SELECT ad.disposition
          FROM agent_dispositions ad
          JOIN agent_cases ac ON ad.agent_case_id = ac.id
          WHERE ac.coll_data_id = acv.customer_id
            AND ad.agent_id = acv.agent_id
            AND ad.created_at >= acv.entry_time
            AND (acv.exit_time IS NULL OR ad.created_at <= acv.exit_time)
          ORDER BY ad.created_at DESC
          LIMIT 1
        ) AS disposition
      FROM agent_customer_visits acv
      LEFT JOIN users u ON u.id = acv.agent_id
      WHERE acv.customer_id = ? 
      ORDER BY acv.entry_time DESC
      LIMIT 50
      `, [customerId]
    );
    res.json({ history });
  } catch (err) { 
    res.status(500).json({ message: 'Failed to fetch history' }); 
  }
};

export const getAdminOnceConstraints = async (req, res) => {
  try {
    const { collDataId } = req.params;
    const [rows] = await pool.query(`SELECT constraint_type, triggered_at FROM customer_once_constraints WHERE coll_data_id = ? AND is_active = 1`, [collDataId]);
    res.json({ constraints: rows });
  } catch (err) { res.status(500).json({ message: 'Failed to fetch once constraints' }); }
};