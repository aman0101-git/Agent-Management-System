import pool from "../config/mysql.js";
import xlsx from "xlsx";
import {
  validateHeaders,
  normalize,
  mapHeader,
  convertDateFields,
} from "../utils/validateDataFile.js";

// EXACT COLUMN LIST based on your 'coll_data' Table Schema
// We only map Excel data to these columns. Everything else goes to 'extra_fields'.
const DB_SCHEMA_COLUMNS = new Set([
  "loan_agreement_no", "branch_name", "appl_id", "child_loan1", "child_loan2",
  "insl_amt", "inst_over", "amt_outst", "tos", "pos", "bom_bucket",
  "last_paid_amount", "last_paid_date", "emi_pending_count", "sif_allowed",
  "dpd", "penal_intrst", "penal_over", "chq_bnc_chrg", "cust_id", "cust_name",
  "amount_finance", "tenure", "loan_status", "group_name", "res_addr",
  "ph_no_res", "fresh_vintage_regular", "month_diff_exp_dt", "expiry_date",
  "disb_date", "maturity_date", "fdd", "mobileno", "contact_no1",
  "current_org", "dob", "off_addr", "product_id", "asset_desc", "product_code",
  "reason_bounc_chek", "bank_name", "disb_dlr_name", "asset_category",
  "agency", "state", "max_txn_entry_date", "days_diff_max_txn_dt",
  "hub_name", "feedback", "ptp_date"
]);

export const ingestLoans = async (req, res) => {
  let conn;
  try {
    const { campaign_id } = req.body;

    if (!campaign_id) return res.status(400).json({ message: "Campaign ID is required" });
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    conn = await pool.getConnection();
    await conn.beginTransaction();

    // 1. Verify Campaign
    const [[campaign]] = await conn.query(
      "SELECT id FROM campaigns WHERE id = ? AND status = 'ACTIVE'",
      [campaign_id]
    );
    if (!campaign) throw new Error("Invalid or inactive campaign");

    // 2. Read Excel (With cellDates: true for accuracy)
    const workbook = xlsx.read(req.file.buffer, { type: "buffer", cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawRows = xlsx.utils.sheet_to_json(sheet);

    if (!rawRows.length) throw new Error("Excel file is empty");

    // 3. Validate Headers
    const headers = Object.keys(rawRows[0]);
    validateHeaders(headers);

    // 4. Prepare Batch Data
    const BATCH_SIZE = 1000;
    const month = new Date().getMonth() + 1;
    const year = new Date().getFullYear();
    const chunkedValues = [];

    // The order of columns for the BULK INSERT SQL
    const INSERT_COLS_ORDER = [
      "campaign_id", "batch_month", "batch_year", "is_active", "extra_fields", 
      ...Array.from(DB_SCHEMA_COLUMNS)
    ];

    for (const row of rawRows) {
      const dbRecord = {};
      const extraFields = {};

      // Handle 'customer_name' alias manually if not handled in mapHeader
      if (row.customer_name && !row.cust_name) {
        row.cust_name = row.customer_name;
      }

      for (const [key, value] of Object.entries(row)) {
        const normalizedKey = normalize(key);
        if (!normalizedKey) continue;

        // Try to map header using utility or check direct schema match
        let dbColumn = mapHeader(key);
        if (!dbColumn && DB_SCHEMA_COLUMNS.has(normalizedKey)) {
          dbColumn = normalizedKey;
        }

        if (dbColumn && DB_SCHEMA_COLUMNS.has(dbColumn)) {
          dbRecord[dbColumn] = value;
        } else {
          extraFields[key] = value;
        }
      }

      // Fix Dates safely using the updated utility
      const cleanRecord = convertDateFields(dbRecord);

      // Construct the ordered array for this row
      const rowArray = [
        campaign_id,
        month,
        year,
        1, // is_active
        JSON.stringify(extraFields)
      ];

      // Add the dynamic schema columns in strict order
      for (const col of DB_SCHEMA_COLUMNS) {
        rowArray.push(cleanRecord[col] !== undefined ? cleanRecord[col] : null);
      }

      chunkedValues.push(rowArray);
    }

    // 5. Execute Bulk Insert
    let totalInserted = 0;
    for (let i = 0; i < chunkedValues.length; i += BATCH_SIZE) {
      const batch = chunkedValues.slice(i, i + BATCH_SIZE);
      
      const sql = `
        INSERT INTO coll_data 
        (${INSERT_COLS_ORDER.join(", ")}) 
        VALUES ?
      `;

      await conn.query(sql, [batch]);
      totalInserted += batch.length;
    }

    await conn.commit();
    
    res.status(201).json({
      success: true,
      message: `${totalInserted} loans uploaded successfully.`,
      rowsUploaded: totalInserted,
    });

  } catch (err) {
    if (conn) await conn.rollback();
    console.error("Ingestion Error:", err);
    res.status(500).json({ message: err.message || "Internal Server Error" });
  } finally {
    if (conn) conn.release();
  }
};