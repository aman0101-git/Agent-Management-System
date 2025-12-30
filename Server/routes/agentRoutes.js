// routes/agentRoutes.js

import express from 'express';
import { protect, allowRoles } from '../middlewares/authMiddleware.js';
import {
  getAgentCases,
  getAgentCaseById,
  submitDisposition,
} from '../controllers/agentController.js';

const router = express.Router();

/**
 * Fetch agent dashboard list
 */
router.get(
  '/cases',
  protect,
  allowRoles('AGENT'),
  getAgentCases
);

/**
 * Fetch single case + disposition history
 */
router.get(
  '/cases/:caseId',
  protect,
  allowRoles('AGENT'),
  getAgentCaseById
);

/**
 * Submit disposition for a case
 */
router.post(
  '/cases/:caseId/disposition',
  protect,
  allowRoles('AGENT'),
  submitDisposition
);

export default router;
