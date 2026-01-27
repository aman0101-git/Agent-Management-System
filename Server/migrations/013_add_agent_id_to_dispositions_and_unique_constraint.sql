-- Add agent_id to agent_dispositions and add UNIQUE constraint on agent_case_id
ALTER TABLE agent_dispositions
  ADD COLUMN agent_id BIGINT AFTER id;

-- Add foreign key for agent_id
ALTER TABLE agent_dispositions
  ADD FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE RESTRICT;

-- Add UNIQUE constraint to enforce only one disposition per case
ALTER TABLE agent_dispositions
  ADD UNIQUE KEY unique_agent_case_id (agent_case_id);

-- Create index on agent_id for faster queries
CREATE INDEX idx_agent_id ON agent_dispositions(agent_id);

-- Create index on agent_id and created_at for analytics queries
CREATE INDEX idx_agent_id_created_at ON agent_dispositions(agent_id, created_at);
