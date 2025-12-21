import express from "express";
import upload from "../middlewares/uploadMiddleware.js";
import { protect, allowRoles } from "../middlewares/authMiddleware.js";
import { ingestLoans } from "../controllers/dataIngestionController.js";

const router = express.Router();

router.post(
  "/ingest",
  protect,
  allowRoles("ADMIN"),
  upload.single("file"),
  ingestLoans
);

export default router;
