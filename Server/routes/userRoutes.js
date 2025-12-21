import express from 'express';
import { protect, allowRoles } from '../middlewares/authMiddleware.js';
import { getAllUsers, getUserById } from '../controllers/userController.js';

const router = express.Router();

// Get all users with optional filters
router.get('/', protect, allowRoles('ADMIN'), getAllUsers);

// Get user by ID
router.get('/:id', protect, allowRoles('ADMIN'), getUserById);

export default router;
