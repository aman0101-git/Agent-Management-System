// routes/adminRoutes.js

import express from 'express';
import { protect, allowRoles } from '../middlewares/authMiddleware.js';

import {
  assignAgentTarget,
  getAgentTargets,
  getAllAgentTargets,
  updateAgentTarget,
  deleteAgentTarget,
  exportAdminData,
} from '../controllers/adminController.js';

import {
  getMonitoringAnalytics,
  getMonitoringAgents,
  getMonitoringCampaigns,
  getMonitoringDrilldown,
  exportMonitoringDrilldown,
} from '../controllers/adminMonitoringController.js';

import { exportSingleTable } from "../controllers/adminController.js";

const router = express.Router();

/**
 * Export MySQL data to Excel (admin only)
 */
router.get(
  '/exports',
  protect,
  allowRoles('ADMIN'),
  exportAdminData
);

router.get(
  "/exports/table",
  protect,
  allowRoles("ADMIN"),
  exportSingleTable
);

/**
 * Assign/Create monthly target for an agent
 */
router.post(
  '/agent-targets',
  protect,
  allowRoles('ADMIN'),
  assignAgentTarget
);

/**
 * Get all targets with optional month filter
 */
router.get(
  '/agent-targets',
  protect,
  allowRoles('ADMIN'),
  getAllAgentTargets
);

/**
 * Get all targets for specific agent
 */
router.get(
  '/agents/:agentId/targets',
  protect,
  allowRoles('ADMIN'),
  getAgentTargets
);

/**
 * Update specific target
 */
router.put(
  '/agent-targets/:id',
  protect,
  allowRoles('ADMIN'),
  updateAgentTarget
);

/**
 * Delete specific target
 */
router.delete(
  '/agent-targets/:id',
  protect,
  allowRoles('ADMIN'),
  deleteAgentTarget
);

/**
 * GET /api/admin/monitoring-analytics
 * Aggregated analytics for admin across agents/campaigns
 */
router.get(
  '/monitoring-analytics',
  protect,
  allowRoles('ADMIN'),
  getMonitoringAnalytics
);

/**
 * GET /api/admin/monitoring-analytics/agents
 * List of active agents for filter dropdown
 */
router.get(
  '/monitoring-analytics/agents',
  protect,
  allowRoles('ADMIN'),
  getMonitoringAgents
);

/**
 * GET /api/admin/monitoring-analytics/campaigns
 * List of campaigns for filter dropdown
 */
router.get(
  '/monitoring-analytics/campaigns',
  protect,
  allowRoles('ADMIN'),
  getMonitoringCampaigns
);

/**
 * GET /api/admin/monitoring-analytics/drilldown
 * Get detailed list of customers for a specific disposition
 */
router.get(
  '/monitoring-analytics/drilldown',
  protect,
  allowRoles('ADMIN'),
  getMonitoringDrilldown
);

/**
 * GET /api/admin/monitoring-analytics/drilldown/export
 * Export drilldown list to CSV
 */
router.get(
  '/monitoring-analytics/drilldown/export',
  protect,
  allowRoles('ADMIN'),
  exportMonitoringDrilldown
);

export default router;
