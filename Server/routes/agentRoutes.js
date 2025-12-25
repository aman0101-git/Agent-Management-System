// routes/agentRoutes.js

import express from 'express';
import { protect, allowRoles } from '../middlewares/authMiddleware.js';
import { getAgentLoans, getCustomerDetails } from '../controllers/agentController.js';

const router = express.Router();

// Agent-only loans fetch
router.get(
  '/loans',
  protect,
  allowRoles('AGENT'),
  getAgentLoans
);

// Get customer details by ID
router.get(
  '/customer/:customerId',
  protect,
  allowRoles('AGENT'),
  getCustomerDetails
);

export default router;
