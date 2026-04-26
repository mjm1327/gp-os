# GP Operating System - Setup Guide

## Project Overview

This is a complete AI-native GP (General Partner) Operating System for alternative investment firms built with React, Node.js, Express, and SQLite.

### Technology Stack

**Frontend:**
- React 18 with TypeScript
- Vite (fast development server)
- Tailwind CSS (styling)
- React Router v6 (navigation)
- React Query/TanStack Query (state management)
- Axios (HTTP client)

**Backend:**
- Node.js with TypeScript
- Express.js (REST API)
- better-sqlite3 (database)
- tsx (TypeScript runner)

**Database:**
- SQLite (file-based, no server needed)
- Full relational schema with seed data
- Automatic initialization on startup

## Installation

### Prerequisites
- Node.js 18 or higher
- npm or yarn

### Quick Start

1. **Clone/Navigate to Project**
   ```bash
   cd /Users/markmerl/Documents/Claude/Projects/Alts\ AI/gp-os
   ```

2. **Install Dependencies**
   ```bash
   npm run install:all
   ```
   This installs dependencies for root, backend, and frontend.

3. **Start Development Server**
   ```bash
   npm run dev
   ```
   This starts both backend (port 3001) and frontend (port 5173) concurrently.

4. **Access the Application**
   - Open http://localhost:5173 in your browser
   - Backend API available at http://localhost:3001/api

## Project Structure

```
gp-os/
├── backend/
│   ├── src/
│   │   ├── index.ts              # Express app setup
│   │   ├── database.ts           # SQLite initialization
│   │   ├── schema.sql            # Database schema
│   │   ├── seed.sql              # Sample data
│   │   └── routes/               # API endpoints
│   │       ├── firm.ts
│   │       ├── assetClass.ts
│   │       ├── fund.ts
│   │       ├── investmentVehicle.ts
│   │       ├── limitedPartner.ts
│   │       ├── investingEntity.ts
│   │       ├── contact.ts
│   │       ├── deal.ts
│   │       ├── portfolio.ts
│   │       └── capitalAccounting.ts
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── main.tsx              # React entry point
│   │   ├── App.tsx               # Main component with routing
│   │   ├── index.css             # Tailwind styles
│   │   ├── types/                # TypeScript interfaces
│   │   ├── api/                  # Axios API client
│   │   ├── components/           # Reusable components
│   │   │   ├── Sidebar.tsx
│   │   │   └── Layout.tsx
│   │   └── pages/                # Page components
│   │       ├── Dashboard.tsx
│   │       ├── security-master/
│   │       │   ├── FirmProfile.tsx
│   │       │   ├── AssetClasses.tsx
│   │       │   ├── Funds.tsx
│   │       │   └── InvestmentVehicles.tsx
│   │       ├── crm/
│   │       │   ├── LimitedPartners.tsx
│   │       │   └── Contacts.tsx
│   │       ├── DealFlow.tsx
│   │       ├── Portfolio.tsx
│   │       ├── Documents.tsx
│   │       └── CapitalAccounting.tsx
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── index.html
└── package.json
```

## Database

### Automatic Initialization

The database is automatically initialized on first run:
1. SQLite file created at `backend/data/gp-os.db`
2. Schema created from `schema.sql`
3. Sample data loaded from `seed.sql`

### Sample Data Included

- 1 firm (Stonecrest Capital Management, $8B AUM)
- 2 asset classes (Private Credit, Private Equity)
- 3 sub-asset classes
- 3 funds with 2 vehicles each
- 5 limited partners with 7 investing entities
- 8 contacts across LPs
- 10 deals (funded, approved, pipeline, passed)
- Positions, metrics, capital calls, and distributions

### Reset Database

To reset the database with fresh data:
```bash
rm backend/data/gp-os.db
npm run dev
```

## API Endpoints

All endpoints return JSON and are available at `http://localhost:3001/api/`:

### Health Check
- `GET /health` - System status

### Security Master
- `GET /firms` - List firms
- `GET /asset-classes` - List asset classes
- `POST /asset-classes/:id/sub-classes` - Create sub-class
- `GET /funds` - List funds
- `GET /investment-vehicles` - List vehicles

### CRM
- `GET /limited-partners` - List LPs
- `GET /investing-entities` - List entities
- `GET /contacts` - List contacts

### Deal Management
- `GET /deals` - List deals

### Portfolio
- `GET /portfolio` - List positions
- `GET /portfolio/summary` - Portfolio summary
- `GET /portfolio/metrics/:dealId` - Deal metrics

### Capital Accounting
- `GET /capital-accounting/calls` - List capital calls
- `GET /capital-accounting/distributions` - List distributions
- `GET /capital-accounting/summary` - Capital summary
- `GET /capital-accounting/nav/:vehicleId` - Fund NAV

## Features

### Dashboard
- Portfolio snapshot with key metrics
- Capital calls and distribution status
- System health indicators

### Security Master
- Firm profile management
- Asset class hierarchy
- Fund management with vintage and target size
- Investment vehicle tracking with NAV

### LP Management
- Limited partner profiles by type
- Investing entity tracking with AML/KYC status
- Contact management with role and relationship tracking
- Interaction history

### Deal Flow
- Deal sourcing and tracking
- Instrument type management
- Borrower and sponsor information
- Deal team assignment

### Portfolio
- Position tracking with commitment levels
- Fair value and yield monitoring
- Multi-period metrics
- Reporting obligations

### Capital Accounting
- Capital call management
- Distribution tracking
- Fund NAV calculation
- LP allocations

## Development

### Start Individual Services

**Backend only:**
```bash
cd backend
npm run dev
```

**Frontend only:**
```bash
cd frontend
npm run dev
```

### Build for Production

```bash
npm run build
```

Creates production builds in:
- `backend/dist/`
- `frontend/dist/`

## Troubleshooting

### Port Already in Use

If port 5173 or 3001 is in use:

**Frontend:** Edit `frontend/vite.config.ts` to change port
**Backend:** Edit `backend/src/index.ts` to change port

### Database Corruption

Delete the database file and restart:
```bash
rm backend/data/gp-os.db
npm run dev
```

### Module Not Found Errors

Reinstall dependencies:
```bash
rm -rf node_modules backend/node_modules frontend/node_modules
npm run install:all
```

### CORS Issues

Frontend is configured to proxy API calls to localhost:3001. Ensure backend is running on port 3001.

## Next Steps

1. **Customize seed data** - Edit `backend/src/seed.sql` to match your firm data
2. **Add authentication** - Implement user login and role-based access
3. **Extend pages** - Build out remaining dashboard/reporting pages
4. **Add file upload** - Integrate document management
5. **Real-time updates** - Consider WebSocket for live data
6. **Mobile app** - Use React Native for mobile version

## License

Proprietary - All Rights Reserved
