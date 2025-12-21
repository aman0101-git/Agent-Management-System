import express from "express";
import { protect, allowRoles } from "../middlewares/authMiddleware.js";
import {
  getCampaignAgents,
  assignAgentToCampaign,
  removeAgentFromCampaign
} from "../controllers/campaignAgentController.js";

const router = express.Router();

// Campaign <-> Agent allocation
router.get("/:id/agents", protect, allowRoles("ADMIN"), getCampaignAgents);
router.post("/:id/agents", protect, allowRoles("ADMIN"), assignAgentToCampaign);
router.delete("/:id/agents/:agentId", protect, allowRoles("ADMIN"), removeAgentFromCampaign);

export default router;