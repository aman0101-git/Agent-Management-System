import pool from "../config/mysql.js";

/* ==========================================
   HELPERS
   ========================================== */
export const getMonitoringAgents = async (req, res) => {
  try {
    // 🟢 FIXED: Now fetches both AGENTs and ADMINs so you can filter by your own actions
    const [agents] = await pool.query(`
      SELECT id, firstName FROM users WHERE role IN ('AGENT', 'ADMIN') AND isActive = 1 ORDER BY firstName
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

    let whereClause = `WHERE u.role IN ('AGENT', 'ADMIN') AND u.isActive = 1`;
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
      ...params, startDateStr, endDateStr, // 1. Inner 'latest' subquery
      ...params,                           // 2. Outer 'latest_status' whereClause
      startDateStr, endDateStr,            // 3. Subquery inside customer_totals (ad_sub)
      ...params, startDateStr, endDateStr  // 4. Main query for customer_totals
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
              AND ad.disposition IN ('PIF','SIF','FCL','PRT') -- 🟢 FIX
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
      ...params, monthStartStr, monthEndStr, // 1. Inner 'latest' subquery
      ...params,                             // 2. Outer 'latest_status' whereClause
      monthStartStr, monthEndStr,            // 3. Subquery inside customer_totals
      ...params, monthStartStr, monthEndStr  // 4. Main query for customer_totals
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
              AND ad.disposition IN ('PIF','SIF','FCL','PRT') -- 🟢 FIX
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

    /* ==========================================
       SECTION F: DYNAMIC MATRIX DATA
       ✅ FIXED: Matrix subqueries now perfectly match the PRT filtering
       ========================================== */
    const chartQueryParams = [
      ...params, startDateStr, endDateStr, // 1. Inner 'latest' subquery
      ...params,                           // 2. Outer 'latest_status' whereClause
      startDateStr, endDateStr,            // 3. Subquery inside customer_totals (ad_sub)
      ...params, startDateStr, endDateStr  // 4. Main query for customer_totals
    ];

    const [chartRawData] = await pool.query(
      `
      SELECT 
        u.firstName AS agent_name,
        camp.campaign_name,
        cd.pos,
        cd.bom_bucket,
        COALESCE(customer_totals.total_paid, 0) AS collected_amount
      FROM 
        (
          SELECT ad.agent_case_id, ad.agent_id
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
              AND ad.disposition IN ('PIF','SIF','FCL','PRT') -- 🟢 FIX
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
      JOIN agent_cases ac ON ac.id = latest_status.agent_case_id
      JOIN coll_data cd ON cd.id = ac.coll_data_id
      LEFT JOIN campaigns camp ON camp.id = cd.campaign_id
      JOIN users u ON u.id = latest_status.agent_id
      `,
      chartQueryParams
    );

    const posRangesList = ["0 - 10k", "10k - 30k", "30k - 50k", "50k - 1L", "1L - 3L", "3L - 5L", "5L+"];
    const uniqueBomBuckets = new Set();
    
    const campVsBom = {};
    const campVsPos = {};
    const agentVsBom = {};
    const agentVsPos = {};

    chartRawData.forEach(row => {
      const amt = parseFloat(row.collected_amount || 0);
      if (amt <= 0) return;

      const campName = row.campaign_name || "Unknown";
      const agentName = row.agent_name || "Unknown";
      const bucket = row.bom_bucket ? `Bucket ${row.bom_bucket}` : "Unassigned";
      
      uniqueBomBuckets.add(bucket);

      const pos = parseFloat(row.pos || 0);
      let posRange = "5L+";
      if (pos <= 10000) posRange = "0 - 10k";
      else if (pos <= 30000) posRange = "10k - 30k";
      else if (pos <= 50000) posRange = "30k - 50k";
      else if (pos <= 100000) posRange = "50k - 1L";
      else if (pos <= 300000) posRange = "1L - 3L";
      else if (pos <= 500000) posRange = "3L - 5L";

      if (!campVsBom[campName]) campVsBom[campName] = {};
      if (!campVsPos[campName]) campVsPos[campName] = {};
      if (!agentVsBom[agentName]) agentVsBom[agentName] = {};
      if (!agentVsPos[agentName]) agentVsPos[agentName] = {};

      campVsBom[campName][bucket] = (campVsBom[campName][bucket] || 0) + amt;
      campVsPos[campName][posRange] = (campVsPos[campName][posRange] || 0) + amt;
      agentVsBom[agentName][bucket] = (agentVsBom[agentName][bucket] || 0) + amt;
      agentVsPos[agentName][posRange] = (agentVsPos[agentName][posRange] || 0) + amt;
    });

    const chartData = {
      bomBucketsList: Array.from(uniqueBomBuckets).sort(),
      posRangesList,
      campVsBom,
      campVsPos,
      agentVsBom,
      agentVsPos
    };

    /* ==========================================
       SECTION G: AGENT DISPOSITION BREAKDOWN
       ========================================== */
    const [agentDispRows] = await pool.query(
      `
      SELECT 
        u.firstName AS agent_name,
        ad.disposition,
        COUNT(ad.id) AS disp_count
      FROM agent_dispositions ad
      JOIN users u ON u.id = ad.agent_id
      JOIN agent_cases ac ON ac.id = ad.agent_case_id
      JOIN coll_data cd ON cd.id = ac.coll_data_id
      ${whereClause} AND ad.created_at BETWEEN ? AND ?
      GROUP BY u.firstName, ad.disposition
      `,
      [...params, startDateStr, endDateStr]
    );

    const agentDispMap = {};
    const uniqueDispositions = new Set();

    agentDispRows.forEach(row => {
      const agent = row.agent_name || 'Unknown';
      const disp = row.disposition || 'Unknown';
      const count = parseInt(row.disp_count, 10);

      if (!agentDispMap[agent]) {
        agentDispMap[agent] = { name: agent };
      }
      agentDispMap[agent][disp] = count;
      uniqueDispositions.add(disp);
    });

    const agentDispositionChart = Object.values(agentDispMap);
    const dispositionTypes = Array.from(uniqueDispositions);

    res.json({
      overview: { calls_attended: overviewCalls?.calls_attended || 0, ptp_count: ptpData?.ptp_count || 0, total_ptp_amount: ptpData?.total_ptp_amount || 0 },
      breakdown,
      summary: { total_collected_count: totalCollectedCount, total_collected_amount: totalCollectedAmount },
      monthlySummary: { total_collected_count: monthlyActuals?.total_collected_count || 0, total_collected_amount: monthlyActualAmount, expected_amount: monthlyExpected?.expected_amount || 0, target_amount: targetAmount, achievement_percent: achievementPercent },
      chartData,
      agentDispositionChart, 
      dispositionTypes
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

    const targetCasesParams = [startDateStr, endDateStr];
    let targetFilterClause = "";

    const totalsParams = [startDateStr, endDateStr, startDateStr, endDateStr]; 
    let totalsFilterClause = "";

    const mainWhereParams = [];
    let filterClause = "";
    let dispositionCondition = "";

    // 🟢 FIX: Ensure the inner query only looks for the latest payment if drilling down into collections
    let innerDispFilter = "";
    if (disposition === "TOTAL_COLLECTED" || ["PIF", "SIF", "FCL", "PRT"].includes(disposition)) {
      innerDispFilter = "AND ad.disposition IN ('PIF', 'SIF', 'FCL', 'PRT')";
    }

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
        ${innerDispFilter} -- 🟢 FIX: Filters subquery strictly to payments when needed
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

    // 🟢 FIX: Ensure the inner query only looks for the latest payment if drilling down into collections
    let innerDispFilter = "";
    if (disposition === "TOTAL_COLLECTED" || ["PIF", "SIF", "FCL", "PRT"].includes(disposition)) {
      innerDispFilter = "AND ad.disposition IN ('PIF', 'SIF', 'FCL', 'PRT')";
    }

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
        ${innerDispFilter} -- 🟢 FIX: Filters subquery strictly to payments when needed
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