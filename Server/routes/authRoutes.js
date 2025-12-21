import express from 'express';
import { register, login, logout } from '../controllers/authController.js';
import { protect, allowRoles } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/login', login);

router.post('/register', protect, allowRoles('ADMIN'), register);

router.post('/logout', protect, logout);

export default router;
