import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { initializeDatabase, getDatabase } from './database.js';
import firmRouter from './routes/firm.js';
import assetClassRouter from './routes/assetClass.js';
import fundRouter from './routes/fund.js';
import investmentVehicleRouter from './routes/investmentVehicle.js';
import limitedPartnerRouter from './routes/limitedPartner.js';
import investingEntityRouter from './routes/investingEntity.js';
import contactRouter from './routes/contact.js';
import dealRouter from './routes/deal.js';
import portfolioRouter from './routes/portfolio.js';
import capitalAccountingRouter from './routes/capitalAccounting.js';
import dashboardRouter from './routes/dashboard.js';
import omsRouter from './routes/oms.js';
import investorAccessRouter from './routes/investorAccess.js';
import tasksRouter from './routes/tasks.js';
import intelligenceRouter from './routes/intelligence.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware — allow all origins for demo deployment
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Initialize database
console.log('Initializing database...');
initializeDatabase();
console.log('Database initialized');

// Health check
app.get('/api/health', (req, res) => {
  try {
    const db = getDatabase();
    db.prepare('SELECT 1').get();
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    res.status(500).json({ status: 'error', error: (error as Error).message });
  }
});

// API Routes
app.use('/api/firms', firmRouter);
app.use('/api/asset-classes', assetClassRouter);
app.use('/api/funds', fundRouter);
app.use('/api/investment-vehicles', investmentVehicleRouter);
app.use('/api/limited-partners', limitedPartnerRouter);
app.use('/api/investing-entities', investingEntityRouter);
app.use('/api/contacts', contactRouter);
app.use('/api/deals', dealRouter);
app.use('/api/portfolio', portfolioRouter);
app.use('/api/capital-accounting', capitalAccountingRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/oms', omsRouter);
app.use('/api/investor-access', investorAccessRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/intelligence', intelligenceRouter);

// Serve built React frontend in production
const frontendDist = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendDist));

// SPA fallback — all non-API routes serve index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`GP OS running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});
