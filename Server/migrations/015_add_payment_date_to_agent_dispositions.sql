-- Add payment_date column for PIF, SIF, FCL, PRT dispositions
ALTER TABLE agent_dispositions
  ADD COLUMN payment_date DATE NULL AFTER follow_up_time;
