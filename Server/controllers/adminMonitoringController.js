import pool from "../config/mysql.js";

/* ==========================================
   HELPERS
   ========================================== */
export const getMonitoringAgents = async (req, res) => {
  try {
    const [agents] = await pool.query(`
      SELECT id, firstName FROM users WHERE role = 'AGENT' AND isActive = 1 ORDER BY firstName
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

    if (!start_date || !end_date) return res.status(400).json({ message: "start_date and end_date are required" });

    const startDate = new Date(start_date);
    const endDate = new Date(end_date);
    if (isNaN(startDate) || isNaN(endDate)) return res.status(400).json({ message: "Invalid date format" });
    endDate.setHours(23, 59, 59, 999);

    const startDateStr = startDate.toISOString();
    const endDateStr = endDate.toISOString();

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthEnd = new Date();
    monthEnd.setMonth(monthEnd.getMonth() + 1);
    monthEnd.setDate(0);
    monthEnd.setHours(23, 59, 59, 999);

    const monthStartStr = monthStart.toISOString();
    const monthEndStr = monthEnd.toISOString();
    const currentMonth = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, "0")}`;

    // 🟢 FIXED: Base where clause
    let whereClause = `WHERE u.role = 'AGENT' AND u.isActive = 1`;
    const params = [];

    if (agent_id !== "ALL") {
      const agentIds = agent_id.split(",").map((id) => id.trim());
      const placeholders = agentIds.map(() => "?").join(",");
      whereClause += ` AND ad.agent_id IN (${placeholders})`;
      params.push(...agentIds);
    }

    if (campaign_id !== "ALL") {
      const campaignIds = campaign_id.split(",").map((id) => id.trim());
      const placeholders = campaignIds.map(() => "?").join(",");
      // 🟢 FIXED: Now filters by the actual Customer's campaign (cd.campaign_id), NOT the agent's assigned campaigns
      whereClause += ` AND cd.campaign_id IN (${placeholders})`;
      params.push(...campaignIds);
    }

    /* ==========================================
       SECTION A: CALLS + PTP OVERVIEW
       ========================================== */
    const [[overviewCalls]] = await pool.query(
      `
      SELECT COUNT(DISTINCT ad.id) AS calls_attended
      FROM agent_dispositions ad
      JOIN users u ON u.id = ad.agent_id
      JOIN agent_cases ac ON ac.id = ad.agent_case_id
      JOIN coll_data cd ON cd.id = ac.coll_data_id
      ${whereClause} AND ad.created_at BETWEEN ? AND ?
      `,
      [...params, startDateStr, endDateStr]
    );

    const [[ptpData]] = await pool.query(
      `
      SELECT 
        COUNT(latest_ad.id) AS ptp_count,
        COALESCE(SUM(latest_ad.promise_amount), 0) AS total_ptp_amount
      FROM (
        SELECT agent_case_id, MAX(ad.id) AS max_id
        FROM agent_dispositions ad
        JOIN users u ON u.id = ad.agent_id
        JOIN agent_cases ac ON ac.id = ad.agent_case_id
        JOIN coll_data cd ON cd.id = ac.coll_data_id
        ${whereClause} AND ad.created_at BETWEEN ? AND ?
        GROUP BY agent_case_id
      ) latest
      JOIN agent_dispositions latest_ad ON latest_ad.id = latest.max_id
      WHERE latest_ad.disposition = 'PTP'
      `,
      [...params, startDateStr, endDateStr]
    );

    /* ==========================================
       SECTION B & C: COLLECTION BREAKDOWN & TOTALS
       ========================================== */
    const queryParams = [
      ...params, startDateStr, endDateStr, // 1. Inner 'latest'
      ...params,                           // 2. Outer 'latest_status'
      startDateStr, endDateStr,            // 3. Subquery inside customer_totals (ad_sub)
      ...params, startDateStr, endDateStr  // 4. 'customer_totals'
    ];

    const [breakdownRows] = await pool.query(
      `
      SELECT 
        latest_status.disposition, 
        COUNT(DISTINCT latest_status.agent_case_id) AS customer_count, 
        COALESCE(SUM(customer_totals.total_paid), 0) AS total_amount
      FROM 
        (
          SELECT ad.agent_case_id, ad.disposition
          FROM agent_dispositions ad
          JOIN users u ON u.id = ad.agent_id
          JOIN agent_cases ac ON ac.id = ad.agent_case_id
          JOIN coll_data cd ON cd.id = ac.coll_data_id
          JOIN (
            SELECT agent_case_id, MAX(ad.id) AS max_id
            FROM agent_dispositions ad
            JOIN users u ON u.id = ad.agent_id
            JOIN agent_cases ac ON ac.id = ad.agent_case_id
            JOIN coll_data cd ON cd.id = ac.coll_data_id
            ${whereClause} AND ad.created_at BETWEEN ? AND ?
            GROUP BY agent_case_id
          ) latest ON latest.agent_case_id = ad.agent_case_id AND latest.max_id = ad.id
          ${whereClause} AND ad.disposition IN ('PIF','SIF','FCL','PRT')
        ) latest_status
      JOIN 
        (
          SELECT ad.agent_case_id, 
            COALESCE(SUM(CASE WHEN ad.disposition = 'PRT' THEN ad.promise_amount ELSE 0 END), 0) +
            COALESCE((
              SELECT promise_amount FROM agent_dispositions ad_sub 
              WHERE ad_sub.agent_case_id = ad.agent_case_id AND ad_sub.disposition IN ('PIF','SIF','FCL') AND ad_sub.created_at BETWEEN ? AND ?
              ORDER BY ad_sub.id DESC LIMIT 1
            ), 0) AS total_paid
          FROM agent_dispositions ad
          JOIN users u ON u.id = ad.agent_id
          JOIN agent_cases ac ON ac.id = ad.agent_case_id
          JOIN coll_data cd ON cd.id = ac.coll_data_id
          ${whereClause} AND ad.created_at BETWEEN ? AND ? AND ad.disposition IN ('PIF','SIF','FCL','PRT')
          GROUP BY ad.agent_case_id
        ) customer_totals ON customer_totals.agent_case_id = latest_status.agent_case_id
      GROUP BY latest_status.disposition
      `,
      queryParams
    );

    const breakdown = { PIF: { customer_count: 0, total_amount: 0 }, SIF: { customer_count: 0, total_amount: 0 }, FCL: { customer_count: 0, total_amount: 0 }, PRT: { customer_count: 0, total_amount: 0 } };
    let totalCollectedCount = 0;
    let totalCollectedAmount = 0;

    breakdownRows.forEach((row) => {
      if (breakdown[row.disposition]) {
        breakdown[row.disposition] = { customer_count: row.customer_count, total_amount: row.total_amount };
      }
      totalCollectedCount += parseInt(row.customer_count || 0);
      totalCollectedAmount += parseFloat(row.total_amount || 0);
    });

    /* ==========================================
       SECTION D: MONTHLY SUMMARY
       ========================================== */
    const monthlyQueryParams = [
      ...params, monthStartStr, monthEndStr, 
      ...params,                             
      monthStartStr, monthEndStr,
      ...params, monthStartStr, monthEndStr  
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
          JOIN agent_cases ac ON ac.id = ad.agent_case_id
          JOIN coll_data cd ON cd.id = ac.coll_data_id
          JOIN (
            SELECT agent_case_id, MAX(ad.id) AS max_id
            FROM agent_dispositions ad
            JOIN users u ON u.id = ad.agent_id
            JOIN agent_cases ac ON ac.id = ad.agent_case_id
            JOIN coll_data cd ON cd.id = ac.coll_data_id
            ${whereClause} AND ad.created_at BETWEEN ? AND ?
            GROUP BY agent_case_id
          ) latest ON latest.agent_case_id = ad.agent_case_id AND latest.max_id = ad.id
          ${whereClause} AND ad.disposition IN ('PIF','SIF','FCL','PRT')
        ) latest_status
      JOIN 
        (
          SELECT ad.agent_case_id, 
            COALESCE(SUM(CASE WHEN ad.disposition = 'PRT' THEN ad.promise_amount ELSE 0 END), 0) +
            COALESCE((
              SELECT promise_amount FROM agent_dispositions ad_sub 
              WHERE ad_sub.agent_case_id = ad.agent_case_id AND ad_sub.disposition IN ('PIF','SIF','FCL') AND ad_sub.created_at BETWEEN ? AND ?
              ORDER BY ad_sub.id DESC LIMIT 1
            ), 0) AS total_paid
          FROM agent_dispositions ad
          JOIN users u ON u.id = ad.agent_id
          JOIN agent_cases ac ON ac.id = ad.agent_case_id
          JOIN coll_data cd ON cd.id = ac.coll_data_id
          ${whereClause} AND ad.created_at BETWEEN ? AND ? AND ad.disposition IN ('PIF','SIF','FCL','PRT')
          GROUP BY ad.agent_case_id
        ) customer_totals ON customer_totals.agent_case_id = latest_status.agent_case_id
      `,
      monthlyQueryParams
    );

    const [[monthlyExpected]] = await pool.query(
      `
      SELECT COALESCE(SUM(latest_ad.promise_amount), 0) AS expected_amount
      FROM (
        SELECT agent_case_id, MAX(ad.id) AS max_id
        FROM agent_dispositions ad
        JOIN users u ON u.id = ad.agent_id
        JOIN agent_cases ac ON ac.id = ad.agent_case_id
        JOIN coll_data cd ON cd.id = ac.coll_data_id
        ${whereClause} AND ad.created_at BETWEEN ? AND ?
        GROUP BY agent_case_id
      ) latest
      JOIN agent_dispositions latest_ad ON latest_ad.id = latest.max_id
      WHERE latest_ad.disposition = 'PTP'
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
      const [[row]] = await pool.query(`SELECT SUM(target_amount) AS target_amount FROM campaigns WHERE status = 'ACTIVE'`);
      targetAmount = row?.target_amount || 0;
    }

    const monthlyActualAmount = monthlyActuals?.total_collected_amount || 0;
    const achievementPercent = targetAmount > 0 ? Number(((monthlyActualAmount / targetAmount) * 100).toFixed(2)) : null;

    res.json({
      overview: { calls_attended: overviewCalls?.calls_attended || 0, ptp_count: ptpData?.ptp_count || 0, total_ptp_amount: ptpData?.total_ptp_amount || 0 },
      breakdown,
      summary: { total_collected_count: totalCollectedCount, total_collected_amount: totalCollectedAmount },
      monthlySummary: { total_collected_count: monthlyActuals?.total_collected_count || 0, total_collected_amount: monthlyActualAmount, expected_amount: monthlyExpected?.expected_amount || 0, target_amount: targetAmount, achievement_percent: achievementPercent },
    });
  } catch (err) {
    console.error("getMonitoringAnalytics error:", err);
    res.status(500).json({ message: "Failed to fetch monitoring analytics" });
  }
};

/* ==========================================
   DRILLDOWN LIST (PTP, PIF, SIF, FCL, PRT, TOTAL_COLLECTED)
   ========================================== */
export const getMonitoringDrilldown = async (req, res) => {
  try {
    const { disposition, start_date, end_date, agent_id = "ALL", campaign_id = "ALL" } = req.query;
    if (!disposition || !start_date || !end_date) return res.status(400).json({ message: "Missing required params" });

    const startDate = new Date(start_date);
    const endDate = new Date(end_date);
    endDate.setHours(23, 59, 59, 999);

    const startDateStr = startDate.toISOString();
    const endDateStr = endDate.toISOString();

    // 🟢 FIXED: Perfect Parameter Ordering to mirror the Analytics block
    const targetCasesParams = [startDateStr, endDateStr];
    let targetFilterClause = "";

    const totalsParams = [startDateStr, endDateStr, startDateStr, endDateStr]; // Two dates for the subquery, two for the totals
    let totalsFilterClause = "";

    const mainWhereParams = [];
    let filterClause = "";
    let dispositionCondition = "";

    if (disposition === "TOTAL_COLLECTED") {
      dispositionCondition = "latest_ad.disposition IN ('PIF', 'SIF', 'FCL', 'PRT')";
    } else {
      dispositionCondition = "latest_ad.disposition = ?";
      mainWhereParams.push(disposition);
    }

    if (agent_id !== "ALL") {
      const agentIds = agent_id.split(",").map((id) => id.trim());
      const placeholders = agentIds.map(() => "?").join(",");
      
      targetFilterClause += ` AND ad.agent_id IN (${placeholders})`;
      targetCasesParams.push(...agentIds);
      
      totalsFilterClause += ` AND ad2.agent_id IN (${placeholders})`;
      totalsParams.push(...agentIds);
      
      filterClause += ` AND latest_ad.agent_id IN (${placeholders})`;
      mainWhereParams.push(...agentIds);
    }

    if (campaign_id !== "ALL") {
      const campaignIds = campaign_id.split(",").map((id) => id.trim());
      const placeholders = campaignIds.map(() => "?").join(",");
      
      targetFilterClause += ` AND cd.campaign_id IN (${placeholders})`;
      targetCasesParams.push(...campaignIds);

      totalsFilterClause += ` AND cd2.campaign_id IN (${placeholders})`;
      totalsParams.push(...campaignIds);
      
      filterClause += ` AND cd.campaign_id IN (${placeholders})`;
      mainWhereParams.push(...campaignIds);
    }

    const finalParams = [...targetCasesParams, ...totalsParams, ...mainWhereParams];

    const [rows] = await pool.query(
      `
      SELECT 
        COALESCE(ac.customer_name, cd.cust_name) AS customer_name, 
        cd.loan_agreement_no,
        COALESCE(ac.phone, cd.mobileno) AS customer_no, 
        u.firstName AS agent_name, 
        c.campaign_name, 
        latest_ad.disposition AS latest_disposition, 
        
        CASE 
          WHEN latest_ad.disposition IN ('PIF', 'SIF', 'FCL', 'PRT') THEN COALESCE(totals.prt_paid, 0) + COALESCE(totals.terminal_paid, 0)
          ELSE latest_ad.promise_amount 
        END AS amount, 

        latest_ad.follow_up_date, latest_ad.follow_up_time, latest_ad.payment_date
      FROM (
        SELECT ad.agent_case_id, MAX(ad.id) AS max_ad_id
        FROM agent_dispositions ad
        JOIN agent_cases ac ON ac.id = ad.agent_case_id
        LEFT JOIN coll_data cd ON cd.id = ac.coll_data_id
        WHERE ad.created_at BETWEEN ? AND ?
        ${targetFilterClause}
        GROUP BY ad.agent_case_id
      ) target_cases
      JOIN agent_dispositions latest_ad ON latest_ad.id = target_cases.max_ad_id
      JOIN agent_cases ac ON ac.id = latest_ad.agent_case_id
      LEFT JOIN coll_data cd ON cd.id = ac.coll_data_id 
      JOIN users u ON u.id = latest_ad.agent_id
      LEFT JOIN campaigns c ON c.id = cd.campaign_id
      
      LEFT JOIN (
        SELECT ad2.agent_case_id, 
          COALESCE(SUM(CASE WHEN ad2.disposition = 'PRT' THEN ad2.promise_amount ELSE 0 END), 0) AS prt_paid,
          COALESCE((
            SELECT promise_amount FROM agent_dispositions ad3
            WHERE ad3.agent_case_id = ad2.agent_case_id AND ad3.disposition IN ('PIF','SIF','FCL') AND ad3.created_at BETWEEN ? AND ?
            ORDER BY ad3.id DESC LIMIT 1
          ), 0) AS terminal_paid
        FROM agent_dispositions ad2
        JOIN agent_cases ac2 ON ac2.id = ad2.agent_case_id
        LEFT JOIN coll_data cd2 ON cd2.id = ac2.coll_data_id
        WHERE ad2.created_at BETWEEN ? AND ?
          ${totalsFilterClause}
        GROUP BY ad2.agent_case_id
      ) totals ON totals.agent_case_id = latest_ad.agent_case_id
      
      WHERE ${dispositionCondition}
      ${filterClause}
      
      ORDER BY 
        CASE WHEN latest_ad.disposition IN ('PIF', 'SIF', 'FCL', 'PRT') THEN latest_ad.payment_date ELSE latest_ad.follow_up_date END ASC, 
        latest_ad.created_at DESC
      `,
      finalParams
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
    if (!disposition || !start_date || !end_date) return res.status(400).json({ message: "Missing required params" });

    const startDate = new Date(start_date);
    const endDate = new Date(end_date);
    endDate.setHours(23, 59, 59, 999);

    const startDateStr = startDate.toISOString();
    const endDateStr = endDate.toISOString();

    const targetCasesParams = [startDateStr, endDateStr];
    let targetFilterClause = "";

    const totalsParams = [startDateStr, endDateStr, startDateStr, endDateStr]; 
    let totalsFilterClause = "";

    const mainWhereParams = [];
    let filterClause = "";
    let dispositionCondition = "";

    if (disposition === "TOTAL_COLLECTED") {
      dispositionCondition = "latest_ad.disposition IN ('PIF', 'SIF', 'FCL', 'PRT')";
    } else {
      dispositionCondition = "latest_ad.disposition = ?";
      mainWhereParams.push(disposition);
    }

    if (agent_id !== "ALL") {
      const agentIds = agent_id.split(",").map((id) => id.trim());
      const placeholders = agentIds.map(() => "?").join(",");
      targetFilterClause += ` AND ad.agent_id IN (${placeholders})`;
      targetCasesParams.push(...agentIds);
      totalsFilterClause += ` AND ad2.agent_id IN (${placeholders})`;
      totalsParams.push(...agentIds);
      filterClause += ` AND latest_ad.agent_id IN (${placeholders})`;
      mainWhereParams.push(...agentIds);
    }

    if (campaign_id !== "ALL") {
      const campaignIds = campaign_id.split(",").map((id) => id.trim());
      const placeholders = campaignIds.map(() => "?").join(",");
      targetFilterClause += ` AND cd.campaign_id IN (${placeholders})`;
      targetCasesParams.push(...campaignIds);
      totalsFilterClause += ` AND cd2.campaign_id IN (${placeholders})`;
      totalsParams.push(...campaignIds);
      filterClause += ` AND cd.campaign_id IN (${placeholders})`;
      mainWhereParams.push(...campaignIds);
    }

    const finalParams = [...targetCasesParams, ...totalsParams, ...mainWhereParams];

    const [rows] = await pool.query(
      `
      SELECT 
        COALESCE(ac.customer_name, cd.cust_name) AS customer_name, 
        cd.loan_agreement_no,
        COALESCE(ac.phone, cd.mobileno) AS customer_no, 
        CONCAT(u.firstName, ' ', u.lastName) AS agent_name, 
        c.campaign_name, 
        latest_ad.disposition AS latest_disposition, 
        
        CASE 
          WHEN latest_ad.disposition IN ('PIF', 'SIF', 'FCL', 'PRT') THEN COALESCE(totals.prt_paid, 0) + COALESCE(totals.terminal_paid, 0)
          ELSE latest_ad.promise_amount 
        END AS amount, 

        latest_ad.follow_up_date, latest_ad.follow_up_time, latest_ad.payment_date
      FROM (
        SELECT ad.agent_case_id, MAX(ad.id) AS max_ad_id
        FROM agent_dispositions ad
        JOIN agent_cases ac ON ac.id = ad.agent_case_id
        LEFT JOIN coll_data cd ON cd.id = ac.coll_data_id
        WHERE ad.created_at BETWEEN ? AND ?
        ${targetFilterClause}
        GROUP BY ad.agent_case_id
      ) target_cases
      JOIN agent_dispositions latest_ad ON latest_ad.id = target_cases.max_ad_id
      JOIN agent_cases ac ON ac.id = latest_ad.agent_case_id
      LEFT JOIN coll_data cd ON cd.id = ac.coll_data_id 
      JOIN users u ON u.id = latest_ad.agent_id
      LEFT JOIN campaigns c ON c.id = cd.campaign_id
      
      LEFT JOIN (
        SELECT ad2.agent_case_id, 
          COALESCE(SUM(CASE WHEN ad2.disposition = 'PRT' THEN ad2.promise_amount ELSE 0 END), 0) AS prt_paid,
          COALESCE((
            SELECT promise_amount FROM agent_dispositions ad3
            WHERE ad3.agent_case_id = ad2.agent_case_id AND ad3.disposition IN ('PIF','SIF','FCL') AND ad3.created_at BETWEEN ? AND ?
            ORDER BY ad3.id DESC LIMIT 1
          ), 0) AS terminal_paid
        FROM agent_dispositions ad2
        JOIN agent_cases ac2 ON ac2.id = ad2.agent_case_id
        LEFT JOIN coll_data cd2 ON cd2.id = ac2.coll_data_id
        WHERE ad2.created_at BETWEEN ? AND ?
          ${totalsFilterClause}
        GROUP BY ad2.agent_case_id
      ) totals ON totals.agent_case_id = latest_ad.agent_case_id
      
      WHERE ${dispositionCondition}
      ${filterClause}
      
      ORDER BY 
        CASE WHEN latest_ad.disposition IN ('PIF', 'SIF', 'FCL', 'PRT') THEN latest_ad.payment_date ELSE latest_ad.follow_up_date END ASC, 
        latest_ad.created_at DESC
      `,
      finalParams
    );

    const formatDDMMYYYY = (dateVal) => {
      if (!dateVal) return "";
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return "";
      return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
    };

    const header = ["Customer Name", "Loan Agreement No", "Contact No", "Agent Name", "Campaign", "Disposition", "Amount", "Date"];
    const csvRows = rows.map(row => {
      let dateStr = "";
      if (["PRT", "FCL", "SIF", "PIF", "TOTAL_COLLECTED"].includes(disposition)) {
        dateStr = row.payment_date ? formatDDMMYYYY(row.payment_date) : "-";
      } else {
        const fDate = row.follow_up_date ? formatDDMMYYYY(row.follow_up_date) : "";
        const fTime = row.follow_up_time || "";
        dateStr = `${fDate} ${fTime}`.trim() || "-";
      }
      const clean = (str) => `"${String(str || '').replace(/"/g, '""')}"`;

      return [
        clean(row.customer_name), clean(row.loan_agreement_no), clean(row.customer_no),
        clean(row.agent_name), clean(row.campaign_name), clean(row.latest_disposition),
        clean(row.amount || 0), clean(dateStr)
      ].join(',');
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${disposition}_Customers.csv"`);
    res.send(header.join(',') + '\n' + csvRows.join('\n'));

  } catch (err) {
    console.error("exportMonitoringDrilldown error:", err);
    res.status(500).json({ message: "Failed to export drilldown data" });
  }
};