// ================= REQUIRED EXCEL STRUCTURE =================
export const REQUIRED_COLUMNS = [
  "LOAN AGREEMENT NO",
  "BRANCH NAME",
  "CUSTOMER NAME",
  "MOBILE NUMBER",
  "POS",
  "INST AMT",
];

// ================= NORMALIZATION =================
export const normalize = (str) =>
  String(str ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

// ================= HEADER ALIASES =================
const HEADER_ALIASES = {
  loan_agreement_no: ["loan agreement no"],
  branch_name: ["branch name"],
  hub_name: ["hub name"],
  cust_name: ["customer name"],
  mobileno: ["mobile number", "mobile"],
  pos: ["pos"],
  insl_amt: ["inst amt", "inst_amt"],
  inst_over: ["inst over"],
  penal_over: ["penal over"],
  amount_finance: ["amt fin"],
  tenure: ["tenure"],
  loan_status: ["status"],
  res_addr: ["residence address"],
  off_addr: ["office address"],
  agency: ["agency"],
  feedback: ["feedback"],
  fdd: ["fdd"],
  bom_bucket: ["bom bucket"],
  group_name: ["group"],
  disb_date: ["disbursal date"],
  maturity_date: ["maturity date"],
  ptp_date: ["ptp date"],
};

// ================= HEADER MAPPING =================
export const mapHeader = (header) => {
  if (!header) return undefined;
  const h = normalize(header);

  for (const [dbField, variants] of Object.entries(HEADER_ALIASES)) {
    for (const v of variants) {
      if (normalize(v) === h) return dbField;
    }
  }
  return undefined;
};

// ================= HEADER VALIDATION =================
export const validateHeaders = (headers = []) => {
  const received = headers.map(normalize);
  const required = REQUIRED_COLUMNS.map(normalize);

  const missing = required.filter((r) => !received.includes(r));
  if (missing.length) {
    throw {
      message: "Invalid file structure",
      missing,
      received: headers
    };
  }
  return true;
};

// ================= DATE CONVERSION =================
const DATE_FIELDS = [
  "disb_date",
  "maturity_date",
  "expiry_date",
  "last_paid_date",
  "ptp_date",
  "dob",
  "max_txn_entry_date"
];

export const convertExcelDate = (value) => {
  if (!value) return null;

  // 1. Handle JS Date Objects (Fixed Crash Issue)
  // When xlsx reads with cellDates: true, it returns Date objects directly.
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null; // Invalid Date check
    return value.toISOString().slice(0, 10);
  }

  // 2. Handle Strings
  if (typeof value === "string") {
    const clean = value.trim().toUpperCase();

    // Known non-date business terms
    if (
      clean === "NA" ||
      clean === "N/A" ||
      clean === "PENDING" ||
      clean === "NEXT MONTH" ||
      clean === "CALL BACK"
    ) {
      return null;
    }

    // ISO date already (YYYY-MM-DD)
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
      return clean;
    }

    // DD-MM-YYYY or DD/MM/YYYY handling (Optional, but safe to add)
    // if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(clean)) {
    //   const [d, m, y] = clean.split(/[-/]/);
    //   return `${y}-${m}-${d}`;
    // }

    return null;
  }

  // 3. Handle Excel Serial Numbers
  const num = Number(value);
  if (!isNaN(num) && num > 0) {
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + num * 86400000);
    
    // Safety check: Ensure the calculated date is valid before converting
    if (isNaN(date.getTime())) return null;
    
    return date.toISOString().slice(0, 10);
  }

  return null;
};

export const convertDateFields = (row) => {
  const converted = { ...row };

  for (const field of DATE_FIELDS) {
    if (field in converted) {
      const convertedDate = convertExcelDate(converted[field]);
      converted[field] = convertedDate;
    }
  }

  return converted;
};

export default {
  REQUIRED_COLUMNS,
  normalize,
  mapHeader,
  validateHeaders,
  convertExcelDate,
  convertDateFields
};