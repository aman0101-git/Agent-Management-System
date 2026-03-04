import pool from "../config/mysql.js";
import xlsx from "xlsx";
import {
  validateHeaders,
  normalize,
  mapHeader,
  convertDateFields,
} from "../utils/validateDataFile.js";

// EXACT COLUMN LIST based on your 'coll_data' Table Schema
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

    // 1. Get Connection & Start Transaction
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // 2. Verify Campaign
    const [[campaign]] = await conn.query(
      "SELECT id FROM campaigns WHERE id = ? AND status = 'ACTIVE'",
      [campaign_id]
    );
    if (!campaign) throw new Error("Invalid or inactive campaign");

    // 3. Read Excel
    const workbook = xlsx.read(req.file.buffer, { type: "buffer", cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawRows = xlsx.utils.sheet_to_json(sheet);

    if (!rawRows.length) throw new Error("Excel file is empty");

    // 4. Validate Headers
    const headers = Object.keys(rawRows[0]);
    validateHeaders(headers);

    // 5. Prepare Batch Data
    // FIX 1: Reduced Batch Size to prevent Packet Too Large / Timeouts
    const BATCH_SIZE = 500; 
    
    const month = new Date().getMonth() + 1;
    const year = new Date().getFullYear();
    const chunkedValues = [];

    // FIX 2: Convert Set to Array once to guarantee Order of Insertion matches Order of Values
    const schemaColsArray = Array.from(DB_SCHEMA_COLUMNS);

    // Columns for INSERT
    const INSERT_COLS = [
      "campaign_id", "batch_month", "batch_year", "is_active", "extra_fields", 
      ...schemaColsArray
    ];

    for (const row of rawRows) {
      const dbRecord = {};
      const extraFields = {};

      if (row.customer_name && !row.cust_name) row.cust_name = row.customer_name;

      for (const [key, value] of Object.entries(row)) {
        const normalizedKey = normalize(key);
        if (!normalizedKey) continue;

        let dbColumn = mapHeader(key);
        
        // If mapHeader returns null, check if the normalized key exists in schema directly
        if (!dbColumn && DB_SCHEMA_COLUMNS.has(normalizedKey)) {
          dbColumn = normalizedKey;
        }

        if (dbColumn && DB_SCHEMA_COLUMNS.has(dbColumn)) {
          dbRecord[dbColumn] = value;
        } else {
          extraFields[key] = value;
        }
      }

      const cleanRecord = convertDateFields(dbRecord);

      // Skip if no Loan ID (Essential for uniqueness)
      if (!cleanRecord.loan_agreement_no) continue;

      const rowArray = [
        campaign_id,
        month,
        year,
        1, // is_active
        JSON.stringify(extraFields)
      ];

      // Use the Array here to ensure order matches INSERT_COLS exactly
      for (const col of schemaColsArray) {
        rowArray.push(cleanRecord[col] !== undefined ? cleanRecord[col] : null);
      }

      chunkedValues.push(rowArray);
    }

    // 6. SMART BULK UPSERT
    // Create ON DUPLICATE KEY UPDATE clause
    // We use the same schemaColsArray to ensure we update the correct columns
    const updateClauses = schemaColsArray
      .map(col => `${col} = VALUES(${col})`)
      .join(", ");

    const fullUpdateClause = `
      batch_month = VALUES(batch_month),
      batch_year = VALUES(batch_year),
      extra_fields = VALUES(extra_fields),
      ${updateClauses}
    `;

    // 7. Execute in Batches
    let totalProcessed = 0;
    
    // Pre-construct SQL to avoid rebuilding string in loop
    const sql = `
      INSERT INTO coll_data 
      (${INSERT_COLS.join(", ")}) 
      VALUES ?
      ON DUPLICATE KEY UPDATE
      ${fullUpdateClause}
    `;

    for (let i = 0; i < chunkedValues.length; i += BATCH_SIZE) {
      const batch = chunkedValues.slice(i, i + BATCH_SIZE);
      await conn.query(sql, [batch]);
      totalProcessed += batch.length;
    }

    await conn.commit();
    
    res.status(201).json({
      success: true,
      message: `Processed ${totalProcessed} loans. Duplicates updated, new loans inserted.`,
      rowsUploaded: totalProcessed,
    });

  } catch (err) {
    // FIX 3: Robust Error Logging & Safe Rollback
    // Log the actual error causing the failure
    console.error("CRITICAL INGESTION ERROR:", err);

    if (conn) {
      try {
        await conn.rollback();
      } catch (rollbackErr) {
        // This catches the 'ECONNRESET' if the connection is already dead
        console.error("Rollback failed (Connection likely dead):", rollbackErr.message);
      }
    }
    
    // Return the original error message to the client
    res.status(500).json({ 
      message: err.message || "Internal Server Error",
      details: err.code || "Unknown SQL Error"
    });
  } finally {
    if (conn) {
      try {
        conn.release();
      } catch (releaseErr) {
        console.error("Connection release failed:", releaseErr.message);
      }
    }
  }
};