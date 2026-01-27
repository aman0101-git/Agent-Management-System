-- Create agent_dispositions_edit_history table to track edit history
CREATE TABLE IF NOT EXISTS agent_dispositions_edit_history (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  agent_case_id BIGINT NOT NULL,
  disposition VARCHAR(10) NOT NULL,
  remarks TEXT,
  promise_amount DECIMAL(15, 2) NULL,
  follow_up_date DATE NULL,
  follow_up_time TIME NULL,
  edited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (agent_case_id) REFERENCES agent_cases(id) ON DELETE CASCADE,
  
  INDEX idx_case_id (agent_case_id),
  INDEX idx_edited_at (edited_at)
);
