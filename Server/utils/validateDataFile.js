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
// UPDATED: Expanded massively to catch variations of Excel headers
const HEADER_ALIASES = {
  loan_agreement_no: ["loan agreement no", "loan id", "agreement no", "lan", "account no"],
  branch_name: ["branch name", "branch"],
  hub_name: ["hub name", "hub"],
  cust_name: ["customer name", "cust name", "name", "borrower name"],
  cust_id: ["customer id", "customer_id", "cust id"],
  mobileno: ["mobile number", "mobile", "phone", "contact no"],
  pos: ["pos", "principal outstanding", "principal"],
  insl_amt: ["inst amt", "inst_amt", "installment amount", "emi", "emi amount"],
  inst_over: ["inst over", "installment overdue", "emi overdue"],
  penal_over: ["penal over", "penalty overdue", "penalty over"],
  penal_intrst: ["penal interest", "penal int", "penalty interest"],
  amount_finance: ["amt fin", "amount finance", "financed amount", "loan amount"],
  tenure: ["tenure", "loan tenure"],
  loan_status: ["status", "loan status"],
  res_addr: ["residence address", "res addr", "address"],
  off_addr: ["office address", "off addr"],
  agency: ["agency", "collection agency"],
  feedback: ["feedback", "remarks"],
  fdd: ["fdd", "first due date"],
  bom_bucket: ["bom bucket", "bucket", "bom"],
  group_name: ["group", "group name"],
  disb_date: ["disbursal date", "disb date"],
  maturity_date: ["maturity date"],
  ptp_date: ["ptp date"],
  dpd: ["dpd", "days past due"],
  product_code: ["product", "product code"],
  amt_outst: ["amount outstanding", "amt outst", "total outstanding", "os"],
  tos: ["tos", "total over due", "total overdue"],
  fresh_vintage_regular: ["fresh vintage regular", "fresh_vintage_regular"],
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
// UPDATED: Now maps Excel headers to DB headers BEFORE validating.
// This prevents crashes if an Excel sheet uses a valid alias instead of the exact required name.
export const validateHeaders = (headers = []) => {
  const mappedReceived = headers.map(h => mapHeader(h) || normalize(h));
  const mappedRequired = REQUIRED_COLUMNS.map(h => mapHeader(h) || normalize(h));

  const missing = mappedRequired.filter((r) => !mappedReceived.includes(r));
  if (missing.length) {
    throw {
      message: "Invalid file structure. Required columns missing.",
      missing,
      received: headers
    };
  }
  return true;
};

// ================= DATE CONVERSION =================
// UPDATED: Added 'fdd' so First Due Date parses properly if formatted as a Date cell in Excel.
const DATE_FIELDS = [
  "disb_date",
  "maturity_date",
  "expiry_date",
  "last_paid_date",
  "ptp_date",
  "dob",
  "max_txn_entry_date",
  "fdd"
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