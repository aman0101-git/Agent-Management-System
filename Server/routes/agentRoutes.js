// routes/agentRoutes.js

import express from 'express';
import { protect, allowRoles } from '../middlewares/authMiddleware.js';
import { getAgentLoans } from '../controllers/agentController.js';

const router = express.Router();

// Agent-only loans fetch
router.get(
  '/loans',
  protect,
  allowRoles('AGENT'),
  getAgentLoans
);

export default router;
