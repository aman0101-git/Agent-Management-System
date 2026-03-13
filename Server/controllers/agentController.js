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
        c.*, -- Fetch all columns dynamically
        c.id AS case_id,
        c.created_at AS allocation_date,
        c.cust_name AS customer_name,
        c.mobileno AS phone,
        c.loan_agreement_no AS loan_id,
        
        -- Get status from the LATEST agent_case for this agent/customer
        COALESCE(ac.status, 'NEW') AS status,
        ac.first_call_at,
        ac.last_call_at,
        ac.follow_up_date,
        ac.follow_up_time,

        -- Fetch the latest disposition for this case
        (
          SELECT disposition 
          FROM agent_dispositions ad 
          WHERE ad.agent_case_id = ac.id 
          ORDER BY created_at DESC 
          LIMIT 1
        ) AS latest_disposition

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
        c.*, -- Fetches ALL fields from coll_data automatically
        c.created_at AS allocation_date,
        c.cust_name AS customer_name,
        c.mobileno AS phone,
        c.loan_agreement_no AS loan_id,

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
 * Submit or edit disposition with First Call logic fix and Constraint Duplicate Fix
 * FIX: Distinguishes between CREATE (Insert) and UPDATE (isEdit) to prevent duplicate amounts
 */
export const submitDisposition = async (req, res) => {
  const conn = await pool.getConnection();

  try {
    const agentId = req.user.id;
    const { caseId } = req.params;

    const {
      disposition,
      remarks,
      promiseAmount,
      followUpDate,
      followUpTime,
      ptpTarget,
      paymentDate,
      paymentTime, // Added to fix missing time on frontend
      isEdit,
    } = req.body;

    // --- Validation ---
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
    const safePaymentTime = paymentDateDispositions.includes(disposition) ? paymentTime || null : null;

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
        first_call_at: null
      };
    }

    const collDataId = agentCase.coll_data_id;

    // ==========================================
    // 2. SAVE EDIT HISTORY
    // ==========================================
    let targetDispositionId = null;
    if (isEdit) {
      const [[latest]] = await conn.query(
        `SELECT id, disposition, remarks, promise_amount, follow_up_date, follow_up_time, ptp_target
         FROM agent_dispositions
         WHERE agent_case_id = ? ORDER BY id DESC LIMIT 1 FOR UPDATE`,
        [agentCase.id]
      );
      if (latest) {
        targetDispositionId = latest.id;
        await conn.query(
          `INSERT INTO agent_dispositions_edit_history
           (agent_case_id, disposition, remarks, promise_amount, follow_up_date, follow_up_time, ptp_target)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [agentCase.id, latest.disposition, latest.remarks, latest.promise_amount, latest.follow_up_date, latest.follow_up_time, latest.ptp_target]
        );
      }
    }

    // ==========================================
    // 3. INSERT OR UPDATE DISPOSITION
    // ==========================================
    let insertedDispositionId;

    if (isEdit && targetDispositionId) {
      // FIX: Update existing record instead of adding a new one
      await conn.query(
        `UPDATE agent_dispositions
         SET disposition = ?, ptp_target = ?, remarks = ?, promise_amount = ?, follow_up_date = ?, follow_up_time = ?, payment_date = ?, payment_time = ?, created_at = NOW()
         WHERE id = ?`,
        [disposition, safePtpTarget, remarks || null, safePromiseAmount, safeFollowUpDate, safeFollowUpTime, safePaymentDate, safePaymentTime, targetDispositionId]
      );
      insertedDispositionId = targetDispositionId;
    } else {
      // Normal Insert for new entries
      const [result] = await conn.query(
        `INSERT INTO agent_dispositions
         (agent_case_id, agent_id, disposition, ptp_target, remarks, promise_amount, follow_up_date, follow_up_time, payment_date, payment_time, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [agentCase.id, agentId, disposition, safePtpTarget, remarks || null, safePromiseAmount, safeFollowUpDate, safeFollowUpTime, safePaymentDate, safePaymentTime]
      );
      insertedDispositionId = result.insertId;
    }
    
    // ==========================================
    // 4. CONSTRAINT LOGIC
    // ==========================================
    if (disposition === 'PTP' || disposition === 'PRT') {
      const constraintType = disposition === 'PTP' ? 'ONCE_PTP' : 'ONCE_PRT';
      
      await conn.query(
        `INSERT INTO customer_once_constraints 
           (coll_data_id, constraint_type, triggered_disposition_id, triggered_at, is_active) 
         VALUES (?, ?, ?, NOW(), 1)
         ON DUPLICATE KEY UPDATE 
           triggered_disposition_id = VALUES(triggered_disposition_id),
           triggered_at = NOW(),
           is_active = 1`,
        [collDataId, constraintType, insertedDispositionId]
      );
    }

    // ==========================================
    // 5. UPDATE AGENT CASE
    // ==========================================
    const newStatus = getResultStatus(disposition);
    const statusChanged = newStatus !== agentCase.status;
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
      [newStatus, finalFirstCallAt, safeFollowUpDate, safeFollowUpTime, agentCase.id]
    );

    if (statusChanged && newStatus === "DONE") {
      await conn.query(
        `UPDATE customer_once_constraints SET is_active = 0 WHERE coll_data_id = ?`,
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

    // 1️⃣ Block if agent already has an active case (This throws the 409 error)
    const [[active]] = await conn.query(
      `SELECT id FROM agent_cases WHERE agent_id = ? AND is_active = 1`,
      [agentId]
    );

    if (active) {
      await conn.commit();
      return res.status(409).json({ message: "Agent already has an active case. Please submit disposition for current case." });
    }

    // 2️⃣ Fetch all campaigns assigned to this agent
    const [campaigns] = await conn.query(
      `SELECT campaign_id FROM campaign_agents WHERE agent_id = ?`,
      [agentId]
    );

    if (campaigns.length === 0) {
      await conn.commit();
      return res.status(204).json({ message: "No campaigns assigned to this agent" });
    }

    // 3️⃣ Shuffle campaigns randomly to ensure fair distribution across ALL assigned campaigns
    const shuffledCampaigns = campaigns.sort(() => Math.random() - 0.5);

    let next = null;

    // 4️⃣ Loop through the randomized campaigns and find the first available customer
    for (const camp of shuffledCampaigns) {
      const [[customer]] = await conn.query(
        `SELECT id, cust_name, mobileno, loan_agreement_no
         FROM coll_data
         WHERE campaign_id = ? AND agent_id IS NULL AND is_active = 1
         ORDER BY created_at ASC
         LIMIT 1
         FOR UPDATE`,
        [camp.campaign_id]
      );

      if (customer) {
        next = customer;
        break; // We found a customer in this campaign! Exit the loop.
      }
    }

    // If no customer was found across ANY of the assigned campaigns
    if (!next) {
      await conn.commit();
      return res.status(204).json({ message: "No customers available in your assigned campaigns" });
    }

    // 5️⃣ Assign & create agent_case
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
        c.*, -- Automatically returns all fields in search view as well
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
 * FIX: Utilizes Latest-State Logic for PTP to prevent duplicates and broken PTPs adding up
 */
export const getAgentAnalytics = async (req, res) => {
  try {
    const agentId = req.user.id;
    const { timeFilter = 'thisMonth', fromDate, toDate } = req.query;

    /* ==========================================
       1. DATE HANDLING & VALIDATION
       ========================================== */
    if (timeFilter === 'custom') {
      if (!fromDate || !toDate) {
        return res.status(400).json({ message: "fromDate and toDate required for custom range" });
      }
      const from = new Date(fromDate);
      const to = new Date(toDate);
      if (isNaN(from.getTime()) || isNaN(to.getTime())) return res.status(400).json({ message: "Invalid date format" });
      if (from > to) return res.status(400).json({ message: "fromDate must be <= toDate" });
    }

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
          const day = today.getDay();
          const diff = today.getDate() - day + (day === 0 ? -6 : 1); 
          startDate.setDate(diff); 
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

    const monthlyStart = new Date();
    monthlyStart.setDate(1);
    monthlyStart.setHours(0, 0, 0, 0);
    const monthlyEnd = new Date();
    monthlyEnd.setMonth(monthlyEnd.getMonth() + 1);
    monthlyEnd.setDate(0);
    monthlyEnd.setHours(23, 59, 59, 999);

    const monthlyStartStr = monthlyStart.toISOString();
    const monthlyEndStr = monthlyEnd.toISOString();
    const currentMonthStr = `${monthlyStart.getFullYear()}-${String(monthlyStart.getMonth() + 1).padStart(2, '0')}`; 

    /* ==========================================
       2. FETCH TARGETS
       ========================================== */
    const [[agentTarget]] = await pool.query(
      `SELECT target_amount FROM agent_targets WHERE agent_id = ? AND month = ? LIMIT 1`,
      [agentId, currentMonthStr]
    );
    const targetAmount = agentTarget?.target_amount || null;

    /* ==========================================
       SECTION A: COLLECTION BREAKDOWN (PRT/PIF/SIF/FCL)
       ========================================== */
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
          JOIN (
            SELECT agent_case_id, MAX(id) AS latest_id
            FROM agent_dispositions
            WHERE agent_id = ? AND created_at BETWEEN ? AND ?
            GROUP BY agent_case_id
          ) latest ON latest.latest_id = ad.id
          WHERE ad.disposition IN ('PIF','SIF','FCL','PRT')
        ) latest_status
      JOIN 
        (
          SELECT agent_case_id, SUM(promise_amount) as total_paid
          FROM agent_dispositions
          WHERE agent_id = ? 
            AND created_at BETWEEN ? AND ?
            AND disposition IN ('PIF','SIF','FCL','PRT')
          GROUP BY agent_case_id
        ) customer_totals ON customer_totals.agent_case_id = latest_status.agent_case_id
      GROUP BY latest_status.disposition
      `,
      [agentId, startDateStr, endDateStr, agentId, startDateStr, endDateStr]
    );

    const formattedBreakdown = {
      PIF: { customer_count: 0, total_amount: 0 },
      SIF: { customer_count: 0, total_amount: 0 },
      FCL: { customer_count: 0, total_amount: 0 },
      PRT: { customer_count: 0, total_amount: 0 },
    };

    let totalCollectedAmount = 0;
    let totalCollectedCount = 0;

    breakdownRows.forEach((item) => {
      if (formattedBreakdown[item.disposition]) {
        formattedBreakdown[item.disposition] = {
          customer_count: item.customer_count,
          total_amount: item.total_amount,
        };
      }
      totalCollectedAmount += parseFloat(item.total_amount || 0);
      totalCollectedCount += parseInt(item.customer_count || 0);
    });

    /* ==========================================
       SECTION B: CALL ACTIVITY & PTP OVERVIEW
       FIX: Only counts Active PTPs. If Latest state is RTP/BRP, it zeros out.
       ========================================== */
    const [[callsAttendedRow]] = await pool.query(
      `SELECT COUNT(*) AS calls_attended FROM agent_dispositions WHERE agent_id = ? AND created_at BETWEEN ? AND ?`,
      [agentId, startDateStr, endDateStr]
    );

    const [[ptpData]] = await pool.query(
      `
      SELECT 
        COUNT(latest_ad.id) AS ptp_count,
        COALESCE(SUM(latest_ad.promise_amount), 0) AS total_ptp_amount
      FROM (
        SELECT agent_case_id, MAX(id) AS max_id
        FROM agent_dispositions
        WHERE agent_id = ? AND created_at BETWEEN ? AND ?
        GROUP BY agent_case_id
      ) latest
      JOIN agent_dispositions latest_ad ON latest_ad.id = latest.max_id
      WHERE latest_ad.disposition = 'PTP'
      `,
      [agentId, startDateStr, endDateStr]
    );

    /* ==========================================
       SECTION C: MONTHLY SUMMARY (Calendar Month)
       ========================================== */
    const [[monthlyActuals]] = await pool.query(
      `
      SELECT 
        COUNT(DISTINCT latest_status.agent_case_id) AS total_collected_count, 
        COALESCE(SUM(customer_totals.total_paid), 0) AS total_collected_amount
      FROM 
        (
          SELECT ad.agent_case_id
          FROM agent_dispositions ad
          JOIN (
            SELECT agent_case_id, MAX(id) AS latest_id
            FROM agent_dispositions
            WHERE agent_id = ? AND created_at BETWEEN ? AND ?
            GROUP BY agent_case_id
          ) latest ON latest.latest_id = ad.id
          WHERE ad.disposition IN ('PIF','SIF','FCL','PRT')
        ) latest_status
      JOIN 
        (
          SELECT agent_case_id, SUM(promise_amount) as total_paid
          FROM agent_dispositions
          WHERE agent_id = ? 
            AND created_at BETWEEN ? AND ?
            AND disposition IN ('PIF','SIF','FCL','PRT')
          GROUP BY agent_case_id
        ) customer_totals ON customer_totals.agent_case_id = latest_status.agent_case_id
      `,
      [agentId, monthlyStartStr, monthlyEndStr, agentId, monthlyStartStr, monthlyEndStr]
    );

    // FIX: Monthly Expected PTPs using Latest State Logic
    const [[monthlyExpected]] = await pool.query(
      `
      SELECT COALESCE(SUM(latest_ad.promise_amount), 0) AS expected_amount
      FROM (
        SELECT agent_case_id, MAX(id) AS max_id
        FROM agent_dispositions
        WHERE agent_id = ? AND created_at BETWEEN ? AND ?
        GROUP BY agent_case_id
      ) latest
      JOIN agent_dispositions latest_ad ON latest_ad.id = latest.max_id
      WHERE latest_ad.disposition = 'PTP'
      `,
      [agentId, monthlyStartStr, monthlyEndStr]
    );

    const monthlyActualAmount = monthlyActuals?.total_collected_amount || 0;
    let achievementPercent = 0;
    if (targetAmount && targetAmount > 0) {
      achievementPercent = ((monthlyActualAmount / targetAmount) * 100).toFixed(2);
    }

    res.json({
      timeFilter,
      dateRange: { start: startDateStr, end: endDateStr },
      overview: {
        calls_attended: callsAttendedRow?.calls_attended || 0,
        ptp_count: ptpData?.ptp_count || 0,
        total_ptp_amount: ptpData?.total_ptp_amount || 0,
      },
      breakdown: formattedBreakdown,
      summary: {
        total_collected_count: totalCollectedCount,
        total_collected_amount: totalCollectedAmount,
      },
      monthlySummary: {
        dateRange: { start: monthlyStartStr, end: monthlyEndStr },
        total_collected_count: monthlyActuals?.total_collected_count || 0,
        total_collected_amount: monthlyActualAmount,
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

/* ==========================================
   GET AGENT DRILLDOWN
   Fetch specific customer list for a disposition
   ========================================== */
export const getAgentDrilldown = async (req, res) => {
  try {
    const agentId = req.user.id;
    const { disposition, timeFilter = 'thisMonth', fromDate, toDate } = req.query;

    if (!disposition) {
      return res.status(400).json({ message: "Disposition is required" });
    }

    // 1. Calculate Date Range (Matches Agent Analytics logic)
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
          const day = today.getDay();
          const diff = today.getDate() - day + (day === 0 ? -6 : 1); 
          startDate.setDate(diff); 
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

    // 2. Build the condition and parameters
    let dispositionCondition = "";
    
    // FIX: We now need 6 base parameters (3 for identifying the latest row, 3 for calculating the sum)
    const params = [
      agentId, startDateStr, endDateStr, // For target_cases subquery
      agentId, startDateStr, endDateStr  // For totals subquery
    ];

    if (disposition === "TOTAL_COLLECTED") {
      dispositionCondition = "latest_ad.disposition IN ('PIF', 'SIF', 'FCL', 'PRT')";
    } else {
      dispositionCondition = "latest_ad.disposition = ?";
      params.push(disposition);
    }

    // 3. Fetch the data with conditional SUM logic
    const [rows] = await pool.query(
      `
      SELECT 
        COALESCE(ac.customer_name, cd.cust_name) AS customer_name, 
        COALESCE(ac.phone, cd.mobileno) AS contact_no, 
        c.campaign_name, 
        latest_ad.disposition AS latest_disposition, 
        
        -- FIX: If it is a cumulative transaction (PRT, etc.), show the SUM. If PTP, show the latest amount.
        CASE 
          WHEN latest_ad.disposition IN ('PIF', 'SIF', 'FCL', 'PRT') THEN COALESCE(totals.total_paid, 0)
          ELSE latest_ad.promise_amount 
        END AS amount, 
        
        latest_ad.follow_up_date, 
        latest_ad.follow_up_time,
        latest_ad.payment_date
      FROM (
        SELECT ad.agent_case_id, MAX(ad.id) AS max_ad_id
        FROM agent_dispositions ad
        WHERE ad.agent_id = ? AND ad.created_at BETWEEN ? AND ?
        GROUP BY ad.agent_case_id
      ) target_cases
      JOIN agent_dispositions latest_ad ON latest_ad.id = target_cases.max_ad_id
      JOIN agent_cases ac ON ac.id = latest_ad.agent_case_id
      LEFT JOIN coll_data cd ON cd.id = ac.coll_data_id 
      LEFT JOIN campaigns c ON c.id = cd.campaign_id
      
      -- FIX: Calculate total payments for cumulative tracking to prevent missing historical PRT payments
      LEFT JOIN (
        SELECT agent_case_id, SUM(promise_amount) AS total_paid
        FROM agent_dispositions
        WHERE agent_id = ? 
          AND created_at BETWEEN ? AND ?
          AND disposition IN ('PIF', 'SIF', 'FCL', 'PRT')
        GROUP BY agent_case_id
      ) totals ON totals.agent_case_id = latest_ad.agent_case_id
      
      WHERE ${dispositionCondition}
      ORDER BY latest_ad.created_at DESC
      `,
      params
    );

    res.json({ data: rows });
  } catch (err) {
    console.error("getAgentDrilldown error:", err);
    res.status(500).json({ message: "Failed to fetch drilldown data" });
  }
};