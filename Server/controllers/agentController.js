import pool from '../config/mysql.js';
import {
  DISPOSITION_RULES,
  validateDispositionData,
  getResultStatus,
} from '../config/dispositionRules.js';

// GET /api/customers/:collDataId/once-constraints
export const getOnceConstraints = async (req, res) => {
  const { collDataId } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT constraint_type, triggered_at FROM customer_once_constraints WHERE coll_data_id = ? AND is_active = 1`,
      [collDataId]
    );
    res.json({ constraints: rows });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch once constraints', error: err.message });
  }
};

/**
 * GET /api/agent/cases
 * Fetch agent dashboard list from Coll_Data table
 * FIX: Joins only the LATEST agent_case to prevent duplicates
 */
export const getAgentCases = async (req, res) => {
  try {
    const agentId = req.user.id;

    const [rows] = await pool.query(
      `
      SELECT
        c.id AS case_id,
        c.created_at AS allocation_date,
        c.cust_name AS customer_name,
        c.mobileno AS phone,
        c.loan_agreement_no AS loan_id,
        c.insl_amt,
        c.pos,
        c.bom_bucket,
        
        -- Get status from the LATEST agent_case for this agent/customer
        COALESCE(ac.status, 'NEW') AS status,
        ac.first_call_at,
        ac.last_call_at,
        ac.follow_up_date,
        ac.follow_up_time

      FROM coll_data c
      
      /* FIX: Join only the specific LATEST case for this customer & agent */
      LEFT JOIN agent_cases ac
        ON ac.id = (
          SELECT id FROM agent_cases 
          WHERE coll_data_id = c.id 
            AND agent_id = c.agent_id 
          ORDER BY created_at DESC 
          LIMIT 1
        )

      INNER JOIN campaign_agents ca
        ON ca.agent_id = ? AND ca.campaign_id = c.campaign_id

      WHERE c.agent_id = ?
        AND c.is_active = 1
        AND COALESCE(ac.status, 'NEW') != 'IN_PROGRESS'
      
      ORDER BY c.created_at DESC
      `,
      [agentId, agentId]
    );

    return res.json({ data: rows });
  } catch (err) {
    console.error("getAgentCases error:", err);
    return res.status(500).json({ message: "Failed to fetch agent cases" });
  }
};

/**
 * GET /api/agent/cases/:caseId
 * Fetch single case + disposition history + edit history
 * FIXED: Removed 'AND c.agent_id = ?' to allow Global View (Edit permissions handled in submitDisposition)
 */
export const getAgentCaseById = async (req, res) => {
  try {
    const agentId = req.user.id;
    const { caseId } = req.params; // This is coll_data.id

    /* ===============================
       1️⃣ Fetch main case details (Global View)
       =============================== */
    const [[row]] = await pool.query(
      `
      SELECT
        c.id,
        c.created_at AS allocation_date,
        c.cust_name AS customer_name,
        c.mobileno AS phone,
        c.loan_agreement_no AS loan_id,
        c.branch_name, c.hub_name, c.group_name, c.agency,
        c.dpd, c.pos, c.insl_amt, c.inst_over, c.amt_outst, c.tenure,
        c.bom_bucket, c.penal_over, c.amount_finance, c.product_code,
        c.loan_status, c.extra_fields, c.res_addr, c.off_addr,
        c.disb_date, c.maturity_date, c.fdd,
        c.agent_id, c.batch_month, c.batch_year, c.campaign_id, c.is_active,

        -- Status from latest interaction (Global)
        COALESCE(ac.status, 'NEW') AS status,
        ac.first_call_at, ac.last_call_at, ac.follow_up_date, ac.follow_up_time
      FROM coll_data c
      LEFT JOIN agent_cases ac ON ac.coll_data_id = c.id
      -- Check Campaign Access ONLY (Global View)
      INNER JOIN campaign_agents ca ON ca.agent_id = ? AND ca.campaign_id = c.campaign_id
      WHERE c.id = ?
      ORDER BY ac.created_at DESC
      LIMIT 1
      `,
      [agentId, caseId]
    );

    if (!row) {
      return res.status(404).json({ message: "Case not found or access denied" });
    }

    /* ===============================
       2️⃣ Fetch Disposition History (BY CUSTOMER ID)
       FIX: Joins agent_cases to get ALL history for this customer, 
       regardless of which agent created it.
       =============================== */
    const [dispositions] = await pool.query(
      `
      SELECT
        ad.id,
        ad.agent_case_id,
        ad.disposition,
        ad.remarks,
        ad.promise_amount,
        ad.follow_up_date,
        ad.follow_up_time,
        ad.payment_date,
        ad.payment_time,
        ad.ptp_target,
        ad.created_at,
        u.username AS agent_name
      FROM agent_dispositions ad
      INNER JOIN agent_cases ac ON ad.agent_case_id = ac.id
      LEFT JOIN users u ON ad.agent_id = u.id
      WHERE ac.coll_data_id = ?  -- <--- KEY FIX: Fetch by Customer ID
      ORDER BY ad.created_at DESC
      `,
      [caseId]
    );

    /* ===============================
       3️⃣ Fetch Edit History (Linked to displayed dispositions)
       =============================== */
    // We fetch edit history for the dispositions we just retrieved
    const dispositionIds = dispositions.map(d => d.agent_case_id);
    let editHistory = [];
    
    if (dispositionIds.length > 0) {
      const [edits] = await pool.query(
        `
        SELECT
          eh.id,
          eh.agent_case_id,
          eh.disposition,
          eh.remarks,
          eh.promise_amount,
          eh.follow_up_date,
          eh.follow_up_time,
          eh.payment_date,
          eh.payment_time,
          eh.ptp_target,
          eh.edited_at
        FROM agent_dispositions_edit_history eh
        INNER JOIN agent_cases ac ON eh.agent_case_id = ac.id
        WHERE ac.coll_data_id = ?
        ORDER BY eh.edited_at DESC
        `,
        [caseId]
      );
      editHistory = edits;
    }

    // Format Times
    function formatTime(val) {
      if (!val) return null;
      if (typeof val === 'string') return val;
      if (val instanceof Date) return val.toTimeString().slice(0, 8);
      return String(val);
    }

    if (row && row.follow_up_time) row.follow_up_time = formatTime(row.follow_up_time);
    dispositions.forEach(d => { if (d.follow_up_time) d.follow_up_time = formatTime(d.follow_up_time); });
    editHistory.forEach(e => { if (e.follow_up_time) e.follow_up_time = formatTime(e.follow_up_time); });

    return res.json({
      case: row,
      dispositions,
      editHistory,
    });

  } catch (err) {
    console.error("getAgentCaseById error:", err);
    return res.status(500).json({ message: "Failed to fetch case details" });
  }
};

/**
 * POST /api/agent/cases/:caseId/disposition
 * Submit or edit disposition with First Call logic fix
 */
export const submitDisposition = async (req, res) => {
  const conn = await pool.getConnection();

  try {
    const agentId = req.user.id;
    const { caseId } = req.params;

    const {
      disposition, remarks, promiseAmount, followUpDate,
      followUpTime, ptpTarget, paymentDate, isEdit,
    } = req.body;

    // --- Validation (Keep existing logic) ---
    if (!disposition) return res.status(400).json({ message: "Disposition required" });
    if (!DISPOSITION_RULES[disposition]) return res.status(400).json({ message: `Unknown disposition: ${disposition}` });

    const rule = DISPOSITION_RULES[disposition];
    const errors = [];
    if (rule.requires.amount && (!promiseAmount || Number(promiseAmount) <= 0)) errors.push(`Amount is required`);
    if (rule.requires.followUpDate && !followUpDate) errors.push(`Follow-up date is required`);
    if (rule.requires.followUpTime && !followUpTime) errors.push(`Follow-up time is required`);
    if (disposition === "PTP" && !ptpTarget) errors.push("PTP target is required");
    const safePromiseAmount = rule.requires.amount ? promiseAmount : null;
    const safeFollowUpDate = rule.requires.followUpDate ? followUpDate : null;
    const safeFollowUpTime = rule.requires.followUpTime ? followUpTime : null;
    const safePtpTarget = disposition === "PTP" ? ptpTarget : null;
    const paymentDateDispositions = ["PIF", "SIF", "FCL", "PRT"];
    const safePaymentDate = paymentDateDispositions.includes(disposition) ? paymentDate || null : null;
    if (paymentDateDispositions.includes(disposition) && !safePaymentDate) errors.push(`Payment date is required`);

    if (errors.length > 0) return res.status(400).json({ message: "Validation failed", errors });

    await conn.beginTransaction();

    // ==========================================
    // 1. LOCK AGENT CASE AND FETCH first_call_at
    // ==========================================
    let [[agentCase]] = await conn.query(
      `SELECT id, status, coll_data_id, first_call_at
       FROM agent_cases
       WHERE coll_data_id = ? AND agent_id = ?
       ORDER BY created_at DESC
       LIMIT 1
       FOR UPDATE`,
      [caseId, agentId]
    );

    // Handle Takeover (New Case for Agent)
    if (!agentCase) {
      const [[customer]] = await conn.query(
        `SELECT id FROM coll_data WHERE id = ?`, [caseId]
      );
      if (!customer) {
        await conn.rollback();
        return res.status(404).json({ message: "Customer not found" });
      }

      await conn.query(`UPDATE coll_data SET agent_id = ? WHERE id = ?`, [agentId, caseId]);
      
      const [newCaseResult] = await conn.query(
        `INSERT INTO agent_cases (agent_id, coll_data_id, status, is_active, created_at)
         VALUES (?, ?, 'NEW', 1, NOW())`,
        [agentId, caseId]
      );

      agentCase = {
        id: newCaseResult.insertId,
        status: 'NEW',
        coll_data_id: caseId,
        first_call_at: null // New case has no first call time yet
      };
    }

    const collDataId = agentCase.coll_data_id;

    // ==========================================
    // 2. SAVE EDIT HISTORY
    // ==========================================
    if (isEdit) {
      const [[latest]] = await conn.query(
        `SELECT disposition, remarks, promise_amount, follow_up_date, follow_up_time, ptp_target
         FROM agent_dispositions
         WHERE agent_case_id = ? ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
        [agentCase.id]
      );
      if (latest) {
        await conn.query(
          `INSERT INTO agent_dispositions_edit_history
           (agent_case_id, disposition, remarks, promise_amount, follow_up_date, follow_up_time, ptp_target)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [agentCase.id, latest.disposition, latest.remarks, latest.promise_amount, latest.follow_up_date, latest.follow_up_time, latest.ptp_target]
        );
      }
    }

    // ==========================================
    // 3. INSERT DISPOSITION
    // ==========================================
    const [result] = await conn.query(
      `INSERT INTO agent_dispositions
       (agent_case_id, agent_id, disposition, ptp_target, remarks, promise_amount, follow_up_date, follow_up_time, payment_date, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [agentCase.id, agentId, disposition, safePtpTarget, remarks || null, safePromiseAmount, safeFollowUpDate, safeFollowUpTime, safePaymentDate]
    );

    const insertedDispositionId = result.insertId;
    
    // Constraints Logic
    if (disposition === 'PTP' || disposition === 'PRT') {
      const constraintType = disposition === 'PTP' ? 'ONCE_PTP' : 'ONCE_PRT';
      const [[exists]] = await conn.query(
        `SELECT id FROM customer_once_constraints WHERE coll_data_id = ? AND constraint_type = ? AND is_active = 1`,
        [collDataId, constraintType]
      );
      if (!exists) {
        await conn.query(
          `INSERT INTO customer_once_constraints (coll_data_id, constraint_type, triggered_disposition_id, triggered_at, is_active) VALUES (?, ?, ?, NOW(), 1)`,
          [collDataId, constraintType, insertedDispositionId]
        );
      }
    }

    // ==========================================
    // 4. UPDATE AGENT CASE (FIX: Explicit first_call_at)
    // ==========================================
    const newStatus = getResultStatus(disposition);
    const statusChanged = newStatus !== agentCase.status;

    // FIX: Determine first_call_at in JS to be safe
    // If it already has a value, keep it. If null, set it to NOW().
    const finalFirstCallAt = agentCase.first_call_at ? agentCase.first_call_at : new Date();

    await conn.query(
      `UPDATE agent_cases
       SET
         status = ?,
         is_active = 0,
         first_call_at = ?,
         last_call_at = NOW(),
         follow_up_date = ?,
         follow_up_time = ?
       WHERE id = ?`,
      [
        newStatus,
        finalFirstCallAt, // Passed explicitly
        safeFollowUpDate,
        safeFollowUpTime,
        agentCase.id,
      ]
    );

    // Release constraints if done
    if (statusChanged && newStatus === "DONE") {
      await conn.query(
        `UPDATE customer_once_constraints SET is_active = 0 WHERE coll_data_id = ? AND is_active = 1`,
        [collDataId]
      );
    }

    await conn.commit();

    return res.json({
      message: "Disposition saved successfully",
      status: newStatus,
      allocateNext: statusChanged,
    });

  } catch (err) {
    await conn.rollback();
    console.error("submitDisposition error:", err);
    return res.status(500).json({ message: "Failed to submit disposition", error: err.message });
  } finally {
    conn.release();
  }
};

/**
 * GET /api/agent/cases/next
 * Allocate and fetch a single next queued case for the agent
 */
export const getNextCase = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const agentId = req.user.id;
    await conn.beginTransaction();

    // 1️⃣ Block if agent already has active case
    const [[active]] = await conn.query(
      `SELECT id FROM agent_cases WHERE agent_id = ? AND is_active = 1`,
      [agentId]
    );

    if (active) {
      await conn.commit();
      return res.status(409).json({ message: "Agent already has an active case" });
    }

    // 2️⃣ Fetch next unassigned customer
    // ISSUE #12 FIX: Only from campaigns agent is assigned to
    const [[next]] = await conn.query(
      `SELECT c.id, c.cust_name, c.mobileno, c.loan_agreement_no
       FROM coll_data c
       /* ISSUE #12 FIX: Verify campaign assignment */
       INNER JOIN campaign_agents ca
         ON ca.agent_id = ? AND ca.campaign_id = c.campaign_id
       WHERE c.agent_id IS NULL AND c.is_active = 1
       ORDER BY c.created_at ASC
       LIMIT 1
       FOR UPDATE`,
      [agentId]
    );

    if (!next) {
      await conn.commit();
      return res.status(204).json({ message: "No customers available" });
    }

    // 3️⃣ Assign & create agent_case
    await conn.query(`UPDATE coll_data SET agent_id = ? WHERE id = ?`, [agentId, next.id]);

    await conn.query(
      `INSERT INTO agent_cases (agent_id, coll_data_id, status, is_active)
       VALUES (?, ?, 'NEW', 1)`,
      [agentId, next.id]
    );

    await conn.commit();

    return res.json({
      caseId: next.id,
      customer_name: next.cust_name,
      phone: next.mobileno,
      loan_id: next.loan_agreement_no
    });

  } catch (err) {
    await conn.rollback();
    console.error("getNextCase error:", err);
    return res.status(500).json({ message: "Failed to fetch next case" });
  } finally {
    conn.release();
  }
};

/**
 * POST /api/agent/search
 * Search customers in campaigns allowed for this agent.
 * Read-Only: Does NOT assign cases. Assignment happens on Disposition Submit.
 */
export const searchCustomers = async (req, res) => {
  try {
    const agentId = req.user.id;
    const { query } = req.body;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({ message: "Search query required" });
    }

    const searchTerm = `%${query}%`;

    // Global Search restricted to Allowed Campaigns
    const [customers] = await pool.query(
      `
      SELECT
        c.id,
        c.loan_agreement_no,
        c.cust_name,
        c.mobileno,
        c.appl_id,
        c.branch_name,
        c.hub_name,
        c.amt_outst,
        c.pos,
        c.bom_bucket,
        c.dpd,
        c.loan_status,
        c.res_addr,
        c.created_at,
        c.agent_id, -- Return who currently owns it
        CASE WHEN c.agent_id = ? THEN 1 ELSE 0 END as is_my_case
      FROM coll_data c
      INNER JOIN campaign_agents ca ON c.campaign_id = ca.campaign_id
      WHERE ca.agent_id = ?
      AND (
        c.loan_agreement_no LIKE ?
        OR c.cust_name LIKE ?
        OR c.mobileno LIKE ?
      )
      ORDER BY c.id DESC
      LIMIT 50
      `,
      [agentId, agentId, searchTerm, searchTerm, searchTerm]
    );

    res.json({ data: customers, count: customers.length });

  } catch (err) {
    console.error("searchCustomers error:", err);
    res.status(500).json({ message: "Failed to search customers" });
  }
};

/**
 * GET /api/agent/analytics
 * Get performance analytics for logged-in agent with time filtering
 */
export const getAgentAnalytics = async (req, res) => {
  try {
    const agentId = req.user.id;
    const { timeFilter = 'thisMonth', fromDate, toDate } = req.query;

    // ✅ Validate custom date range
    if (timeFilter === 'custom') {
      if (!fromDate || !toDate) {
        return res.status(400).json({ message: "fromDate and toDate required for custom range" });
      }

      const from = new Date(fromDate);
      const to = new Date(toDate);

      if (isNaN(from.getTime()) || isNaN(to.getTime())) {
        return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD" });
      }

      if (from > to) {
        return res.status(400).json({ message: "fromDate must be <= toDate" });
      }
    }

    // ✅ Calculate date range based on timeFilter
    const today = new Date();
    let startDate = new Date();
    let endDate = new Date();

    endDate.setHours(23, 59, 59, 999);

    if (timeFilter === 'custom') {
      startDate = new Date(fromDate);
      endDate = new Date(toDate);
      endDate.setHours(23, 59, 59, 999);
    } else {
      switch (timeFilter) {
        case 'today':
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'yesterday':
          startDate.setDate(today.getDate() - 1);
          startDate.setHours(0, 0, 0, 0);
          endDate.setDate(today.getDate() - 1);
          endDate.setHours(23, 59, 59, 999);
          break;
        case 'thisWeek':
          startDate.setDate(today.getDate() - today.getDay());
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'thisMonth':
          startDate.setDate(1);
          startDate.setHours(0, 0, 0, 0);
          break;
        default:
          startDate.setHours(0, 0, 0, 0);
      }
    }

    const startDateStr = startDate.toISOString();
    const endDateStr = endDate.toISOString();

    // ✅ Calculate monthly date range (ALWAYS calendar month, independent of filter)
    const monthlyStart = new Date();
    monthlyStart.setDate(1);
    monthlyStart.setHours(0, 0, 0, 0);

    const monthlyEnd = new Date();
    monthlyEnd.setMonth(monthlyEnd.getMonth() + 1);
    monthlyEnd.setDate(0);
    monthlyEnd.setHours(23, 59, 59, 999);

    const monthlyStartStr = monthlyStart.toISOString();
    const monthlyEndStr = monthlyEnd.toISOString();

    // ✅ Fetch agent target for CURRENT MONTH
    const currentMonthStr = `${monthlyStart.getFullYear()}-${String(
      monthlyStart.getMonth() + 1
    ).padStart(2, '0')}`; // YYYY-MM

    const [[agentTarget]] = await pool.query(
      `
      SELECT target_amount 
      FROM agent_targets 
      WHERE agent_id = ? AND month = ?
      LIMIT 1
      `,
      [agentId, currentMonthStr]
    );

    const targetAmount = agentTarget?.target_amount || null;

    /* ===============================
       SECTION A: Collection Summary (Filtered Range)
       This was the missing block. It fetches the total collected stats 
       for the selected time filter.
       =============================== */
    const [[collectionSummary]] = await pool.query(
      `
      SELECT 
        COUNT(*) AS total_collected_count, 
        COALESCE(SUM(promise_amount), 0) AS total_collected_amount
      FROM (
        SELECT ad.*
        FROM agent_dispositions ad
        JOIN (
          SELECT agent_case_id, MAX(created_at) AS latest_time
          FROM agent_dispositions
          WHERE agent_id = ?
            AND created_at BETWEEN ? AND ?
          GROUP BY agent_case_id
        ) latest
          ON latest.agent_case_id = ad.agent_case_id
          AND latest.latest_time = ad.created_at
      ) latest_cases
      WHERE disposition IN ('PIF','SIF','FCL','PRT')
      `,
      [agentId, startDateStr, endDateStr]
    );

    /* ===============================
       SECTION B: Collection Breakdown (Filtered Range)
       =============================== */
    const [collectionBreakdown] = await pool.query(
      `
        SELECT disposition, COUNT(DISTINCT agent_case_id) AS customer_count, COALESCE(SUM(promise_amount), 0) AS total_amount
        FROM (
          SELECT ad.*
          FROM agent_dispositions ad
          JOIN (
            SELECT agent_case_id, MAX(created_at) AS latest_time
            FROM agent_dispositions
            WHERE agent_id = ?
              AND created_at BETWEEN ? AND ?
            GROUP BY agent_case_id
          ) latest
            ON latest.agent_case_id = ad.agent_case_id
            AND latest.latest_time = ad.created_at
        ) latest_cases
        WHERE disposition IN ('PIF','SIF','FCL','PRT')
        GROUP BY disposition
      `,
      [agentId, startDateStr, endDateStr]
    );

    // Format collection breakdown
    const formattedBreakdown = {
      PIF: { customer_count: 0, total_amount: 0 },
      SIF: { customer_count: 0, total_amount: 0 },
      FCL: { customer_count: 0, total_amount: 0 },
      PRT: { customer_count: 0, total_amount: 0 },
    };

    collectionBreakdown.forEach((item) => {
      formattedBreakdown[item.disposition] = {
        customer_count: item.customer_count,
        total_amount: item.total_amount,
      };
    });

    /* ===============================
       SECTION C: PTP Overview (Filtered Range)
       =============================== */
    const [[ptpData]] = await pool.query(
      `
        SELECT 
          COUNT(*) AS calls_attended,
          SUM(CASE WHEN disposition = 'PTP' THEN 1 ELSE 0 END) AS ptp_count,
          COALESCE(SUM(CASE WHEN disposition = 'PTP' THEN promise_amount ELSE 0 END), 0) AS total_ptp_amount
        FROM agent_dispositions
        WHERE agent_id = ?
          AND created_at BETWEEN ? AND ?
      `,
      [agentId, startDateStr, endDateStr]
    );

    /* ===============================
       SECTION D: Monthly Summary (ALWAYS CALENDAR MONTH)
       =============================== */
    const [[monthlySummary]] = await pool.query(
      `
      SELECT
        COUNT(*) AS total_collected_count,
        COALESCE(SUM(promise_amount), 0) AS total_collected_amount
      FROM (
        SELECT ad.*
        FROM agent_dispositions ad
        JOIN (
          SELECT agent_case_id, MAX(created_at) AS latest_time
          FROM agent_dispositions
          WHERE agent_id = ?
            AND created_at BETWEEN ? AND ?
          GROUP BY agent_case_id
        ) latest
          ON latest.agent_case_id = ad.agent_case_id
          AND latest.latest_time = ad.created_at
      ) latest_cases
      WHERE disposition IN ('PIF','SIF','FCL','PRT')
      `,
      [agentId, monthlyStartStr, monthlyEndStr]
    );

    // Calculate monthly expected amount (PTP - RTP)
    const [[monthlyExpected]] = await pool.query(
      `
      SELECT
        (
          COALESCE(SUM(CASE WHEN disposition = 'PTP' THEN promise_amount ELSE 0 END),0)
          -
          COALESCE(SUM(CASE WHEN disposition = 'RTP' THEN promise_amount ELSE 0 END),0)
        ) AS expected_amount
      FROM agent_dispositions
      WHERE agent_id = ?
        AND created_at BETWEEN ? AND ?
      `,
      [agentId, monthlyStartStr, monthlyEndStr]
    );

    // Calculate achievement percentage for monthly summary
    const monthlyActual = monthlySummary.total_collected_amount || 0;
    let achievementPercent = 0;
    if (targetAmount && targetAmount > 0) {
      achievementPercent = ((monthlyActual / targetAmount) * 100).toFixed(2);
    }

    /* ===============================
       FINAL RESPONSE
       =============================== */
    res.json({
      timeFilter,
      dateRange: { start: startDateStr, end: endDateStr },
      overview: {
        calls_attended: ptpData?.calls_attended || 0,
        ptp_count: ptpData?.ptp_count || 0,
        total_ptp_amount: ptpData?.total_ptp_amount || 0,
      },
      breakdown: formattedBreakdown,
      summary: {
        total_collected_count: collectionSummary?.total_collected_count || 0,
        total_collected_amount: collectionSummary?.total_collected_amount || 0,
      },
      // Monthly summary (ALWAYS calendar month, independent of filter)
      monthlySummary: {
        dateRange: { start: monthlyStartStr, end: monthlyEndStr },
        total_collected_count: monthlySummary?.total_collected_count || 0,
        total_collected_amount: monthlyActual,
        expected_amount: monthlyExpected?.expected_amount || 0,
        target_amount: targetAmount,
        achievement_percent: targetAmount ? parseFloat(achievementPercent) : null,
      },
    });

  } catch (err) {
    console.error("getAgentAnalytics error:", err);
    res.status(500).json({ message: "Failed to fetch analytics" });
  }
};

/**
 * GET /api/agent/target
 * Agent fetches their own monthly target
 */
export const getAgentTarget = async (req, res) => {
  try {
    const agentId = req.user.id;
    const { month } = req.query;

    // Use provided month or current month
    const targetMonth = month || new Date().toISOString().slice(0, 7);

    const [[target]] = await pool.query(
      `
      SELECT target_amount
      FROM agent_targets
      WHERE agent_id = ? AND month = ?
      LIMIT 1
      `,
      [agentId, targetMonth]
    );

    res.json({
      month: targetMonth,
      target_amount: target?.target_amount || null,
    });

  } catch (err) {
    console.error("getAgentTarget error:", err);
    res.status(500).json({ message: "Failed to fetch target" });
  }
};

/**
 * POST /api/agent/target
 * Agent sets their own monthly target
 */
export const setAgentTarget = async (req, res) => {
  try {
    const agentId = req.user.id;
    const { targetAmount, month } = req.body;

    if (!targetAmount || typeof targetAmount !== 'number' || targetAmount < 0) {
      return res.status(400).json({ message: "Valid targetAmount required" });
    }

    const targetMonth = month || new Date().toISOString().slice(0, 7);

    // Insert or update agent's target (include created_by so NOT NULL constraint satisfied)
    await pool.query(
      `
      INSERT INTO agent_targets (agent_id, month, target_amount, created_by, created_at)
      VALUES (?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        target_amount = VALUES(target_amount),
        updated_at = NOW()
      `,
      [agentId, targetMonth, targetAmount, agentId]
    );

    res.json({
      message: "Target set successfully",
      month: targetMonth,
      target_amount: targetAmount,
    });

  } catch (err) {
    console.error("setAgentTarget error:", err && err.message, err && err.stack);
    res.status(500).json({ message: "Failed to set target" });
  }
};
