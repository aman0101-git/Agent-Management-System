import pool from "../config/mysql.js";
import xlsx from "xlsx";
import {
  validateHeaders,
  normalize,
  REQUIRED_COLUMNS,
  mapHeader,
  convertDateFields,
} from "../utils/validateDataFile.js";

/**
 * Columns that exist directly in coll_data table
 */
const FIXED_COLUMNS = {
  branch_name: true,
  appl_id: true,
  child_loan1: true,
  child_loan2: true,
  insl_amt: true,
  inst_over: true,
  amt_outst: true,
  tos: true,
  pos: true,
  bom_bucket: true,
  last_paid_amount: true,
  last_paid_date: true,
  emi_pending_count: true,
  sif_allowed: true,
  dpd: true,
  penal_intrst: true,
  penal_over: true,
  chq_bnc_chrg: true,
  cust_id: true,
  cust_name: true,
  amount_finance: true,
  group_name: true,
  tenure: true,
  loan_status: true,
  res_addr: true,
  ph_no_res: true,
  fresh_vintage_regular: true,
  month_diff_exp_dt: true,
  expiry_date: true,
  disb_date: true,
  maturity_date: true,
  fdd: true,
  mobileno: true,
  contact_no1: true,
  current_org: true,
  dob: true,
  off_addr: true,
  product_id: true,
  product_code: true,
  asset_desc: true,
  reason_bounc_chek: true,
  bank_name: true,
  disb_dlr_name: true,
  asset_category: true,
  agency: true,
  state: true,
  max_txn_entry_date: true,
  days_diff_max_txn_dt: true,
  feedback: true,
  ptp_date: true,
  loan_agreement_no: true,
};

export const ingestLoans = async (req, res) => {
  let conn;
  try {
    const { campaign_id } = req.body;
    if (!campaign_id)
      return res.status(400).json({ message: "Campaign is required" });

    if (!req.file)
      return res.status(400).json({ message: "File not provided" });

    conn = await pool.getConnection();
    await conn.beginTransaction();

    // Validate campaign
    const [[campaign]] = await conn.query(
      "SELECT id FROM campaigns WHERE id = ? AND status = 'ACTIVE'",
      [campaign_id]
    );
    if (!campaign) throw new Error("Invalid or inactive campaign");

    // Fetch agents with persistent round-robin support
    const [agents] = await conn.query(
      `
      SELECT id, agent_id, last_assigned_at
      FROM campaign_agents
      WHERE campaign_id = ?
      ORDER BY
        last_assigned_at IS NOT NULL,
        last_assigned_at ASC,
        id ASC
      `,
      [campaign_id]
    );

    if (!agents.length)
      throw new Error("No agents mapped to this campaign");

    // Read Excel
    const workbook = xlsx.read(req.file.buffer);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet);

    if (!rows.length) throw new Error("Empty Excel file");

    const headers = Object.keys(rows[0]);
    if (!validateHeaders(headers))
      throw new Error("Invalid file structure");

    const normalizedRows = rows.map((row) => {
      const obj = {};
      for (const key of Object.keys(row)) {
        const mappedKey = mapHeader(key) || normalize(key);
        obj[mappedKey] = row[key];
      }
      return convertDateFields(obj);
    });

    const month = new Date().getMonth() + 1;
    const year = new Date().getFullYear();

    for (const row of normalizedRows) {
      const fixedData = {};
      const extraFields = {};

      if (row.customer_name && !row.cust_name) {
        row.cust_name = row.customer_name;
        delete row.customer_name;
      }

      for (const [key, value] of Object.entries(row)) {
        if (FIXED_COLUMNS[key]) fixedData[key] = value;
        else extraFields[key] = value;
      }

      // Pick least-recently-assigned agent
      const [[agent]] = await conn.query(
        `
        SELECT id, agent_id
        FROM campaign_agents
        WHERE campaign_id = ?
        ORDER BY
          last_assigned_at IS NOT NULL,
          last_assigned_at ASC,
          id ASC
        LIMIT 1
        `,
        [campaign_id]
      );

      // Insert coll_data
      await conn.query(
        `
        INSERT INTO coll_data (
          ${Object.keys(fixedData).join(", ")},
          campaign_id,
          agent_id,
          batch_month,
          batch_year,
          extra_fields,
          is_active
        ) VALUES (
          ${Object.keys(fixedData).map(() => "?").join(", ")},
          ?, ?, ?, ?, ?, 1
        )
        `,
        [
          ...Object.values(fixedData),
          campaign_id,
          agent.agent_id,
          month,
          year,
          Object.keys(extraFields).length
            ? JSON.stringify(extraFields)
            : null,
        ]
      );

      // Update round-robin pointer
      await conn.query(
        `UPDATE campaign_agents SET last_assigned_at = NOW() WHERE id = ?`,
        [agent.id]
      );
    }

    await conn.commit();
    conn.release();

    res.status(201).json({
      message: "Data ingested and assigned fairly to agents",
    });
  } catch (err) {
    if (conn) {
      await conn.rollback();
      conn.release();
    }
    console.error("Ingestion Error:", err);
    res.status(500).json({ message: err.message });
  }
};
