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
import pool from '../config/mysql.js';
import {
  DISPOSITION_RULES,
  validateDispositionData,
  getResultStatus,
} from '../config/dispositionRules.js';

/**
 * GET /api/agent/cases
 * Fetch agent dashboard list from Coll_Data table
 * ISSUE #12 FIX: Enforce campaign-to-agent mapping - agents only see their campaign data
 * Excludes IN_PROCESS status (Rechurn) data
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
        COALESCE(ac.status, 'NEW') AS status,
        ac.first_call_at,
        ac.last_call_at,
        ac.follow_up_date,
        ac.follow_up_time
      FROM coll_data c
      LEFT JOIN agent_cases ac
        ON ac.coll_data_id = c.id
      /* ISSUE #12 FIX: Ensure agent is mapped to the campaign */
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
 * ISSUE #12 FIX: Verify agent belongs to the case's campaign
 */
export const getAgentCaseById = async (req, res) => {
  try {
    const agentId = req.user.id;
    const { caseId } = req.params;

    /* ===============================
       1️⃣ Fetch main case details
       ISSUE #12 FIX: Verify campaign assignment
       =============================== */
    const [[row]] = await pool.query(
      `
      SELECT
        c.id,
        c.created_at AS allocation_date,
        c.cust_name AS customer_name,
        c.mobileno AS phone,
        c.loan_agreement_no AS loan_id,

        c.branch_name,
        c.hub_name,
        c.group_name,
        c.agency,

        c.dpd,
        c.pos,
        c.insl_amt,
        c.inst_over,
        c.amt_outst,
        c.tenure,
        c.bom_bucket,
        c.penal_over,
        c.amount_finance,
        c.product_code,
        c.loan_status,
        c.extra_fields,

        c.res_addr,
        c.off_addr,
        c.disb_date,
        c.maturity_date,
        c.fdd,

        c.agent_id,
        c.batch_month,
        c.batch_year,
        c.campaign_id,
        c.is_active,

        COALESCE(ac.status, 'NEW') AS status,
        ac.first_call_at,
        ac.last_call_at,
        ac.follow_up_date,
        ac.follow_up_time
      FROM coll_data c
      LEFT JOIN agent_cases ac
        ON ac.coll_data_id = c.id
      INNER JOIN campaign_agents ca
        ON ca.agent_id = ? AND ca.campaign_id = c.campaign_id
      WHERE c.id = ?
        AND c.agent_id = ?
      ORDER BY ac.created_at DESC
      LIMIT 1
      `,
      [agentId, caseId, agentId]
    );

    if (!row) {
      return res.status(404).json({ message: "Case not found" });
    }

    /* ===============================
       2️⃣ Resolve latest agent_case_id
       =============================== */
    const [[agentCase]] = await pool.query(
      `
      SELECT id
      FROM agent_cases
      WHERE coll_data_id = ?
        AND agent_id = ?
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [caseId, agentId]
    );

    if (!agentCase) {
      return res.json({
        case: row,
        dispositions: [],
        editHistory: [],
      });
    }

    /* ===============================
       3️⃣ Fetch disposition history
       ISSUE #8 FIX: Include ptp_target in query
       =============================== */
    const [dispositions] = await pool.query(
      `
      SELECT
        id,
        agent_case_id,
        disposition,
        remarks,
        promise_amount,
        follow_up_date,
        follow_up_time,
        payment_date,
        payment_time,
        ptp_target,
        created_at
      FROM agent_dispositions
      WHERE agent_case_id = ?
      ORDER BY created_at DESC
      `,
      [agentCase.id]
    );

    /* ===============================
       4️⃣ Fetch full edit history
       ISSUE #8 FIX: Include ptp_target in edit history
       =============================== */
    const [editHistory] = await pool.query(
      `
      SELECT
        id,
        agent_case_id,
        disposition,
        remarks,
        promise_amount,
        follow_up_date,
        follow_up_time,
        payment_date,
        payment_time,
        ptp_target,
        edited_at
      FROM agent_dispositions_edit_history
      WHERE agent_case_id = ?
      ORDER BY edited_at DESC
      `,
      [agentCase.id]
    );

    // Ensure follow_up_time is always a string in HH:mm:ss format
    function formatTime(val) {
      if (!val) return null;
      if (typeof val === 'string') return val;
      if (val instanceof Date) {
        // Format as HH:mm:ss
        return val.toTimeString().slice(0, 8);
      }
      return String(val);
    }

    // Format main case follow_up_time
    if (row && 'follow_up_time' in row) {
      row.follow_up_time = formatTime(row.follow_up_time);
    }

    // Format all dispositions follow_up_time
    if (Array.isArray(dispositions)) {
      for (const disp of dispositions) {
        if ('follow_up_time' in disp) {
          disp.follow_up_time = formatTime(disp.follow_up_time);
        }
      }
    }

    // Format all editHistory follow_up_time
    if (Array.isArray(editHistory)) {
      for (const edit of editHistory) {
        if ('follow_up_time' in edit) {
          edit.follow_up_time = formatTime(edit.follow_up_time);
        }
      }
    }

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
 * Submit or edit disposition
 */
/**
 * RULE-DRIVEN DISPOSITION VALIDATION
 * 
 * Validates submission against disposition rules. For time fields,
 * ensures HH:mm format is preserved (no Date object parsing).
 * 
 * @param {string} dispositionCode - e.g., 'PTP', 'CBC'
 * @param {string} followUpTime - Time in HH:mm format (e.g., "14:30")
 * @returns {object} { valid: boolean, error: string | null }
 */
function validateTimeFormat(followUpTime) {
  if (!followUpTime) return { valid: true, error: null };
  
  // Must be HH:mm format
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  if (!timeRegex.test(followUpTime)) {
    return {
      valid: false,
      error: `Invalid time format. Expected HH:mm (24-hour), got ${followUpTime}`,
    };
  }
  
  return { valid: true, error: null };
}

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
      isEdit,
    } = req.body;

    // ==========================================
    // INPUT VALIDATION
    // ==========================================
    
    if (!disposition) {
      return res.status(400).json({ message: "Disposition required" });
    }

    // Validate disposition exists
    if (!DISPOSITION_RULES[disposition]) {
      return res.status(400).json({
        message: `Unknown disposition: ${disposition}`,
      });
    }

      // Rule-driven validation (strict)
      const rule = DISPOSITION_RULES[disposition];
      const errors = [];

      // Validate required fields strictly (no 0, empty, null)
      if (rule.requires.amount && (!promiseAmount || isNaN(promiseAmount) || Number(promiseAmount) <= 0)) {
        errors.push(`Amount is required for ${rule.code}`);
      }
      if (rule.requires.followUpDate && (!followUpDate || followUpDate === '' || followUpDate === '0')) {
        errors.push(`Follow-up date is required for ${rule.code}`);
      }
      if (rule.requires.followUpTime && (!followUpTime || followUpTime === '' || followUpTime === '0')) {
        errors.push(`Follow-up time is required for ${rule.code}`);
      }
      if (disposition === 'PTP' && (!ptpTarget || ptpTarget === '' || ptpTarget === '0')) {
        errors.push('PTP target is required for PTP disposition');
      }


      // For non-required fields, ignore them (set to null)
      const safePromiseAmount = rule.requires.amount ? promiseAmount : null;
      const safeFollowUpDate = rule.requires.followUpDate ? followUpDate : null;
      const safeFollowUpTime = rule.requires.followUpTime ? followUpTime : null;
      const safePtpTarget = disposition === 'PTP' ? ptpTarget : null;
      // Only allow paymentDate for PIF, SIF, FCL, PRT
      const paymentDateDispositions = ['PIF', 'SIF', 'FCL', 'PRT'];
      const safePaymentDate = paymentDateDispositions.includes(disposition) ? paymentDate || null : null;

      // Validate paymentDate for these dispositions
      if (paymentDateDispositions.includes(disposition) && (!safePaymentDate || safePaymentDate === '')) {
        errors.push('Payment date is required for ' + disposition);
      }

      // For dispositions that don't require amount, reject if sent
      if (!rule.requires.amount && promiseAmount) {
        errors.push(`${rule.code} should not have an amount`);
      }
      // For CBC, reject amount if sent
      if (disposition === 'CBC' && promiseAmount) {
        errors.push('CBC should not have an amount');
      }

      // Validate time format if provided
      if (safeFollowUpTime) {
        const timeValidation = validateTimeFormat(safeFollowUpTime);
        if (!timeValidation.valid) {
          errors.push(timeValidation.error);
        }
      }

      if (errors.length > 0) {
        return res.status(400).json({
          message: 'Validation failed',
          errors,
        });
      }

    await conn.beginTransaction();


    // ==========================================
    // 1️⃣ LOCK LATEST AGENT_CASE & RESOLVE coll_data_id
    // ==========================================
    const [[agentCase]] = await conn.query(
      `SELECT id, status, coll_data_id FROM agent_cases WHERE coll_data_id = ? AND agent_id = ? ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
      [caseId, agentId]
    );
    if (!agentCase) {
      await conn.rollback();
      return res.status(404).json({ message: "Agent case not found" });
    }
    const collDataId = agentCase.coll_data_id;

    // ==========================================
    // 1.5️⃣ ENFORCE ONCE_PTP/ONCE_PRT CONSTRAINTS
    // ==========================================
    // Helper: check if disposition or ptp_target implies PTP/PRT
    const impliesPTP = disposition === 'PTP' || (ptpTarget && String(ptpTarget).trim() !== '');
    const impliesPRT = disposition === 'PRT';

    if (impliesPTP) {
      const [[row]] = await conn.query(
        `SELECT id FROM customer_once_constraints WHERE coll_data_id = ? AND constraint_type = 'ONCE_PTP' AND is_active = 1`,
        [collDataId]
      );
      if (row) {
        await conn.rollback();
        return res.status(400).json({ message: 'ONCE_PTP constraint already used for this customer.' });
      }
    }
    if (impliesPRT) {
      const [[row]] = await conn.query(
        `SELECT id FROM customer_once_constraints WHERE coll_data_id = ? AND constraint_type = 'ONCE_PRT' AND is_active = 1`,
        [collDataId]
      );
      if (row) {
        await conn.rollback();
        return res.status(400).json({ message: 'ONCE_PRT constraint already used for this customer.' });
      }
    }

    // ==========================================
    // 2️⃣ DETERMINE NEW STATUS FROM RULES
    // ==========================================
    
    const newStatus = getResultStatus(disposition);
    const statusChanged = newStatus !== agentCase.status;

    // ==========================================
    // 3️⃣ SAVE EDIT HISTORY (IF EDIT)
    // ==========================================
    
    if (isEdit) {
      const [[latest]] = await conn.query(
        `
        SELECT
          disposition,
          remarks,
          promise_amount,
          follow_up_date,
          follow_up_time,
          ptp_target
        FROM agent_dispositions
        WHERE agent_case_id = ?
        ORDER BY created_at DESC
        LIMIT 1
        FOR UPDATE
        `,
        [agentCase.id]
      );

      if (latest) {
        await conn.query(
          `
          INSERT INTO agent_dispositions_edit_history
          (
            agent_case_id,
            disposition,
            remarks,
            promise_amount,
            follow_up_date,
            follow_up_time,
            ptp_target
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
          [
            agentCase.id,
            latest.disposition,
            latest.remarks,
            latest.promise_amount,
            latest.follow_up_date,
            latest.follow_up_time,
            latest.ptp_target,
          ]
        );
      }
    }

    // ==========================================
    // 4️⃣ PROCESS DISPOSITION DATA
    // ==========================================
    const [result] = await conn.query(
      `
      INSERT INTO agent_dispositions
      (
        agent_case_id,
        agent_id,
        disposition,
        ptp_target,
        remarks,
        promise_amount,
        follow_up_date,
        follow_up_time,
        payment_date,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `,
      [
        agentCase.id,
        agentId,
        disposition,
        safePtpTarget,
        remarks || null,
        safePromiseAmount,
        safeFollowUpDate,
        safeFollowUpTime,
        safePaymentDate,
      ]
    );
    const insertedDispositionId = result.insertId;

    // Insert ONCE_PTP/ONCE_PRT constraint if needed
    if (impliesPTP) {
      await conn.query(
        `INSERT INTO customer_once_constraints (coll_data_id, constraint_type, triggered_disposition_id, triggered_at, is_active)
         VALUES (?, 'ONCE_PTP', ?, NOW(), 1)
         ON DUPLICATE KEY UPDATE is_active = 1, triggered_disposition_id = VALUES(triggered_disposition_id), triggered_at = VALUES(triggered_at)`,
        [collDataId, insertedDispositionId]
      );
    }
    if (impliesPRT) {
      await conn.query(
        `INSERT INTO customer_once_constraints (coll_data_id, constraint_type, triggered_disposition_id, triggered_at, is_active)
         VALUES (?, 'ONCE_PRT', ?, NOW(), 1)
         ON DUPLICATE KEY UPDATE is_active = 1, triggered_disposition_id = VALUES(triggered_disposition_id), triggered_at = VALUES(triggered_at)`,
        [collDataId, insertedDispositionId]
      );
    }

    // ==========================================
    // 5️⃣ UPDATE AGENT_CASE
    // ==========================================
    
    if (statusChanged) {
      await conn.query(
        `
        UPDATE agent_cases
        SET
          status = ?,
          is_active = 0,
          first_call_at = COALESCE(first_call_at, NOW()),
          last_call_at = NOW(),
          follow_up_date = ?,
          follow_up_time = ?
        WHERE id = ?
        `,
        [
          newStatus,
          safeFollowUpDate,
          safeFollowUpTime,
          agentCase.id,
        ]
      );
    }

    await conn.commit();

    return res.json({
      message: "Disposition saved successfully",
      status: newStatus,
      allocateNext: statusChanged && newStatus === 'DONE',
      allocateNextOnStatusChange: statusChanged,
    });

  } catch (err) {
    await conn.rollback();
    console.error("submitDisposition error:", err);
    return res.status(500).json({
      message: "Failed to submit disposition",
      error: err.message,
    });
  } finally {
    conn.release();
  }
};

/**
 * GET /api/agent/cases/next
 * Allocate and fetch a single next queued case for the agent
 * ISSUE #12 FIX: Only assign cases from campaigns the agent is mapped to
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
 * Search any customer in the database by Loan ID, Name, or Phone
 * Automatically creates agent_case if none exists (for inbound calls)
 */
export const searchCustomers = async (req, res) => {
  try {
    const agentId = req.user.id;
    const { query } = req.body;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({ message: "Search query required" });
    }

    const searchTerm = `%${query}%`;

    const [customers] = await pool.query(
      `
      SELECT
        id,
        loan_agreement_no,
        cust_name,
        mobileno,
        appl_id,
        branch_name,
        hub_name,
        amt_outst,
        pos,
        bom_bucket,
        dpd,
        loan_status,
        res_addr,
        created_at
      FROM coll_data
      WHERE (
        loan_agreement_no LIKE ?
        OR LOWER(cust_name) LIKE LOWER(?)
        OR mobileno LIKE ?
      )
      ORDER BY id DESC
      LIMIT 50
      `,
      [searchTerm, searchTerm, searchTerm]
    );

    // For each customer, check if already assigned to THIS AGENT
    // Only create case if NOT already assigned to this agent
    const enrichedCustomers = await Promise.all(
      customers.map(async (customer) => {
        const [[existingCase]] = await pool.query(
          `
          SELECT id, is_active 
          FROM agent_cases 
          WHERE coll_data_id = ?
          LIMIT 1
          `,
          [customer.id, agentId]
        );

        // Only create new case if this agent doesn't have an active case for this customer
        if (!existingCase || !existingCase.is_active) {
          // First check: is this customer assigned to ANY agent?
          const [[assignedToAnyAgent]] = await pool.query(
            `
            SELECT id 
            FROM agent_cases 
            WHERE coll_data_id = ? 
            LIMIT 1
            `,
            [customer.id]
          );

          // Only create case if NOT assigned to any other active agent
          if (!assignedToAnyAgent) {
            // Create new agent_case for this customer
            await pool.query(
              `
              INSERT INTO agent_cases (agent_id, coll_data_id, status) 
              VALUES (?, ?, 'NEW', 1)
              `,
              [agentId, customer.id]
            );
          }
        }

        return customer;
      })
    );

    res.json({ data: enrichedCustomers, count: enrichedCustomers.length });
  } catch (err) {
    console.error("searchCustomers error:", err);
    res.status(500).json({ message: "Failed to search customers" });
  }
};

/**
 * GET /api/agent/analytics
 * Get performance analytics for logged-in agent with time filtering
 * Query params: timeFilter (today, yesterday, thisWeek, thisMonth, custom)
 *               fromDate (YYYY-MM-DD) - for custom filter
 *               toDate (YYYY-MM-DD) - for custom filter
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

      // Parse and validate dates
      const from = new Date(fromDate);
      const to = new Date(toDate);

      if (isNaN(from.getTime()) || isNaN(to.getTime())) {
        return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD" });
      }

      if (from > to) {
        return res.status(400).json({ message: "fromDate must be <= toDate" });
      }
    }

    // Calculate date range based on timeFilter
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

    // ✅ Fetch agent target for CURRENT MONTH (not campaign target)
    // Build YYYY-MM from local date components to avoid timezone shifts
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
       SECTION A: Call & PTP Overview
      // ==========================================
      // 4️⃣ PROCESS DISPOSITION DATA
      // ==========================================
      await conn.query(
        `
        INSERT INTO agent_dispositions
        (
          agent_case_id,
          agent_id,
          disposition,
          ptp_target,
          remarks,
          promise_amount,
          follow_up_date,
          follow_up_time,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `,
        [
          agentCase.id,
          agentId,
          disposition,
          safePtpTarget,
          remarks || null,
          safePromiseAmount,
          safeFollowUpDate,
          safeFollowUpTime,
        ]
      );
      // ==========================================
      // 4️⃣ PROCESS DISPOSITION DATA
      // ==========================================
      await conn.query(
        `
        INSERT INTO agent_dispositions
        (
          agent_case_id,
          agent_id,
          disposition,
          ptp_target,
          remarks,
          promise_amount,
          follow_up_date,
          follow_up_time,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `,
        [
          agentCase.id,
          agentId,
          disposition,
          safePtpTarget,
          remarks || null,
          safePromiseAmount,
          safeFollowUpDate,
          safeFollowUpTime,
        ]
      );
        ) latest
          ON latest.agent_case_id = ad.agent_case_id
         AND latest.latest_time = ad.created_at
      ) latest_cases
      WHERE disposition IN ('PIF','SIF','FCL','PRT')
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


    // Fetch collection breakdown from DB
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

    // Calculate achievement percentage for monthly summary
    const monthlyActual = monthlySummary.total_collected_amount || 0;
    let achievementPercent = 0;
    if (targetAmount && targetAmount > 0) {
      achievementPercent = ((monthlyActual / targetAmount) * 100).toFixed(2);
    }

    // Fetch PTP overview data
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

    // Fetch collection summary for the filtered period
    const [[collectionSummary]] = await pool.query(
      `
        SELECT COUNT(*) AS total_collected_count, COALESCE(SUM(promise_amount), 0) AS total_collected_amount
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

    res.json({
      timeFilter,
      dateRange: { start: startDateStr, end: endDateStr },
      overview: {
        calls_attended: ptpData.calls_attended || 0,
        ptp_count: ptpData.ptp_count || 0,
        total_ptp_amount: ptpData.total_ptp_amount || 0,
      },
      breakdown: formattedBreakdown,
      summary: {
        total_collected_count: collectionSummary?.total_collected_count || 0,
        total_collected_amount: collectionSummary?.total_collected_amount || 0,
      },
      // Monthly summary (ALWAYS calendar month, independent of filter)
      // Now using agent_targets instead of campaign targets
      monthlySummary: {
        dateRange: { start: monthlyStartStr, end: monthlyEndStr },
        total_collected_count: monthlySummary.total_collected_count || 0,
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
