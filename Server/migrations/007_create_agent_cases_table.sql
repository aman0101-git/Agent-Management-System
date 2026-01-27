-- Create agent_cases table for agent dashboard
CREATE TABLE IF NOT EXISTS agent_cases (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  agent_id BIGINT NOT NULL,
  campaign_id BIGINT NOT NULL,
  coll_data_id BIGINT,
  allocation_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  customer_name VARCHAR(255),
  phone VARCHAR(20),
  loan_id VARCHAR(100),
  status ENUM('IN_PROGRESS','FOLLOW_UP','NEW', 'DONE') DEFAULT 'NEW',
  first_call_at DATETIME,
  last_call_at DATETIME,
  follow_up_date DATE,
  follow_up_time TIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  FOREIGN KEY (coll_data_id) REFERENCES Coll_Data(id) ON DELETE CASCADE,
  
  INDEX idx_agent_id (agent_id),
  INDEX idx_campaign_id (campaign_id),
  INDEX idx_status (status),
  INDEX idx_follow_up_date (follow_up_date),
  INDEX idx_allocation_date (allocation_date)
);

-- Create agent_dispositions table for tracking agent actions
CREATE TABLE IF NOT EXISTS agent_dispositions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  agent_case_id BIGINT NOT NULL,
  disposition VARCHAR(10) NOT NULL,
  remarks TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (agent_case_id) REFERENCES agent_cases(id) ON DELETE CASCADE,
  
  INDEX idx_case_id (agent_case_id),
  INDEX idx_disposition (disposition),
  INDEX idx_created_at (created_at)
);
