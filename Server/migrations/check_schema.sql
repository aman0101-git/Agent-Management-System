-- Check current Coll_Data table structure
DESCRIBE Coll_Data;

-- Check if campaign_id and extra_fields columns exist
SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME='Coll_Data' AND COLUMN_NAME IN ('campaign_id', 'extra_fields');

-- Check sample data
SELECT id, cust_name, mobileno, appl_id, campaign_id, extra_fields 
FROM Coll_Data 
LIMIT 5;
