import pool from '../config/mysql.js';
import CollData from '../models/collDataModel.js';

/**
 * Fetch loans assigned to logged-in agent
 */
export const getAgentLoans = async (req, res) => {
  try {
    const agentId = req.user.id; // from JWT

    const loans = await CollData.findByAgentId(pool, agentId);

    return res.status(200).json({
      success: true,
      count: loans.length,
      data: loans,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
