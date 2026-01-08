-- Migration: create agent_customer_visits
CREATE TABLE agent_customer_visits (
  id INT AUTO_INCREMENT PRIMARY KEY,
  agent_id INT NOT NULL,
  customer_id INT NOT NULL,
  entry_time DATETIME NOT NULL,
  exit_time DATETIME DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_agent_customer (agent_id, customer_id)
);
