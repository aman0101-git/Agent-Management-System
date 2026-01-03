import express from "express";
import { protect, allowRoles } from "../middlewares/authMiddleware.js";
import {
  createCampaign,
  listCampaigns,
  listAllCampaigns,
  updateCampaignName,
  activateCampaign,
  deactivateCampaign,
  distributeCampaignData,
  getCampaignDistributionSummary,
  getRechurnData,
  rechurnCampaignData
} from "../controllers/campaignController.js";

const router = express.Router();

// Upload page (active only)
router.get("/", protect, allowRoles("ADMIN"), listCampaigns);

// Management page (all campaigns)
router.get("/all", protect, allowRoles("ADMIN"), listAllCampaigns);

// Create campaign
router.post("/", protect, allowRoles("ADMIN"), createCampaign);

// Edit name (active only)
router.patch("/:id", protect, allowRoles("ADMIN"), updateCampaignName);

// Activate / Deactivate
router.patch("/:id/activate", protect, allowRoles("ADMIN"), activateCampaign);
router.patch("/:id/deactivate", protect, allowRoles("ADMIN"), deactivateCampaign);

// Distribute data to agents
router.post(
  "/:id/distribute",
  protect,
  allowRoles("ADMIN"),
  distributeCampaignData
);

// Distribution Summary 
router.get(
  "/:id/distribution-summary",
  protect,
  allowRoles("ADMIN"),
  getCampaignDistributionSummary
);

// Get Rechurn data (IN_PROCESS)
router.get(
  "/:id/rechurn-data",
  protect,
  allowRoles("ADMIN"),
  getRechurnData
);

// Rechurn (redistribute IN_PROCESS data)
router.post(
  "/:id/rechurn",
  protect,
  allowRoles("ADMIN"),
  rechurnCampaignData
);

export default router;


