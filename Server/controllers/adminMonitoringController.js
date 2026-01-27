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

    /* ===============================
       1. VALIDATION
       =============================== */
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

    /* ===============================
       2. CURRENT CALENDAR MONTH
       =============================== */
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

    /* ===============================
       3. DYNAMIC FILTERS (SCHEMA-SAFE)
       =============================== */
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

    /* ===============================
       SECTION A: CALLS + PTP
       =============================== */
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

    /* ===============================
       SECTION B: COLLECTION BREAKDOWN
       =============================== */
    const [breakdownRows] = await pool.query(
      `
      SELECT
        ad.disposition,
        COUNT(*) AS customer_count,
        COALESCE(SUM(ad.promise_amount), 0) AS total_amount
      FROM agent_dispositions ad
      JOIN agent_cases ac ON ac.id = ad.agent_case_id
      JOIN users u ON u.id = ad.agent_id
      LEFT JOIN campaign_agents ca ON ca.agent_id = ad.agent_id
      ${whereClause}
        AND ad.created_at BETWEEN ? AND ?
        AND ad.disposition IN ('PIF','SIF','FCL','PRT')
      GROUP BY ad.disposition
      `,
      [...params, startDateStr, endDateStr]
    );

    const breakdown = {
      PIF: { customer_count: 0, total_amount: 0 },
      SIF: { customer_count: 0, total_amount: 0 },
      FCL: { customer_count: 0, total_amount: 0 },
      PRT: { customer_count: 0, total_amount: 0 },
    };

    breakdownRows.forEach((row) => {
      breakdown[row.disposition] = {
        customer_count: row.customer_count,
        total_amount: row.total_amount,
      };
    });

    /* ===============================
       SECTION C: TOTAL COLLECTION
       =============================== */
    const [[summary]] = await pool.query(
      `
      SELECT
        COUNT(*) AS total_collected_count,
        COALESCE(SUM(ad.promise_amount), 0) AS total_collected_amount
      FROM agent_dispositions ad
      JOIN agent_cases ac ON ac.id = ad.agent_case_id
      JOIN users u ON u.id = ad.agent_id
      LEFT JOIN campaign_agents ca ON ca.agent_id = ad.agent_id
      ${whereClause}
        AND ad.created_at BETWEEN ? AND ?
        AND ad.disposition IN ('PIF','SIF','FCL','PRT')
      `,
      [...params, startDateStr, endDateStr]
    );

    /* ===============================
       SECTION D: MONTHLY SUMMARY
       =============================== */
    const [[monthlyActual]] = await pool.query(
      `
      SELECT
        COUNT(*) AS total_collected_count,
        COALESCE(SUM(ad.promise_amount), 0) AS total_collected_amount
      FROM agent_dispositions ad
      JOIN agent_cases ac ON ac.id = ad.agent_case_id
      JOIN users u ON u.id = ad.agent_id
      LEFT JOIN campaign_agents ca ON ca.agent_id = ad.agent_id
      ${whereClause}
        AND ad.created_at BETWEEN ? AND ?
        AND ad.disposition IN ('PIF','SIF','FCL','PRT')
      `,
      [...params, monthStartStr, monthEndStr]
    );

    const [[monthlyExpected]] = await pool.query(
      `
      SELECT
        (
          COALESCE(SUM(CASE WHEN disposition='PTP' THEN promise_amount ELSE 0 END), 0)
          -
          COALESCE(SUM(CASE WHEN disposition='RTP' THEN promise_amount ELSE 0 END), 0)
        ) AS expected_amount
      FROM agent_dispositions
      WHERE created_at BETWEEN ? AND ?
      `,
      [monthStartStr, monthEndStr]
    );

    /* ===============================
       SECTION E: MONTHLY TARGET
       =============================== */

    let targetAmount = 0;
    if (campaign_id !== "ALL") {
      // Support multi-select: sum target_amount for all selected campaigns
      const campaignIds = campaign_id.split(",").map((id) => id.trim());
      const placeholders = campaignIds.map(() => "?").join(",");
        const [[row]] = await pool.query(
          `SELECT SUM(target_amount) AS target_amount FROM campaigns WHERE id IN (${placeholders}) AND status = 'ACTIVE'`,
          campaignIds
        );
        targetAmount = row?.target_amount || 0;
    } else {
      // If ALL, sum all campaign targets
        const [[row]] = await pool.query(
          `SELECT SUM(target_amount) AS target_amount FROM campaigns WHERE status = 'ACTIVE'`
        );
        targetAmount = row?.target_amount || 0;
    }

    const achievementPercent =
      targetAmount > 0
        ? Number(
            (
              (monthlyActual.total_collected_amount / targetAmount) *
              100
            ).toFixed(2)
          )
        : null;

    /* ===============================
       FINAL RESPONSE
       =============================== */
    res.json({
      overview: {
        calls_attended: overview.calls_attended || 0,
        ptp_count: overview.ptp_count || 0,
        total_ptp_amount: overview.total_ptp_amount || 0,
      },
      breakdown,
      summary: {
        total_collected_count: summary.total_collected_count || 0,
        total_collected_amount: summary.total_collected_amount || 0,
      },
      monthlySummary: {
        total_collected_count: monthlyActual.total_collected_count || 0,
        total_collected_amount: monthlyActual.total_collected_amount || 0,
        expected_amount: monthlyExpected.expected_amount || 0,
        target_amount: targetAmount,
        achievement_percent: achievementPercent,
      },
    });
  } catch (err) {
    console.error("getMonitoringAnalytics error:", err);
    res.status(500).json({ message: "Failed to fetch monitoring analytics" });
  }
};

/* ===============================
   HELPERS
   =============================== */

export const getMonitoringAgents = async (req, res) => {
  try {
    const [agents] = await pool.query(`
      SELECT id, username
      FROM users
      WHERE role = 'AGENT' AND isActive = 1
      ORDER BY username
    `);
    res.json({ agents });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch agents" });
  }
};

export const getMonitoringCampaigns = async (req, res) => {
  try {
    const [campaigns] = await pool.query(`
      SELECT id, campaign_name
      FROM campaigns
      WHERE status = 'ACTIVE'
      ORDER BY campaign_name
    `);
    res.json({ campaigns });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch campaigns" });
  }
};
