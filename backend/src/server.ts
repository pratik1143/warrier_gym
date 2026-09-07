import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import router from './routes';
import { provisionAdminAccounts } from './firebase';
import { initDeviceSyncService } from './services/deviceSync.service';
import { startCleanupJob } from './jobs/cleanup';
import { startPresenceJob } from './jobs/presence';
import { initQueueJob } from './jobs/whatsappQueue.job';
import { startFollowupAutomationJob } from './jobs/followupAutomation.job';

// Trigger reload after Firestore activation by user
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable Cross-Origin Resource Sharing
app.use(cors({
  origin: '*', // Allow all origins for production and dev
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));
app.options('*', cors());

// Body parsing middleware (50mb limit for batch excel migration)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Request Logger Middleware
app.use((req, res, next) => {
  res.on('finish', () => {
    console.log(`[HTTP] ${req.method} ${req.originalUrl} - Status: ${res.statusCode}`);
  });
  next();
});

// API route middleware mounting
app.use('/api', router);

// Root welcome endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Warrior Gym OS API Backend',
    status: 'online',
    version: '1.0.0',
    health: '/health',
    apiRoot: '/api',
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'warrior-gym-os-api', timestamp: new Date().toISOString() });
});

if (process.env.VERCEL) {
  // In Vercel serverless environment, just export the app
  // Cron jobs will not run automatically in serverless mode unless triggered by Vercel Cron.
  module.exports = app;
} else {
  // Boot the server locally
  app.listen(PORT, async () => {
    console.log(`===================================================`);
    console.log(`  WARRIOR GYM OS Backend API running on port ${PORT}`);
    console.log(`  Access routes: http://localhost:${PORT}/api`);
    console.log(`===================================================`);

    try {
      await provisionAdminAccounts();
    } catch (err) {
      console.error('Failed to provision admin accounts on boot:', err);
    }

    try {
      initDeviceSyncService();
    } catch (err) {
      console.error('Failed to initialize Device Sync service on boot:', err);
    }

    // Start the automated Firebase Spark Plan cleanup cron job
    startCleanupJob();

    // Start the LIVE MEMBERS INSIDE ENGINE cron job
    startPresenceJob();

    // Start the WhatsApp Queue worker
    initQueueJob();

    // Start the Automated Follow-Up Generation Engine
    startFollowupAutomationJob();

    // ⛔ Auto email scheduler DISABLED — emails send only via manual dashboard trigger
    // To re-enable: uncomment the block below
    // try {
    //   const { runDailyAutomationChecks } = require('./services/automation.service');
    //   setTimeout(() => {
    //     runDailyAutomationChecks().catch((err: any) => console.error('Error running daily automation checks:', err));
    //   }, 10000);
    //   setInterval(() => {
    //     runDailyAutomationChecks().catch((err: any) => console.error('Error running daily automation checks:', err));
    //   }, 12 * 60 * 60 * 1000);
    // } catch (err) {
    //   console.error('Failed to initialize daily automation scheduler:', err);
    // }
  });
}
