CREATE TABLE Coll_Data (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,

  branch_name VARCHAR(100),
  appl_id VARCHAR(50),
  child_loan1 VARCHAR(50),
  child_loan2 VARCHAR(50),

  insl_amt DECIMAL(12,2),
  amt_outst DECIMAL(12,2),
  tos DECIMAL(12,2),
  pos DECIMAL(12,2),

  last_paid_amount DECIMAL(12,2),
  last_paid_date DATE,

  emi_pending_count INT,
  sif_allowed VARCHAR(10),
  dpd INT,

  penal_intrst DECIMAL(12,2),
  chq_bnc_chrg DECIMAL(12,2),

  cust_id VARCHAR(50),
  cust_name VARCHAR(150),

  amount_finance DECIMAL(12,2),

  res_addr TEXT,
  ph_no_res VARCHAR(20),

  fresh_vintage_regular VARCHAR(50),
  month_diff_exp_dt INT,
  expiry_date DATE,

  mobileno VARCHAR(20),
  contact_no1 VARCHAR(20),

  current_org VARCHAR(150),
  dob DATE,

  off_addr TEXT,

  product_id VARCHAR(50),
  asset_desc VARCHAR(150),
  reason_bounc_chek VARCHAR(150),
  bank_name VARCHAR(100),
  disb_dlr_name VARCHAR(150),
  asset_category VARCHAR(100),
  state VARCHAR(50),

  max_txn_entry_date DATE,
  days_diff_max_txn_dt INT,

  -- SYSTEM FIELDS
  agent_id VARCHAR(24), -- Mongo ObjectId
  batch_month INT NOT NULL,
  batch_year INT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE coll_excel_raw (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,

  coll_data_id BIGINT NULL,   -- optional link to Coll_Data
  campaign_id BIGINT NULL,
  agent_id BIGINT NULL,

  excel_headers JSON NOT NULL,
  excel_row JSON NOT NULL,

  batch_month INT NOT NULL,
  batch_year INT NOT NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_campaign (campaign_id),
  INDEX idx_agent (agent_id),
  INDEX idx_batch (batch_month, batch_year)
);
