import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import cookieParser from 'cookie-parser';
import pool from './config/mysql.js';
import fs from 'fs/promises';
import authRoute from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import dataRoutes from "./routes/dataRoutes.js";
import campaignRoutes from "./routes/campaignRoutes.js";
import campaignAgentRoutes from "./routes/campaignAgentRoutes.js";
import agentRoutes from './routes/agentRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

const app = express();
const port = process.env.PORT || 5000;

(async () => {
  try {
    const conn = await pool.getConnection();
    console.log('Database Connected');

    conn.release();
  } catch (err) {
    console.error('MySQL Connection Error:', err.message);
  }
})();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));

// Routes
app.get('/', (req, res) => res.send('API Working...'));
app.use('/api/auth', authRoute);
app.use('/api/users', userRoutes);
app.use("/api/data", dataRoutes);
app.use("/api/campaigns", campaignRoutes);
app.use("/api/campaigns", campaignAgentRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/admin', adminRoutes);

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
