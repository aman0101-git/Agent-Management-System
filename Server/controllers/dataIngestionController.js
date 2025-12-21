import pool from "../config/mysql.js";
import xlsx from "xlsx";
import { validateHeaders, normalize } from "../utils/validateDataFile.js";

export const ingestLoans = async (req, res) => {
  try {
    const { campaign_id } = req.body;
    if (!campaign_id)
      return res.status(400).json({ message: "Campaign is required" });

    if (!req.file)
      return res.status(400).json({ message: "File not provided" });

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
      return res.status(400).json({ message: "Invalid file structure" });
    }

    // Normalize rows
    const normalizedRows = rows.map((row) => {
      const obj = {};
      for (const key of Object.keys(row)) {
        obj[normalize(key)] = row[key];
      }
      return obj;
    });

    const conn = await pool.getConnection();
    await conn.beginTransaction();

    const month = new Date().getMonth() + 1;
    const year = new Date().getFullYear();

    for (const row of normalizedRows) {
      await conn.query(
        `INSERT INTO coll_data
         (branch_name, appl_id, cust_id, cust_name, mobileno, dpd,
          campaign_id, batch_month, batch_year, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, true)`,
        [
          row.branch_name,
          row.appl_id,
          row.cust_id,
          row.cust_name,
          row.mobileno,
          row.dpd,
          campaign_id,
          month,
          year,
        ]
      );
    }

    await conn.commit();
    conn.release();

    res.status(201).json({ message: "Data ingested successfully" });

  } catch (err) {
    console.error("Ingestion Error:", err);
    res.status(500).json({ message: err.message });
  }
};
