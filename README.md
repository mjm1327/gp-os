# GP Operating System

An AI-native operating system for alternative investment firms. Built with React, Node.js, Express, and SQLite.

## Prerequisites

- Node.js 18+ and npm
- macOS, Linux, or Windows

## Quick Start

### 1. Install Dependencies

```bash
cd gp-os
npm run install:all
```

### 2. Start Development Server

```bash
npm run dev
```

This starts both the backend (port 3001) and frontend (port 5173) concurrently.

### 3. Open in Browser

Navigate to: http://localhost:5173

## Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Routing**: React Router v6
- **State Management**: React Query (TanStack Query)
- **HTTP Client**: Axios

### Backend
- **Runtime**: Node.js
- **Framework**: Express with TypeScript
- **Database**: SQLite (better-sqlite3)
- **Type Runner**: tsx

### Database
- **Type**: SQLite
- **Location**: `backend/data/gp-os.db` (auto-created)
- **Schema**: Full relational schema with seed data

## Features

### Security Master
- Firm profile management
- Asset class configuration
- Fund management
- Investment vehicle tracking

### LP Management
- Limited partner profiles
- Investing entity tracking
- Contact management
- Interaction logging

### Deal Flow
- Deal sourcing and tracking
- Investment instrument types
- Borrower information
- Deal team assignment

### Portfolio Management
- Position tracking
- Deal performance metrics
- Reporting obligations
- Call record management

### Capital Accounting
- Capital calls
- Distribution tracking
- Fund NAV calculation
- LP allocations

### Documents
- Document management
- Version control
- Status tracking

## Project Structure

```
gp-os/
├── backend/
│   ├── src/
│   │   ├── index.ts              # Express app
│   │   ├── database.ts           # SQLite setup
│   │   ├── schema.sql            # Database schema
│   │   ├── seed.sql              # Sample data
│   │   └── routes/               # API endpoints
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── main.tsx              # React entry
│   │   ├── App.tsx               # Main component
│   │   ├── types/                # TypeScript interfaces
│   │   ├── api/                  # HTTP clients
│   │   ├── components/           # React components
│   │   └── pages/                # Page components
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
└── package.json
```

## Development

### Backend Development
```bash
cd backend
npm run dev
```

### Frontend Development
```bash
cd frontend
npm run dev
```

## API Documentation

All endpoints are prefixed with `/api/` and return JSON:

- `GET /api/health` - Health check
- `GET /api/firms` - List firms
- `GET /api/asset-classes` - List asset classes
- `GET /api/funds` - List funds
- `GET /api/investment-vehicles` - List investment vehicles
- `GET /api/limited-partners` - List LPs
- `GET /api/contacts` - List contacts
- `GET /api/deals` - List deals
- `GET /api/positions` - List positions
- `GET /api/capital-calls` - List capital calls
- `POST /api/[resource]` - Create new resource
- `PUT /api/[resource]/:id` - Update resource
- `DELETE /api/[resource]/:id` - Delete resource

## Database Reset

To reset the database with fresh seed data:

```bash
rm backend/data/gp-os.db
npm run dev
```

The database will be recreated and seeded automatically on startup.

## License

Proprietary - All Rights Reserved
