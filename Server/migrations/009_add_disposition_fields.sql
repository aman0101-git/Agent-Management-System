-- Add promise_amount and follow_up columns to agent_dispositions
ALTER TABLE agent_dispositions
  ADD COLUMN promise_amount DECIMAL(12, 2) NULL AFTER remarks;

ALTER TABLE agent_dispositions
  ADD COLUMN follow_up_date DATE NULL AFTER promise_amount;

ALTER TABLE agent_dispositions
  ADD COLUMN follow_up_time TIME NULL AFTER follow_up_date;

-- Add is_active column to agent_cases if not exists
ALTER TABLE agent_cases
  ADD COLUMN is_active BOOLEAN DEFAULT 1 AFTER follow_up_time;

-- Add indexes for better query performance
CREATE INDEX idx_agent_id_created_at ON agent_dispositions(agent_id, created_at);
CREATE INDEX idx_agent_case_id_created_at ON agent_dispositions(agent_case_id, created_at);
CREATE INDEX idx_disposition_created_at ON agent_dispositions(disposition, created_at);

-- Verify the schema
DESCRIBE agent_dispositions;
