// routes/agentRoutes.js

import express from 'express';
import { protect, allowRoles } from '../middlewares/authMiddleware.js';
import {
  getAgentCases,
  getAgentCaseById,
  submitDisposition,
  getNextCase,
  searchCustomers,
  getAgentAnalytics,
  getAgentTarget,
  setAgentTarget,
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
 * Allocate next queued case to agent (MUST be before /cases/:caseId to avoid route conflict)
 */
router.get(
  '/cases/next',
  protect,
  allowRoles('AGENT'),
  getNextCase
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

/**
 * Search customers across entire database (no allocation restriction)
 */
router.post(
  '/search',
  protect,
  allowRoles('AGENT'),
  searchCustomers
);

/**
 * Get agent performance analytics with time filtering
 */
router.get(
  '/analytics',
  protect,
  allowRoles('AGENT'),
  getAgentAnalytics
);

/**
 * Get agent's monthly target
 */
router.get(
  '/target',
  protect,
  allowRoles('AGENT'),
  getAgentTarget
);

/**
 * Set agent's monthly target
 */
router.post(
  '/target',
  protect,
  allowRoles('AGENT'),
  setAgentTarget
);

export default router;
