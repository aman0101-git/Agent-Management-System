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
 * Fetch single case + disposition history from Coll_Data
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
        c.dpd,
        c.pos,
        c.insl_amt,
        c.amt_outst,
        c.tenure,
        c.product_code,
        c.loan_status,
        c.extra_fields,

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

    const [dispositions] = await pool.query(
      `
      SELECT disposition, remarks, notes, created_at
      FROM agent_dispositions
      WHERE agent_case_id = (
        SELECT id FROM agent_cases WHERE coll_data_id = ?
      )
      ORDER BY created_at DESC
      `,
      [caseId]
    );

    return res.json({
      case: row,
      dispositions: dispositions || [],
    });
  } catch (err) {
    console.error("getAgentCaseById error:", err);
    return res.status(500).json({ message: "Failed to fetch case details" });
  }
};


/**
 * POST /api/agent/cases/:caseId/disposition
 * Submit disposition - creates agent_cases record if needed
 */
export const submitDisposition = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const agentId = req.user.id;
    const { caseId } = req.params;
    const { disposition, remarks, notes, followUpDate, followUpTime } = req.body;

    const FOLLOWUP_REQUIRED = ['PTP', 'CBC', 'BRP'];

    if (FOLLOWUP_REQUIRED.includes(disposition)) {
      if (!followUpDate || !followUpTime) {
        return res.status(400).json({
          message: 'Follow-up date and time required',
        });
      }
    }

    await conn.beginTransaction();

    // 1. Verify the Coll_Data record belongs to this agent
    const [[collData]] = await conn.query(
      `SELECT id, cust_name, mobileno, loan_agreement_no, campaign_id 
       FROM coll_data 
       WHERE id = ? AND agent_id = ? AND is_active = TRUE FOR UPDATE`,
      [caseId, agentId]
    );

    if (!collData) {
      await conn.rollback();
      return res.status(404).json({ message: 'Case not found' });
    }

    // 2. Check if agent_cases record exists, if not create it
    const [[existingCase]] = await conn.query(
      `SELECT id FROM agent_cases WHERE coll_data_id = ?`,
      [caseId]
    );

    let agentCaseId;
    if (!existingCase) {
      const [result] = await conn.query(
        `INSERT INTO agent_cases 
         (agent_id, campaign_id, coll_data_id, customer_name, phone, loan_id, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [agentId, collData.campaign_id, caseId, collData.cust_name, collData.mobileno, collData.loan_agreement_no, 'NEW']
      );
      agentCaseId = result.insertId;
    } else {
      agentCaseId = existingCase.id;
    }

    // 3. Insert disposition record
    await conn.query(
      `INSERT INTO agent_dispositions
       (agent_case_id, disposition, remarks, notes)
       VALUES (?, ?, ?, ?)`,
      [agentCaseId, disposition, remarks || null, notes || null]
    );

    // 4. Update agent_cases status
    await conn.query(
      `UPDATE agent_cases
       SET
         status = 'DONE',
         first_call_at = COALESCE(first_call_at, NOW()),
         last_call_at = NOW(),
         follow_up_date = ?,
         follow_up_time = ?
       WHERE id = ?`,
      [
        FOLLOWUP_REQUIRED.includes(disposition) ? followUpDate : null,
        FOLLOWUP_REQUIRED.includes(disposition) ? followUpTime : null,
        agentCaseId,
      ]
    );

    // 5. Assign next available unassigned record (if any) from same campaign to this agent
    const [[nextRecord]] = await conn.query(
      `SELECT id FROM coll_data WHERE campaign_id = ? AND agent_id IS NULL AND is_active = TRUE ORDER BY id LIMIT 1 FOR UPDATE`,
      [collData.campaign_id]
    );

    let nextAssigned = null;
    if (nextRecord && nextRecord.id) {
      await conn.query(`UPDATE coll_data SET agent_id = ? WHERE id = ?`, [agentId, nextRecord.id]);
      nextAssigned = nextRecord.id;
    }

    await conn.commit();

    return res.json({ message: 'Disposition saved', status: 'DONE', nextAssigned });
  } catch (err) {
    await conn.rollback();
    return res.status(500).json({ message: 'Failed to submit disposition' });
  } finally {
    conn.release();
  }
};
