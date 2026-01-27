-- Add campaign_id and extra_fields to Coll_Data table
ALTER TABLE Coll_Data 
ADD COLUMN campaign_id BIGINT AFTER id,
ADD COLUMN extra_fields JSON DEFAULT NULL AFTER created_at,
ADD INDEX idx_campaign (campaign_id),
ADD CONSTRAINT fk_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL;
