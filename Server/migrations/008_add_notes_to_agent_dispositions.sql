-- Add notes column to agent_dispositions
ALTER TABLE agent_dispositions
  ADD COLUMN notes TEXT NULL AFTER remarks;
