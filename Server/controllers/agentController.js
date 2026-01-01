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

    const [dispositions] = await pool.query(
      `
      SELECT disposition, remarks, promise_amount, created_at
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

    const {
      disposition,
      remarks,
      promiseAmount,
      followUpDate,
      followUpTime,
    } = req.body;

    const FOLLOWUP_REQUIRED = ['PTP', 'CBC', 'BRP'];

    // 🔒 HARD VALIDATIONS
    if (!disposition)
      return res.status(400).json({ message: "Disposition required" });

    if (promiseAmount === undefined || promiseAmount === null)
      return res.status(400).json({ message: "Promise amount required" });

    if (FOLLOWUP_REQUIRED.includes(disposition)) {
      if (!followUpDate || !followUpTime) {
        return res.status(400).json({
          message: "Follow-up date and time required",
        });
      }
    }

    await conn.beginTransaction();

    // 1. Lock coll_data row by id (allow claiming even if coll_data.agent_id is NULL)
    const [[collData]] = await conn.query(
      `SELECT id, cust_name, mobileno, loan_agreement_no, campaign_id, agent_id
       FROM coll_data
       WHERE id = ? AND is_active = TRUE
       FOR UPDATE`,
      [caseId]
    );

    if (!collData) {
      await conn.rollback();
      return res.status(404).json({ message: "Case not found" });
    }

    // 2. Lock/check agent_cases for this coll_data
    const [[existingCase]] = await conn.query(
      `SELECT id, agent_id FROM agent_cases WHERE coll_data_id = ? FOR UPDATE`,
      [caseId]
    );

    // If an agent_case exists and belongs to another agent, reject
    if (existingCase && existingCase.agent_id !== agentId) {
      await conn.rollback();
      return res.status(403).json({ message: "Case already assigned to another agent" });
    }

    let agentCaseId;
    if (!existingCase) {
      // If coll_data.agent_id is null, claim it for this agent
      if (!collData.agent_id) {
        await conn.query(`UPDATE coll_data SET agent_id = ? WHERE id = ?`, [agentId, caseId]);
      }

      const [result] = await conn.query(
        `INSERT INTO agent_cases
        (agent_id, coll_data_id, customer_name, phone, status, allocation_date)
        VALUES (?, ?, ?, ?, ?, NOW())`,
        [
          agentId,
          caseId,
          collData.cust_name,
          collData.mobileno,
          'NEW',
        ]
      );
      agentCaseId = result.insertId;
    } else {
      agentCaseId = existingCase.id;
    }

    // 3. SAVE DISPOSITION + AMOUNT
    const safeRemarks = remarks?.trim() || null;

    await conn.query(
      `INSERT INTO agent_dispositions
      (agent_case_id, disposition, remarks, promise_amount)
      VALUES (?, ?, ?, ?)`,
      [agentCaseId, disposition, safeRemarks, promiseAmount]
    );

    // 4. UPDATE STATUS
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

    // 5. Try to allocate next queued coll_data to this agent (same campaign preferred)
    let nextAssigned = null;

    // Get campaigns mapped to this agent
    const [campaignRows] = await conn.query(
      `SELECT campaign_id FROM campaign_agents WHERE agent_id = ?`,
      [agentId]
    );

    const campaignIds = campaignRows.map((r) => r.campaign_id);

    if (campaignIds.length) {
      // Try to pick next from same campaign as current collData
      const [[nextSame]] = await conn.query(
        `SELECT id, cust_name, mobileno, loan_agreement_no, campaign_id
         FROM coll_data
         WHERE agent_id IS NULL AND is_active = TRUE AND campaign_id = ?
         ORDER BY created_at ASC
         LIMIT 1
         FOR UPDATE`,
        [collData.campaign_id]
      );

      let nextRow = nextSame;

      if (!nextRow) {
        // pick from any campaign assigned to agent
        const placeholders = campaignIds.map(() => "?").join(",");
        const [rowsAny] = await conn.query(
          `SELECT id, cust_name, mobileno, loan_agreement_no, campaign_id
           FROM coll_data
           WHERE agent_id IS NULL AND is_active = TRUE AND campaign_id IN (${placeholders})
           ORDER BY created_at ASC
           LIMIT 1
           FOR UPDATE`,
          campaignIds
        );
        nextRow = rowsAny[0];
      }

      if (nextRow) {
        await conn.query(`UPDATE coll_data SET agent_id = ? WHERE id = ?`, [agentId, nextRow.id]);
        await conn.query(
          `INSERT INTO agent_cases (agent_id, coll_data_id, customer_name, phone, status, allocation_date)
           VALUES (?, ?, ?, ?, ?, NOW())`,
          [agentId, nextRow.id, nextRow.cust_name, nextRow.mobileno, 'NEW']
        );

        // update last_assigned_at for the campaign-agent mapping
        await conn.query(
          `UPDATE campaign_agents SET last_assigned_at = NOW() WHERE campaign_id = ? AND agent_id = ?`,
          [nextRow.campaign_id, agentId]
        );

        nextAssigned = nextRow.id;
      }
    }

    await conn.commit();

    return res.json({ message: "Disposition saved", status: "DONE", nextAssigned });
  } catch (err) {
    await conn.rollback();
    console.error(err);
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

    // 1. Get campaigns assigned to agent
    const [campaignRows] = await conn.query(
      `SELECT campaign_id FROM campaign_agents WHERE agent_id = ?`,
      [agentId]
    );

    const campaignIds = campaignRows.map((r) => r.campaign_id);
    if (!campaignIds.length) {
      await conn.commit();
      return res.status(400).json({ message: "Agent not assigned to any campaigns. Contact admin to assign campaigns." });
    }

    // 2. Try to pick oldest unassigned record across agent's campaigns
    const placeholders = campaignIds.map(() => "?").join(",");
    const [rows] = await conn.query(
      `SELECT id, cust_name, mobileno, loan_agreement_no, campaign_id
       FROM coll_data
       WHERE agent_id IS NULL AND is_active = TRUE AND campaign_id IN (${placeholders})
       ORDER BY created_at ASC
       LIMIT 1
       FOR UPDATE`,
      campaignIds
    );

    const next = rows[0];
    if (!next) {
      await conn.commit();
      return res.status(204).json({ message: "No unassigned customers in queue" });
    }

    // 3. Assign to agent and create agent_cases
    await conn.query(`UPDATE coll_data SET agent_id = ? WHERE id = ?`, [agentId, next.id]);
    
    await conn.query(
      `INSERT INTO agent_cases (agent_id, coll_data_id, customer_name, phone, status, allocation_date)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [agentId, next.id, next.cust_name, next.mobileno, 'NEW']
    );

    // 4. update last_assigned_at
    await conn.query(
      `UPDATE campaign_agents SET last_assigned_at = NOW() WHERE campaign_id = ? AND agent_id = ?`,
      [next.campaign_id, agentId]
    );

    await conn.commit();

    // return simple case payload
    return res.json({ caseId: next.id, customer_name: next.cust_name, phone: next.mobileno, loan_id: next.loan_agreement_no });
  } catch (err) {
    if (conn) {
      try {
        await conn.rollback();
      } catch (rollbackErr) {
        console.error("Rollback error:", rollbackErr);
      }
    }
    console.error("getNextCase error:", err);
    return res.status(500).json({ message: "Failed to fetch next case", error: err.message });
  } finally {
    if (conn) conn.release();
  }
};
