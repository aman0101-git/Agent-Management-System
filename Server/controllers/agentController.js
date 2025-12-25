import pool from '../config/mysql.js';
import CollData from '../models/collDataModel.js';

/**
 * Fetch loans assigned to logged-in agent
 */
export const getAgentLoans = async (req, res) => {
  try {
    const agentId = req.user.id; // from JWT

    const loans = await CollData.findByAgentId(pool, agentId);

    // Parse extra_fields JSON for each loan
    const processedLoans = loans.map(loan => {
      if (loan.extra_fields) {
        try {
          loan.extra_fields = typeof loan.extra_fields === 'string' 
            ? JSON.parse(loan.extra_fields) 
            : loan.extra_fields;
        } catch (e) {
          loan.extra_fields = {};
        }
      }
      return loan;
    });

    return res.status(200).json({
      success: true,
      count: processedLoans.length,
      data: processedLoans,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

/**
 * Fetch customer details by ID
 */
export const getCustomerDetails = async (req, res) => {
  try {
    const agentId = req.user.id;
    const { customerId } = req.params;

    const customer = await CollData.findByIdWithAccess(pool, customerId, agentId);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found or access denied",
      });
    }

    // Parse extra_fields if it exists
    if (customer.extra_fields) {
      try {
        customer.extra_fields = typeof customer.extra_fields === 'string'
          ? JSON.parse(customer.extra_fields)
          : customer.extra_fields;
      } catch (e) {
        customer.extra_fields = {};
      }
    }

    return res.status(200).json({
      success: true,
      data: customer,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
