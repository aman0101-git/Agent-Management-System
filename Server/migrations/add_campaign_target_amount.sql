-- Add target_amount column to campaigns table
ALTER TABLE campaigns 
ADD COLUMN target_amount DECIMAL(12,2) DEFAULT NULL COMMENT 'Monthly collection target for this campaign';

-- Add index for faster queries
ALTER TABLE campaigns 
ADD INDEX idx_target_amount (target_amount);
