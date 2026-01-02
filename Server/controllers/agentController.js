import pool from '../config/mysql.js';

/**
 * GET /api/agent/cases
 * Fetch agent dashboard list from Coll_Data table
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
        COALESCE(ac.status, 'NEW') AS status,
        ac.first_call_at,
        ac.last_call_at,
        ac.follow_up_date,
        ac.follow_up_time
      FROM coll_data c
      LEFT JOIN agent_cases ac
        ON ac.coll_data_id = c.id
      WHERE c.agent_id = ?
        AND c.is_active = 1
      ORDER BY c.created_at DESC
      `,
      [agentId]
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
 */
export const getAgentCaseById = async (req, res) => {
  try {
    const agentId = req.user.id;
    const { caseId } = req.params;

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
        c.amt_outst,
        c.tenure,
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
      WHERE c.id = ?
        AND (c.agent_id = ? OR c.agent_id IS NULL)
      `,
      [caseId, agentId]
    );

    if (!row) {
      return res.status(404).json({ message: "Case not found" });
    }

    // Get current dispositions
    const [dispositions] = await pool.query(
      `
      SELECT id, disposition, remarks, promise_amount, follow_up_date, follow_up_time, created_at
      FROM agent_dispositions
      WHERE agent_case_id = (
        SELECT id FROM agent_cases WHERE coll_data_id = ?
      )
      ORDER BY created_at DESC
      `,
      [caseId]
    );

    // Get edit history
    const [editHistory] = await pool.query(
      `
      SELECT id, disposition, remarks, promise_amount, follow_up_date, follow_up_time, edited_at
      FROM agent_dispositions_edit_history
      WHERE agent_case_id = (
        SELECT id FROM agent_cases WHERE coll_data_id = ?
      )
      ORDER BY edited_at DESC
      `,
      [caseId]
    );

    return res.json({
      case: row,
      dispositions: dispositions || [],
      editHistory: editHistory || [],
    });
  } catch (err) {
    console.error("getAgentCaseById error:", err);
    return res.status(500).json({ message: "Failed to fetch case details" });
  }
};


/**
 * POST /api/agent/cases/:caseId/disposition
 * Submit or edit disposition with automatic status tracking
 */
export const submitDisposition = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const agentId = req.user.id;
    const { caseId } = req.params;
    const { disposition, remarks, promiseAmount, followUpDate, followUpTime, isEdit } = req.body;

    // Status mapping by disposition type
    const FOLLOW_UP = ['PTP','BRP','PRT','FCL','CBC'];
    const IN_PROGRESS = ['RTP','TPC','LNB','VOI','RNR','SOW','OOS','WRN'];
    const DONE = ['SIF','PIF'];

    if (!disposition)
      return res.status(400).json({ message: "Disposition required" });

    await conn.beginTransaction();

    // 1️⃣ Verify agent case exists and belongs to agent
    const [[agentCase]] = await conn.query(
      `SELECT id, status, coll_data_id FROM agent_cases
       WHERE agent_id = ? AND is_active = 1
       FOR UPDATE`,
      [agentId]
    );

    if (!agentCase || agentCase.coll_data_id !== Number(caseId)) {
      await conn.rollback();
      return res.status(404).json({ message: "Active case not found" });
    }

    // 2️⃣ Determine new status based on disposition
    let newStatus = agentCase.status;
    if (FOLLOW_UP.includes(disposition)) newStatus = 'FOLLOW_UP';
    else if (IN_PROGRESS.includes(disposition)) newStatus = 'IN_PROGRESS';
    else if (DONE.includes(disposition)) newStatus = 'DONE';

    const statusChanged = newStatus !== agentCase.status;

    // 3️⃣ If editing, save old disposition to edit history
    if (isEdit) {
      const [[lastDisposition]] = await conn.query(
        `SELECT * FROM agent_dispositions 
         WHERE agent_case_id = ? 
         ORDER BY created_at DESC 
         LIMIT 1`,
        [agentCase.id]
      );

      if (lastDisposition) {
        await conn.query(
          `INSERT INTO agent_dispositions_edit_history 
           (agent_case_id, disposition, remarks, promise_amount, follow_up_date, follow_up_time, edited_at)
           VALUES (?, ?, ?, ?, ?, ?, NOW())`,
          [agentCase.id, lastDisposition.disposition, lastDisposition.remarks, 
           lastDisposition.promise_amount, lastDisposition.follow_up_date, lastDisposition.follow_up_time]
        );
      }

      // Delete old disposition and insert new one
      await conn.query(
        `DELETE FROM agent_dispositions WHERE agent_case_id = ? ORDER BY created_at DESC LIMIT 1`,
        [agentCase.id]
      );
    }

    // 4️⃣ Insert or update disposition
    await conn.query(
      `INSERT INTO agent_dispositions
       (agent_case_id, disposition, remarks, promise_amount, follow_up_date, follow_up_time)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        agentCase.id,
        disposition,
        remarks || null,
        (FOLLOW_UP.includes(disposition) || DONE.includes(disposition)) ? promiseAmount : null,
        (FOLLOW_UP.includes(disposition) || DONE.includes(disposition)) ? followUpDate : null,
        (FOLLOW_UP.includes(disposition) || DONE.includes(disposition)) ? followUpTime : null,
      ]
    );

    // 5️⃣ Update case status only if it changed
    if (statusChanged) {
      await conn.query(
        `UPDATE agent_cases
         SET
           status = ?,
           is_active = 0,
           last_call_at = NOW(),
           follow_up_date = ?,
           follow_up_time = ?
         WHERE id = ?`,
        [
          newStatus,
          (FOLLOW_UP.includes(disposition) || DONE.includes(disposition)) ? followUpDate : null,
          (FOLLOW_UP.includes(disposition) || DONE.includes(disposition)) ? followUpTime : null,
          agentCase.id,
        ]
      );
    }

    await conn.commit();

    // Only allocate next if status changes to DONE (not for FOLLOW_UP or IN_PROGRESS)
    const shouldAllocateNext = statusChanged;

    return res.json({
      message: "Disposition saved successfully",
      status: newStatus,
      allocateNext: shouldAllocateNext
    });

  } catch (err) {
    await conn.rollback();
    console.error("submitDisposition error:", err);
    return res.status(500).json({ message: "Failed to submit disposition" });
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
    const [[next]] = await conn.query(
      `SELECT id, cust_name, mobileno, loan_agreement_no
       FROM coll_data
       WHERE agent_id IS NULL AND is_active = 1
       ORDER BY created_at ASC
       LIMIT 1
       FOR UPDATE`
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
