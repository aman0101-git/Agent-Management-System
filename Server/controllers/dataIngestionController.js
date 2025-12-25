import pool from "../config/mysql.js";
import xlsx from "xlsx";
import {
  validateHeaders,
  normalize,
  REQUIRED_COLUMNS,
  mapHeader,
  convertDateFields,
} from "../utils/validateDataFile.js";

// Fixed database column mappings
const FIXED_COLUMNS = {
  // Existing columns
  branch_name: true,
  appl_id: true,
  child_loan1: true,
  child_loan2: true,
  insl_amt: true,
  inst_over: true,           // NEW
  amt_outst: true,
  tos: true,
  pos: true,
  bom_bucket: true,          // NEW
  last_paid_amount: true,
  last_paid_date: true,
  emi_pending_count: true,
  sif_allowed: true,
  dpd: true,
  penal_intrst: true,
  penal_over: true,          // NEW
  chq_bnc_chrg: true,
  cust_id: true,
  cust_name: true,
  amount_finance: true,
  group_name: true,          // NEW
  tenure: true,              // NEW
  loan_status: true,         // NEW
  res_addr: true,
  ph_no_res: true,
  fresh_vintage_regular: true,
  month_diff_exp_dt: true,
  expiry_date: true,
  disb_date: true,           // NEW
  maturity_date: true,       // NEW
  fdd: true,                 // NEW
  mobileno: true,
  contact_no1: true,
  current_org: true,
  dob: true,
  off_addr: true,
  product_id: true,
  product_code: true,        // NEW
  asset_desc: true,
  reason_bounc_chek: true,
  bank_name: true,
  disb_dlr_name: true,
  asset_category: true,
  agency: true,              // NEW
  state: true,
  max_txn_entry_date: true,
  days_diff_max_txn_dt: true,
  feedback: true,            // NEW
  ptp_date: true,            // NEW
  loan_agreement_no: true,   // NEW
};

export const ingestLoans = async (req, res) => {
  let conn;
  try {
    const { campaign_id } = req.body;
    if (!campaign_id)
      return res.status(400).json({ message: "Campaign is required" });

    if (!req.file)
      return res.status(400).json({ message: "File not provided or unreadable" });

    // Validate campaign
    const [campaign] = await pool.query(
      "SELECT id FROM campaigns WHERE id = ? AND is_active = true",
      [campaign_id]
    );

    if (!campaign.length)
      return res.status(400).json({ message: "Invalid or inactive campaign" });

    // Read Excel
    const workbook = xlsx.read(req.file.buffer);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet);

    if (!rows.length)
      return res.status(400).json({ message: "Empty file" });

    const headers = Object.keys(rows[0]);
    if (!validateHeaders(headers)) {
      return res.status(400).json({
        message: "Invalid file structure",
        required: REQUIRED_COLUMNS,
        received: headers,
      });
    }

    // Normalize rows and map header variants to canonical DB fields
    const normalizedRows = rows.map((row) => {
      const obj = {};
      for (const key of Object.keys(row)) {
        const mappedKey = mapHeader(key) || normalize(key);
        obj[mappedKey] = row[key];
      }
      // Convert Excel dates to MySQL format
      return convertDateFields(obj);
    });

    conn = await pool.getConnection();
    await conn.beginTransaction();

    const month = new Date().getMonth() + 1;
    const year = new Date().getFullYear();

    for (const [idx, row] of normalizedRows.entries()) {
      // Separate fixed and dynamic columns
      const fixedData = {};
      const extraFields = {};

      // Handle column name variations (e.g., customer_name vs cust_name)
      if (row.customer_name && !row.cust_name) {
        row.cust_name = row.customer_name;
        delete row.customer_name;
      }

      for (const [key, value] of Object.entries(row)) {
        // If date field became NULL due to invalid text, preserve original value
        if (
          ["ptp_date", "disb_date", "maturity_date"].includes(key) &&
          value === null &&
          row[key] !== null
        ) {
          extraFields[`${key}_raw`] = row[key];
        }

        if (FIXED_COLUMNS[key]) {
          fixedData[key] = value;
        } else {
          extraFields[key] = value;
        }
      }

      // Build insert query dynamically
      const fixedKeys = Object.keys(fixedData);
      const fixedValues = Object.values(fixedData);
      const placeholders = fixedKeys.map(() => "?").join(", ");

      const query = `
        INSERT INTO coll_data (
          ${fixedKeys.join(", ")},
          campaign_id,
          batch_month,
          batch_year,
          extra_fields,
          is_active
        ) VALUES (${placeholders}, ?, ?, ?, ?, true)
      `;

      const params = [
        ...fixedValues,
        campaign_id,
        month,
        year,
        Object.keys(extraFields).length > 0 ? JSON.stringify(extraFields) : null,
      ];

      try {
        await conn.query(query, params);
      } catch (rowErr) {
        console.error(`Insert error at row ${idx}:`, rowErr, { row, query });
        throw new Error(`Failed inserting row ${idx + 1}: ${rowErr.message}`);
      }
    }

    await conn.commit();
    conn.release();

    res.status(201).json({ message: "Data ingested successfully" });

  } catch (err) {
    console.error("Ingestion Error:", err);
    try {
      if (conn) {
        await conn.rollback();
        conn.release();
      }
    } catch (rbErr) {
      console.error("Rollback error:", rbErr);
    }
    res.status(500).json({ message: err.message || "Ingestion failed" });
  }
};
