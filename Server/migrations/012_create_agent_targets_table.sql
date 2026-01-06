-- Create agent_targets table for monthly targets per agent
CREATE TABLE IF NOT EXISTS agent_targets (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  agent_id BIGINT NOT NULL,
  month VARCHAR(7) NOT NULL,
  target_amount DECIMAL(15, 2) NOT NULL,
  created_by BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  
  UNIQUE KEY unique_agent_month (agent_id, month),
  INDEX idx_agent_id (agent_id),
  INDEX idx_month (month),
  INDEX idx_created_at (created_at)
);
