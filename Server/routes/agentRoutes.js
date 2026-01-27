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
  getOnceConstraints,
} from '../controllers/agentController.js';

import {
  startCustomerVisit,
  endCustomerVisit,
  getCustomerVisitHistory,
} from '../controllers/agentCustomerVisitController.js';

const router = express.Router();

/**
 * Get ONCE_PTP/ONCE_PRT constraints for a customer
 */
router.get(
  '/customers/:collDataId/once-constraints',
  protect,
  getOnceConstraints
);

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
 * Agent-Customer Visit Tracking
 */
router.post(
  '/customer-visit/start',
  protect,
  allowRoles('AGENT'),
  startCustomerVisit
);

router.post(
  '/customer-visit/end',
  protect,
  allowRoles('AGENT'),
  endCustomerVisit
);

router.get(
  '/customer-visit/history/:customer_id',
  protect,
  allowRoles('AGENT'),
  getCustomerVisitHistory
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
