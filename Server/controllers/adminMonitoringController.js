import pool from "../config/mysql.js";

/**
 * GET /api/admin/monitoring-analytics
 * Admin aggregated analytics across agents & campaigns
 */
export const getMonitoringAnalytics = async (req, res) => {
  try {
    const {
      campaign_id = "ALL",
      agent_id = "ALL",
      start_date,
      end_date,
    } = req.query;

    /* ==========================================
       1. VALIDATION & DATES
       ========================================== */
    if (!start_date || !end_date) {
      return res
        .status(400)
        .json({ message: "start_date and end_date are required" });
    }

    const startDate = new Date(start_date);
    const endDate = new Date(end_date);

    if (isNaN(startDate) || isNaN(endDate)) {
      return res.status(400).json({ message: "Invalid date format" });
    }

    endDate.setHours(23, 59, 59, 999);

    const startDateStr = startDate.toISOString();
    const endDateStr = endDate.toISOString();

    /* ==========================================
       2. MONTHLY DATE RANGE (For Targets/Summary)
       ========================================== */
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const monthEnd = new Date();
    monthEnd.setMonth(monthEnd.getMonth() + 1);
    monthEnd.setDate(0);
    monthEnd.setHours(23, 59, 59, 999);

    const monthStartStr = monthStart.toISOString();
    const monthEndStr = monthEnd.toISOString();

    const currentMonth = `${monthStart.getFullYear()}-${String(
      monthStart.getMonth() + 1
    ).padStart(2, "0")}`;

    /* ==========================================
       3. DYNAMIC FILTERS (Applied to ALL queries)
       ========================================== */
    let whereClause = `
      WHERE u.role = 'AGENT'
        AND u.isActive = 1
    `;
    const params = [];

    // Parse comma-separated agent IDs
    if (agent_id !== "ALL") {
      const agentIds = agent_id.split(",").map((id) => id.trim());
      const placeholders = agentIds.map(() => "?").join(",");
      whereClause += ` AND ad.agent_id IN (${placeholders})`;
      params.push(...agentIds);
    }

    // Parse comma-separated campaign IDs
    if (campaign_id !== "ALL") {
      const campaignIds = campaign_id.split(",").map((id) => id.trim());
      const placeholders = campaignIds.map(() => "?").join(",");
      whereClause += ` AND ca.campaign_id IN (${placeholders})`;
      params.push(...campaignIds);
    }

    /* ==========================================
       SECTION A: CALLS + PTP OVERVIEW
       ========================================== */
    const [[overview]] = await pool.query(
      `
      SELECT
        COUNT(DISTINCT ad.id) AS calls_attended,
        COUNT(DISTINCT CASE WHEN ad.disposition = 'PTP' THEN ac.id END) AS ptp_count,
        COALESCE(
          SUM(CASE WHEN ad.disposition = 'PTP' THEN ad.promise_amount ELSE 0 END),
          0
        ) AS total_ptp_amount
      FROM agent_dispositions ad
      JOIN agent_cases ac ON ac.id = ad.agent_case_id
      JOIN users u ON u.id = ad.agent_id
      LEFT JOIN campaign_agents ca ON ca.agent_id = ad.agent_id
      ${whereClause}
        AND ad.created_at BETWEEN ? AND ?
      `,
      [...params, startDateStr, endDateStr]
    );

    /* ==========================================
       SECTION B & C: COLLECTION BREAKDOWN & TOTALS
       ========================================== */
    
    // ✅ FIXED: Query Params now match the SQL structure exactly (3 occurrences of whereClause)
    const queryParams = [
      ...params, startDateStr, endDateStr, // 1. Inner 'latest' table (Filters by Date)
      ...params,                           // 2. Outer 'latest_status' wrapper (Filters by Agent/Campaign only)
      ...params, startDateStr, endDateStr  // 3. 'customer_totals' table (Filters by Date)
    ];

    const [breakdownRows] = await pool.query(
      `
      SELECT 
        latest_status.disposition, 
        COUNT(DISTINCT latest_status.agent_case_id) AS customer_count, 
        COALESCE(SUM(customer_totals.total_paid), 0) AS total_amount
      FROM 
        (
          -- Usage 2: Outer Wrapper (Needs ...params)
          SELECT ad.agent_case_id, ad.disposition
          FROM agent_dispositions ad
          JOIN users u ON u.id = ad.agent_id
          LEFT JOIN campaign_agents ca ON ca.agent_id = ad.agent_id
          JOIN (
            -- Usage 1: Inner Subquery (Needs ...params + dates)
            SELECT agent_case_id, MAX(created_at) AS latest_time
            FROM agent_dispositions ad
            JOIN users u ON u.id = ad.agent_id
            LEFT JOIN campaign_agents ca ON ca.agent_id = ad.agent_id
            ${whereClause}
              AND ad.created_at BETWEEN ? AND ?
            GROUP BY agent_case_id
          ) latest 
            ON latest.agent_case_id = ad.agent_case_id 
            AND latest.latest_time = ad.created_at
          ${whereClause}
            AND ad.disposition IN ('PIF','SIF','FCL','PRT')
        ) latest_status
      JOIN 
        (
          -- Usage 3: Money Query (Needs ...params + dates)
          SELECT agent_case_id, SUM(promise_amount) as total_paid
          FROM agent_dispositions ad
          JOIN users u ON u.id = ad.agent_id
          LEFT JOIN campaign_agents ca ON ca.agent_id = ad.agent_id
          ${whereClause}
            AND ad.created_at BETWEEN ? AND ?
            AND ad.disposition IN ('PIF','SIF','FCL','PRT')
          GROUP BY agent_case_id
        ) customer_totals 
        ON customer_totals.agent_case_id = latest_status.agent_case_id
      GROUP BY latest_status.disposition
      `,
      queryParams
    );

    const breakdown = {
      PIF: { customer_count: 0, total_amount: 0 },
      SIF: { customer_count: 0, total_amount: 0 },
      FCL: { customer_count: 0, total_amount: 0 },
      PRT: { customer_count: 0, total_amount: 0 },
    };

    let totalCollectedCount = 0;
    let totalCollectedAmount = 0;

    breakdownRows.forEach((row) => {
      if (breakdown[row.disposition]) {
        breakdown[row.disposition] = {
          customer_count: row.customer_count,
          total_amount: row.total_amount,
        };
      }
      totalCollectedCount += parseInt(row.customer_count || 0);
      totalCollectedAmount += parseFloat(row.total_amount || 0);
    });

    /* ==========================================
       SECTION D: MONTHLY SUMMARY
       ========================================== */
    
    // ✅ FIXED: Monthly Query Params alignment
    const monthlyQueryParams = [
      ...params, monthStartStr, monthEndStr, // 1. Inner 'latest'
      ...params,                             // 2. Outer 'latest_status'
      ...params, monthStartStr, monthEndStr  // 3. 'customer_totals'
    ];

    const [[monthlyActuals]] = await pool.query(
      `
      SELECT 
        COUNT(DISTINCT latest_status.agent_case_id) AS total_collected_count, 
        COALESCE(SUM(customer_totals.total_paid), 0) AS total_collected_amount
      FROM 
        (
          SELECT ad.agent_case_id
          FROM agent_dispositions ad
          JOIN users u ON u.id = ad.agent_id
          LEFT JOIN campaign_agents ca ON ca.agent_id = ad.agent_id
          JOIN (
            SELECT agent_case_id, MAX(created_at) AS latest_time
            FROM agent_dispositions ad
            JOIN users u ON u.id = ad.agent_id
            LEFT JOIN campaign_agents ca ON ca.agent_id = ad.agent_id
            ${whereClause}
              AND ad.created_at BETWEEN ? AND ?
            GROUP BY agent_case_id
          ) latest 
            ON latest.agent_case_id = ad.agent_case_id 
            AND latest.latest_time = ad.created_at
          ${whereClause}
            AND ad.disposition IN ('PIF','SIF','FCL','PRT')
        ) latest_status
      JOIN 
        (
          SELECT agent_case_id, SUM(promise_amount) as total_paid
          FROM agent_dispositions ad
          JOIN users u ON u.id = ad.agent_id
          LEFT JOIN campaign_agents ca ON ca.agent_id = ad.agent_id
          ${whereClause}
            AND ad.created_at BETWEEN ? AND ?
            AND ad.disposition IN ('PIF','SIF','FCL','PRT')
          GROUP BY agent_case_id
        ) customer_totals 
        ON customer_totals.agent_case_id = latest_status.agent_case_id
      `,
      monthlyQueryParams
    );

    const [[monthlyExpected]] = await pool.query(
      `
      SELECT
        (
          COALESCE(SUM(CASE WHEN disposition='PTP' THEN promise_amount ELSE 0 END), 0)
          -
          COALESCE(SUM(CASE WHEN disposition='RTP' THEN promise_amount ELSE 0 END), 0)
        ) AS expected_amount
      FROM agent_dispositions ad
      JOIN users u ON u.id = ad.agent_id
      LEFT JOIN campaign_agents ca ON ca.agent_id = ad.agent_id
      ${whereClause}
        AND ad.created_at BETWEEN ? AND ?
      `,
      [...params, monthStartStr, monthEndStr]
    );

    /* ==========================================
       SECTION E: TARGETS
       ========================================== */
    let targetAmount = 0;

    if (agent_id !== "ALL") {
      const agentIds = agent_id.split(",").map((id) => id.trim());
      const placeholders = agentIds.map(() => "?").join(",");
      const [[row]] = await pool.query(
        `SELECT SUM(target_amount) AS target_amount FROM agent_targets WHERE agent_id IN (${placeholders}) AND month = ?`,
        [...agentIds, currentMonth]
      );
      targetAmount = row?.target_amount || 0;
    } else if (campaign_id !== "ALL") {
      const campaignIds = campaign_id.split(",").map((id) => id.trim());
      const placeholders = campaignIds.map(() => "?").join(",");
      const [[row]] = await pool.query(
        `SELECT SUM(target_amount) AS target_amount FROM campaigns WHERE id IN (${placeholders}) AND status = 'ACTIVE'`,
        campaignIds
      );
      targetAmount = row?.target_amount || 0;
    } else {
      const [[row]] = await pool.query(
        `SELECT SUM(target_amount) AS target_amount FROM campaigns WHERE status = 'ACTIVE'`
      );
      targetAmount = row?.target_amount || 0;
    }

    const monthlyActualAmount = monthlyActuals?.total_collected_amount || 0;
    const achievementPercent =
      targetAmount > 0
        ? Number(((monthlyActualAmount / targetAmount) * 100).toFixed(2))
        : null;

    /* ==========================================
       FINAL RESPONSE
       ========================================== */
    res.json({
      overview: {
        calls_attended: overview.calls_attended || 0,
        ptp_count: overview.ptp_count || 0,
        total_ptp_amount: overview.total_ptp_amount || 0,
      },
      breakdown,
      summary: {
        total_collected_count: totalCollectedCount,
        total_collected_amount: totalCollectedAmount,
      },
      monthlySummary: {
        total_collected_count: monthlyActuals?.total_collected_count || 0,
        total_collected_amount: monthlyActualAmount,
        expected_amount: monthlyExpected?.expected_amount || 0,
        target_amount: targetAmount,
        achievement_percent: achievementPercent,
      },
    });
  } catch (err) {
    console.error("getMonitoringAnalytics error:", err);
    res.status(500).json({ message: "Failed to fetch monitoring analytics" });
  }
};

/* ==========================================
   HELPERS
   ========================================== */
export const getMonitoringAgents = async (req, res) => {
  try {
    const [agents] = await pool.query(`
      SELECT id, username FROM users WHERE role = 'AGENT' AND isActive = 1 ORDER BY username
    `);
    res.json({ agents });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch agents" });
  }
};

export const getMonitoringCampaigns = async (req, res) => {
  try {
    const [campaigns] = await pool.query(`
      SELECT id, campaign_name FROM campaigns WHERE status = 'ACTIVE' ORDER BY campaign_name
    `);
    res.json({ campaigns });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch campaigns" });
  }
};

/* ==========================================
   DRILLDOWN LIST (PTP, PIF, SIF, FCL, PRT, TOTAL_COLLECTED)
   ========================================== */
export const getMonitoringDrilldown = async (req, res) => {
  try {
    const { disposition, start_date, end_date, agent_id = "ALL", campaign_id = "ALL" } = req.query;

    if (!disposition || !start_date || !end_date) {
      return res.status(400).json({ message: "disposition, start_date, and end_date are required" });
    }

    const startDate = new Date(start_date);
    const endDate = new Date(end_date);
    endDate.setHours(23, 59, 59, 999);

    const startDateStr = startDate.toISOString();
    const endDateStr = endDate.toISOString();

    let filterClause = "";
    const params = [startDateStr, endDateStr];

    if (agent_id !== "ALL") {
      const agentIds = agent_id.split(",").map((id) => id.trim());
      const placeholders = agentIds.map(() => "?").join(",");
      filterClause += ` AND ad.agent_id IN (${placeholders})`;
      params.push(...agentIds);
    }

    if (campaign_id !== "ALL") {
      const campaignIds = campaign_id.split(",").map((id) => id.trim());
      const placeholders = campaignIds.map(() => "?").join(",");
      filterClause += ` AND ca.campaign_id IN (${placeholders})`;
      params.push(...campaignIds);
    }

    // Handle "TOTAL_COLLECTED" by converting it into an IN clause
    let dispositionCondition = "";
    if (disposition === "TOTAL_COLLECTED") {
      dispositionCondition = "latest_ad.disposition IN ('PIF', 'SIF', 'FCL', 'PRT')";
    } else {
      dispositionCondition = "latest_ad.disposition = ?";
      params.push(disposition);
    }

    const [rows] = await pool.query(
      `
      SELECT 
        COALESCE(ac.customer_name, cd.cust_name) AS customer_name, 
        cd.loan_agreement_no,
        COALESCE(ac.phone, cd.mobileno) AS customer_no, 
        u.firstName AS agent_name, 
        c.campaign_name, 
        latest_ad.disposition AS latest_disposition, 
        latest_ad.promise_amount AS amount, 
        latest_ad.follow_up_date, 
        latest_ad.follow_up_time,
        latest_ad.payment_date
      FROM (
        SELECT ad.agent_case_id, MAX(ad.id) AS max_ad_id
        FROM agent_dispositions ad
        LEFT JOIN campaign_agents ca ON ca.agent_id = ad.agent_id
        WHERE ad.created_at BETWEEN ? AND ?
        ${filterClause}
        GROUP BY ad.agent_case_id
      ) target_cases
      JOIN agent_dispositions latest_ad ON latest_ad.id = target_cases.max_ad_id
      JOIN agent_cases ac ON ac.id = latest_ad.agent_case_id
      LEFT JOIN coll_data cd ON cd.id = ac.coll_data_id 
      JOIN users u ON u.id = latest_ad.agent_id
      LEFT JOIN campaign_agents ca2 ON ca2.agent_id = latest_ad.agent_id
      LEFT JOIN campaigns c ON c.id = ca2.campaign_id
      WHERE ${dispositionCondition}
      ORDER BY latest_ad.created_at DESC
      `,
      params
    );

    res.json({ data: rows });
  } catch (err) {
    console.error("getMonitoringDrilldown error:", err);
    res.status(500).json({ message: "Failed to fetch drilldown data" });
  }
};

/* ==========================================
   EXPORT DRILLDOWN CSV
   ========================================== */
export const exportMonitoringDrilldown = async (req, res) => {
  try {
    const { disposition, start_date, end_date, agent_id = "ALL", campaign_id = "ALL" } = req.query;

    if (!disposition || !start_date || !end_date) {
      return res.status(400).json({ message: "disposition, start_date, and end_date are required" });
    }

    const startDate = new Date(start_date);
    const endDate = new Date(end_date);
    endDate.setHours(23, 59, 59, 999);

    const startDateStr = startDate.toISOString();
    const endDateStr = endDate.toISOString();

    let filterClause = "";
    const params = [startDateStr, endDateStr];

    if (agent_id !== "ALL") {
      const agentIds = agent_id.split(",").map((id) => id.trim());
      const placeholders = agentIds.map(() => "?").join(",");
      filterClause += ` AND ad.agent_id IN (${placeholders})`;
      params.push(...agentIds);
    }

    if (campaign_id !== "ALL") {
      const campaignIds = campaign_id.split(",").map((id) => id.trim());
      const placeholders = campaignIds.map(() => "?").join(",");
      filterClause += ` AND ca.campaign_id IN (${placeholders})`;
      params.push(...campaignIds);
    }

    let dispositionCondition = "";
    if (disposition === "TOTAL_COLLECTED") {
      dispositionCondition = "latest_ad.disposition IN ('PIF', 'SIF', 'FCL', 'PRT')";
    } else {
      dispositionCondition = "latest_ad.disposition = ?";
      params.push(disposition);
    }

    const [rows] = await pool.query(
      `
      SELECT 
        COALESCE(ac.customer_name, cd.cust_name) AS customer_name, 
        cd.loan_agreement_no,
        COALESCE(ac.phone, cd.mobileno) AS customer_no, 
        CONCAT(u.firstName, ' ', u.lastName) AS agent_name, 
        c.campaign_name, 
        latest_ad.disposition AS latest_disposition, 
        latest_ad.promise_amount AS amount, 
        latest_ad.follow_up_date, 
        latest_ad.follow_up_time,
        latest_ad.payment_date
      FROM (
        SELECT ad.agent_case_id, MAX(ad.id) AS max_ad_id
        FROM agent_dispositions ad
        LEFT JOIN campaign_agents ca ON ca.agent_id = ad.agent_id
        WHERE ad.created_at BETWEEN ? AND ?
        ${filterClause}
        GROUP BY ad.agent_case_id
      ) target_cases
      JOIN agent_dispositions latest_ad ON latest_ad.id = target_cases.max_ad_id
      JOIN agent_cases ac ON ac.id = latest_ad.agent_case_id
      LEFT JOIN coll_data cd ON cd.id = ac.coll_data_id 
      JOIN users u ON u.id = latest_ad.agent_id
      LEFT JOIN campaign_agents ca2 ON ca2.agent_id = latest_ad.agent_id
      LEFT JOIN campaigns c ON c.id = ca2.campaign_id
      WHERE ${dispositionCondition}
      ORDER BY latest_ad.created_at DESC
      `,
      params
    );

    // Generate CSV
    const header = ["Customer Name", "Loan Agreement No", "Contact No", "Agent Name", "Campaign", "Disposition", "Amount", "Date"];
    
    const csvRows = rows.map(row => {
      let dateStr = "";
      if (["PRT", "FCL", "SIF", "PIF", "TOTAL_COLLECTED"].includes(disposition)) {
        dateStr = row.payment_date ? new Date(row.payment_date).toLocaleDateString() : "-";
      } else {
        const fDate = row.follow_up_date ? new Date(row.follow_up_date).toLocaleDateString() : "";
        const fTime = row.follow_up_time || "";
        dateStr = `${fDate} ${fTime}`.trim() || "-";
      }

      // Helper to escape commas and quotes in CSV
      const clean = (str) => `"${String(str || '').replace(/"/g, '""')}"`;

      return [
        clean(row.customer_name),
        clean(row.loan_agreement_no),
        clean(row.customer_no),
        clean(row.agent_name),
        clean(row.campaign_name),
        clean(row.latest_disposition),
        clean(row.amount || 0),
        clean(dateStr)
      ].join(',');
    });

    const csvString = header.join(',') + '\n' + csvRows.join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${disposition}_Customers.csv"`);
    res.send(csvString);

  } catch (err) {
    console.error("exportMonitoringDrilldown error:", err);
    res.status(500).json({ message: "Failed to export drilldown data" });
  }
};