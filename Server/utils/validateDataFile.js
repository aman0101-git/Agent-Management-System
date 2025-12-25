// ================= REQUIRED EXCEL STRUCTURE =================
export const REQUIRED_COLUMNS = [
  "BRANCH NAME",
  "CUSTOMER NAME",
  "MOBILE NUMBER",
  "POS",
  "INST AMT",
  "STATUS"
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
  cust_name: ["customer name", "name"],
  mobileno: ["mobile number", "mobile"],
  pos: ["pos"],
  insl_amt: ["inst amt"],
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

  // Reject non-date text explicitly
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

    // ISO date already
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
      return clean;
    }

    // Any other string → reject
    return null;
  }

  // Excel serial number
  const num = Number(value);
  if (!isNaN(num) && num > 0) {
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + num * 86400000);
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
