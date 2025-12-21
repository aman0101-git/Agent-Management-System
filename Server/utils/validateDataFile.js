export const REQUIRED_COLUMNS = [
  "BRANCH_NAME","APPL_ID","INSL_AMT","AMT_OUTST","POS",
  "CUST_ID","CUST_NAME","MOBILENO","DPD"
];

export const normalize = (str) =>
  str.toLowerCase().replace(/\s+/g, "_").trim();

export const validateHeaders = (headers) => {
  const normalizedHeaders = headers.map(normalize);
  const requiredNormalized = REQUIRED_COLUMNS.map(normalize);

  // every required column must exist in the normalized headers
  return requiredNormalized.every(col => normalizedHeaders.includes(col));
};
