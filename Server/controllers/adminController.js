import ExcelJS from "exceljs";
import pool from "../config/mysql.js";

export const exportAdminData = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "ADMIN") {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const workbook = new ExcelJS.Workbook();

    /* ===============================
       HELPER: EXPORT TABLE AS SHEET
       =============================== */
    const exportTable = async (sheetName, sql) => {
      const [rows] = await pool.query(sql);
      const sheet = workbook.addWorksheet(sheetName);
      if (!rows.length) return;

      sheet.columns = Object.keys(rows[0]).map(k => ({
        header: k,
        key: k,
      }));
      rows.forEach(r => sheet.addRow(r));
    };

    /* ===============================
       RAW TABLE SHEETS (UNCHANGED)
       =============================== */
    await exportTable("agent_cases", `SELECT * FROM agent_cases`);
    await exportTable("agent_dispositions", `SELECT * FROM agent_dispositions`);
    await exportTable(
      "agent_dispositions_edit_history",
      `SELECT * FROM agent_dispositions_edit_history`
    );
    await exportTable("agent_targets", `SELECT * FROM agent_targets`);
    await exportTable("campaigns", `SELECT * FROM campaigns`);
    await exportTable("campaign_agents", `SELECT * FROM campaign_agents`);
    await exportTable("coll_data", `SELECT * FROM coll_data`);
    await exportTable("users", `SELECT * FROM users`);

    /* ===============================
       PTP / PRT FULL ENRICHED REPORT
       =============================== */
    const [ptpRows] = await pool.query(`
      SELECT
        ac.id                   AS agent_case_id,

        cd.cust_name            AS customer_name,
        cd.mobileno             AS mobile_no,
        cd.loan_agreement_no    AS loan_id,

        ad.disposition,
        ad.ptp_target,
        ad.promise_amount,
        ad.created_at           AS disposition_created_at,

        ac.agent_id,
        u.username              AS agent_username,

        cd.campaign_id,
        c.campaign_name

      FROM agent_cases ac
      JOIN agent_dispositions ad
        ON ad.agent_case_id = ac.id
      LEFT JOIN coll_data cd
        ON cd.id = ac.coll_data_id
      LEFT JOIN users u
        ON u.id = ac.agent_id
      LEFT JOIN campaigns c
        ON c.id = cd.campaign_id
      WHERE ad.disposition IN ('PTP','PRT')
      ORDER BY ad.created_at DESC
    `);

    const ptpSheet = workbook.addWorksheet("ptp_prt_full_report");

    if (ptpRows.length) {
      ptpSheet.columns = Object.keys(ptpRows[0]).map(k => ({
        header: k,
        key: k,
      }));
      ptpRows.forEach(r => ptpSheet.addRow(r));
    }

    /* ===============================
       SEND FILE
       =============================== */
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="full_database_export.xlsx"`
    );

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error("EXPORT ERROR:", err);
    res.status(500).json({ message: "Export failed" });
  }
};

export const exportSingleTable = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "ADMIN") {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { table, from, to } = req.query;

    /**
     * Each table explicitly defines:
     * - base SQL
     * - date column WITH ALIAS
     */
    const TABLES = {
      agent_cases: {
        dateColumn: "ac.created_at",
        sql: `
          SELECT
            ac.*,
            cd.cust_name          AS customer_name,
            cd.mobileno           AS phone,
            cd.loan_agreement_no  AS loan_id,

            ac.agent_id,
            u.username            AS agent_username
          FROM agent_cases ac
          LEFT JOIN coll_data cd ON cd.id = ac.coll_data_id
          LEFT JOIN users u ON u.id = ac.agent_id
          WHERE 1=1
        `,
      },

      agent_dispositions: {
        dateColumn: "ad.created_at",
        sql: `
          SELECT
            ad.*,
            cd.cust_name          AS customer_name,
            cd.mobileno           AS phone,
            cd.loan_agreement_no  AS loan_id,

            ac.agent_id,
            u.username            AS agent_username
          FROM agent_dispositions ad
          JOIN agent_cases ac ON ac.id = ad.agent_case_id
          LEFT JOIN coll_data cd ON cd.id = ac.coll_data_id
          LEFT JOIN users u ON u.id = ac.agent_id
          WHERE 1=1
        `,
      },

      customer_once_constraints: {
        dateColumn: "coc.triggered_at",
        sql: `
          SELECT
            coc.*,
            cd.cust_name          AS customer_name,
            cd.mobileno           AS phone,
            cd.loan_agreement_no  AS loan_id,

            ac.agent_id,
            u.username            AS agent_username
          FROM customer_once_constraints coc
          JOIN agent_dispositions ad ON ad.id = coc.triggered_disposition_id
          JOIN agent_cases ac ON ac.id = ad.agent_case_id
          LEFT JOIN coll_data cd ON cd.id = ac.coll_data_id
          LEFT JOIN users u ON u.id = ac.agent_id
          WHERE 1=1
        `,
      },
    };

    if (!TABLES[table]) {
      return res.status(400).json({ message: "Invalid table name" });
    }

    let sql = TABLES[table].sql;
    const params = [];
    const dateCol = TABLES[table].dateColumn;

    // ✅ Date filter with qualified column
    if (from && to) {
      sql += ` AND ${dateCol} BETWEEN ? AND ?`;
      params.push(from, to);
    } else if (from) {
      sql += ` AND ${dateCol} >= ?`;
      params.push(from);
    } else if (to) {
      sql += ` AND ${dateCol} <= ?`;
      params.push(to);
    }

    sql += ` ORDER BY ${dateCol} DESC`;

    const [rows] = await pool.query(sql, params);

    if (!rows.length) {
      return res.status(200).send("No data available");
    }

    /* ===============================
       BUILD CSV
       =============================== */
    const headers = Object.keys(rows[0]);
    let csv = headers.join(",") + "\n";

    rows.forEach(row => {
      csv += headers
        .map(h =>
          row[h] === null || row[h] === undefined
            ? ""
            : `"${String(row[h]).replace(/"/g, '""')}"`
        )
        .join(",") + "\n";
    });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${table}_export.csv"`
    );

    res.status(200).send(csv);

  } catch (err) {
    console.error("SINGLE EXPORT ERROR:", err);
    res.status(500).json({ message: "Export failed" });
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

    res.json({ 
      filters: { month: month || 'all' },
      targets: targets,
      count: targets.length 
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
