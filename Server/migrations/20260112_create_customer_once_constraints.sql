-- Create customer_once_constraints table
CREATE TABLE IF NOT EXISTS customer_once_constraints (
    id INT AUTO_INCREMENT PRIMARY KEY,
    coll_data_id INT NOT NULL,
    constraint_type ENUM('ONCE_PTP','ONCE_PRT') NOT NULL,
    triggered_disposition_id INT NOT NULL,
    triggered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE KEY unique_constraint (coll_data_id, constraint_type),
    FOREIGN KEY (coll_data_id) REFERENCES Coll_Data(id),
    FOREIGN KEY (triggered_disposition_id) REFERENCES agent_dispositions(id)
);