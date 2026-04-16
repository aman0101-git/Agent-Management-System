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
  loan_agreement_no: ["loan agreement no", "loan id", "agreement no", "lan", "account no"],
  branch_name: ["branch name", "branch"],
  appl_id: ["appl id", "application id"],
  child_loan1: ["child loan1", "child loan 1"],
  child_loan2: ["child loan2", "child loan 2"],
  hub_name: ["hub name", "hub"],
  cust_id: ["customer id", "customer_id", "cust id"],
  cust_name: ["customer name", "cust name", "name", "borrower name"],
  mobileno: ["mobile number", "mobile", "phone", "contact no"],
  
  // Mapped "MO NO" from your Excel to contact_no1
  contact_no1: ["contact no1", "contact no 1", "alt contact", "mo no"], 
  
  ph_no_res: ["ph no res", "res phone", "residence phone"],
  pos: ["pos", "principal outstanding", "principal"],
  insl_amt: ["inst amt", "inst_amt", "installment amount", "emi", "emi amount"],
  inst_over: ["inst over", "installment overdue", "emi overdue"],
  penal_over: ["penal over", "penalty overdue", "penalty over"],
  penal_intrst: ["penal interest", "penal int", "penalty interest"],
  chq_bnc_chrg: ["chq bnc chrg", "cheque bounce charge", "bounce charge"],
  amount_finance: ["amt fin", "amount finance", "financed amount", "loan amount"],
  tenure: ["tenure", "loan tenure"],
  loan_status: ["status", "loan status"],
  res_addr: ["residence address", "res addr", "address"],
  off_addr: ["office address", "off addr"],
  
  // Mapped "AGENCY NAME" from your Excel to agency
  agency: ["agency", "collection agency", "agency name"],
  
  feedback: ["feedback", "remarks"],
  fdd: ["fdd", "first due date"],
  bom_bucket: ["bom bucket", "bucket", "bom", "bom_bucket"],
  
  // Mapped "Sub Group" from your Excel to group_name
  group_name: ["group", "group name", "sub group"],
  
  disb_date: ["disbursal date", "disb date"],
  
  // Mapped "MATURITY DT" from your Excel to maturity_date
  maturity_date: ["maturity date", "maturity dt"],
  
  expiry_date: ["expiry date", "exp date"],
  dob: ["dob", "date of birth"],
  ptp_date: ["ptp date"],
  dpd: ["dpd", "days past due"],
  product_code: ["product", "product code"],
  product_id: ["product id"],
  amt_outst: ["amount outstanding", "amt outst", "total outstanding", "os"],
  tos: ["tos", "total over due", "total overdue"],
  
  // Mapped "Fresh_Stab" from your Excel to fresh_vintage_regular
  fresh_vintage_regular: ["fresh vintage regular", "fresh_vintage_regular", "vintage", "fresh/regular", "fresh vintage", "fresh_stab", "fresh stab"],
  
  state: ["state", "customer state", "state name"],
  bank_name: ["bank name", "bank"],
  reason_bounc_chek: ["reason bounce cheque", "reason_bounc_chek", "bounce reason"],
  asset_category: ["asset category", "asset_category"],
  asset_desc: ["asset desc", "asset description"],
  disb_dlr_name: ["disb dlr name", "disbursal dealer", "dealer name"],
  max_txn_entry_date: ["max txn entry date", "max_txn_entry_date"],
  days_diff_max_txn_dt: ["days diff max txn dt", "days_diff_max_txn_dt"],
  month_diff_exp_dt: ["month diff exp dt", "month_diff_exp_dt"],
  last_paid_amount: ["last paid amount", "last_paid_amount"],
  last_paid_date: ["last paid date", "last_paid_date"],
  emi_pending_count: ["emi pending count", "emi_pending_count"],
  sif_allowed: ["sif allowed", "sif_allowed"],
  current_org: ["current org", "current_org", "organization"]
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