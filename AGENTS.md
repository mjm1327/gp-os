# GP OS — Agent Context

## What This Is
A full-stack GP Operating System for alternative investment (GP/alts) firms. Built as a consulting demonstration product by Alts AI. The tech validates a thesis: mid-sized GPs (~$3–10B AUM) have poor technology and are ready for an AI-native platform.

## Stack
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS · runs on port 5173
- **Backend**: Node.js + Express + TypeScript + better-sqlite3 · runs on port 3001
- **AI**: Anthropic claude-sonnet-4-6 (direct API calls from backend, key passed in `x-api-key` header)
- **Database**: SQLite, auto-created at `backend/data/gp-os.db` on first run
- **Routing**: React Router v6 · Data fetching: TanStack Query

## Running the App
```bash
cd gp-os
npm run dev          # starts both frontend + backend via concurrently
```
Frontend: http://localhost:5173 · Backend: http://localhost:3001/api/health

If the database is missing or corrupt:
```bash
rm backend/data/gp-os.db   # delete it
npm run dev                  # restarts and re-seeds automatically
```

## Project Structure
```
gp-os/
  frontend/src/
    pages/
      Dashboard.tsx                    # Fund overview table with lifecycle badges
      Portfolio.tsx                    # Portfolio monitoring + AI analyst chat
      portfolio/PositionDetail.tsx     # Position drill-down (metrics, reporting, calls)
      security-master/
        Funds.tsx                      # Fund list + New Fund modal
        FundDetail.tsx                 # Fund detail (share classes, vehicles, documents)
        FirmProfile.tsx / AssetClasses.tsx / InvestmentVehicles.tsx
      crm/
        LimitedPartners.tsx            # LP cards, clickable
        LPDetail.tsx                   # LP detail (entities, contacts)
        Contacts.tsx
      oms/OMSPage.tsx                  # 4-step OMS wizard (upload → AI extract → review → confirm)
      DealFlow.tsx / Documents.tsx / CapitalAccounting.tsx  # shells, not fully built
    components/
      Sidebar.tsx / Layout.tsx
    api/index.ts                       # All API client functions (axios)
    types/index.ts                     # TypeScript interfaces

  backend/src/
    database.ts                        # SQLite init — reads schema.sql then seed.sql
    schema.sql                         # Full 25+ table schema
    seed.sql                           # Realistic seed data (Stonecrest Capital)
    routes/
      dashboard.ts    → GET /api/dashboard/funds
      portfolio.ts    → GET /api/portfolio/overview, /, /positions/:id, POST /analyze
      limitedPartner.ts → /api/limited-partners
      fund.ts         → /api/funds (with share classes, vehicles, documents)
      oms.ts          → POST /api/oms/extract (AI), POST /api/oms/confirm
      deal.ts / contact.ts / investingEntity.ts / capitalAccounting.ts / firm.ts / etc.
```

## Seed Data (Stonecrest Capital Management)
- 3 funds: Direct Lending III (investing), Mezzanine II (harvesting), Growth Equity I (investing)
- 6 investment vehicles, 5 share classes
- 5 LPs: CalPERS, Harvard Endowment, Blackstone FO, ADIA, Rockefeller Foundation
- 7 investing entities, 6 contacts
- 10 deals, 8 positions, portfolio metrics, reporting obligations, call records
- Capital calls, distributions, fund NAV, fundraising campaigns, LP prospects

## Key Architecture Decisions
1. **BYOD** — data never moves to servers; API key passed per-request in `x-api-key` header
2. **AI as analyst, human as decision-maker** — every AI extraction has confidence scores + source text
3. **ShareClass at Fund level** — investing entities invest into share classes, not vehicles directly
4. **No DealICProcess or DealFunding tables** — removed per design decision
5. **contact_investing_entities junction** — contacts can be assigned to multiple investing entities
6. **capital_call_deal_items** — a capital call can fund multiple deals with per-deal amounts

## Module Status (as of April 2026)
| Module | Status | Notes |
|--------|--------|-------|
| Dashboard | ✅ Built | Fund lifecycle overview, summary stats |
| Security Master | ✅ Built | Funds, share classes, vehicles, documents |
| LP Management | ✅ Built | LP list → LP detail (entities, contacts) |
| Order Management (OMS) | ✅ Built | AI extraction from subscription PDFs |
| Portfolio Monitoring | ✅ Built | Positions table (with staleness badge), detail drill-down, AI analyst, agentic call ingestion wizard |
| New Fund Wizard | ✅ Built | Doc upload → AI extract → review → create (fund + vehicles + share classes + doc) |
| Investor Portal | ✅ Built | Public LP-facing fund page at /investor/:token; IR generates links from Fund Detail |
| Deal Flow | 🔲 Shell only | Page exists, not populated |
| Capital Accounting | 🔲 Shell only | Page exists, not populated |
| CMS / Documents | 🔲 Shell only | Page exists, not populated |
| MP Dashboard | 🔲 Not started | Cross-module exec view (Phase 7) |

## AI Features
- **OMS extraction**: POST /api/oms/extract → claude-sonnet-4-6 extracts 13 fields from subscription PDF with confidence scores (HIGH/MEDIUM/LOW) and source_text citations
- **Portfolio Analyst**: POST /api/portfolio/analyze → claude-sonnet-4-6 receives full portfolio as context, answers natural language questions about yield, leverage, trim candidates, pro formas

## The Squad — Agent Roles

These are the specialized roles used to build and evolve GP OS. Each session should identify which hat(s) are needed before starting work. Multiple roles can be active in one session but should be called out explicitly so the right lens is applied.

---

### 🎯 VP of Product
**When to invoke:** Strategy, positioning, market sizing, fundraising narrative, investor pitch, new product lines, whether to build vs. partner.

**Owns:**
- Product vision and 30-month roadmap
- Market opportunity sizing (~1,030 mid-sized GPs)
- Competitive positioning vs. Allvue, Dynamo, iLevel, Carta, etc.
- Go-to-market: who to sell to first, how to price, how to land

**Outputs produced so far:** GP_OS_Product_Vision_Strategy.docx, GP_OS_Feature_Map_and_Competitive_Landscape.docx

**Do NOT invoke for:** Feature-level decisions, schema changes, code.

---

### 📋 Product Manager
**When to invoke:** Feature scoping, user stories, PRDs, build sequencing, persona refinement, JTBD, sprint planning.

**Owns:**
- PRDs for individual modules (what gets built and why)
- Feature map — what's in scope vs. out of scope
- Module build sequence and phasing
- Acceptance criteria and success metrics per feature
- Persona definitions and jobs to be done

**Outputs produced so far:** GP_OS_PRD_Private_Credit_Portfolio_Analysis.docx, GP_OS_Module_Map_Build_Sequence.docx, GP_OS_User_Personas_JTBD.docx

**Do NOT invoke for:** Architecture decisions, writing code, competitive strategy.

---

### 🏗️ Tech Lead
**When to invoke:** Schema changes, architecture decisions, new module planning, API design, data model updates, performance or security concerns.

**Owns:**
- Data model and schema.sql — single source of truth for all entities
- API route design (what endpoints exist, what they return)
- Architecture decisions (BYOD model, SQLite, AI integration pattern)
- Technical documentation (AGENTS.md, GP_OS_Technical_Architecture.docx)
- Deciding when a schema change requires a db re-seed

**Outputs produced so far:** GP_OS_Technical_Architecture.docx, GP_OS_Data_Model.docx (v1.1), AGENTS.md

**Rules:** Any schema.sql change → delete backend/data/gp-os.db before next run. Always update AGENTS.md Module Status table when a module ships.

---

### 💻 Full Stack Developer
**When to invoke:** Any time code needs to be written, edited, or debugged — frontend pages, backend routes, API wiring, seed data, schema execution.

**Owns:**
- All files under `gp-os/frontend/` and `gp-os/backend/`
- React components, Tailwind styling, TanStack Query hooks
- Express routes, SQLite queries, Anthropic API calls
- `frontend/src/api/index.ts` — keep all exports typed and consistent
- Debugging runtime errors (500s, TypeScript failures, missing routes)

**Build conventions:**
- New page → create file in `pages/` + add import + add `<Route>` in App.tsx + add link in Sidebar.tsx
- New backend endpoint → add to existing route file or create new one + register in index.ts
- AI endpoint → takes `x-api-key` header, builds context from DB, calls claude-sonnet-4-6
- Never hardcode API keys; never store them server-side

---

### 🧪 QA
**When to invoke:** Before any demo or client meeting, after a major build sprint, when a bug is reported.

**Owns:**
- Test plan and demo readiness checklist
- Bug log with severity ratings
- Verifying seed data renders correctly across all pages
- Confirming AI features work end-to-end with a real API key
- Checking that navigation and drill-downs don't 404

**Outputs produced so far:** GP_OS_Test_Plan.docx (10 bugs identified in initial pass)

**Standard pre-demo checklist:**
1. `npm run dev` starts clean — no TypeScript errors in terminal
2. Dashboard loads with 3 funds and correct lifecycle badges
3. LP Management shows 5 LPs, each card links to detail page
4. Portfolio Monitoring shows 8 positions with metrics and color coding
5. OMS wizard completes full flow with sample document
6. AI Portfolio Analyst responds to at least one suggested question
7. Security Master shows funds with share classes and vehicles

---

### 🧭 How to Choose
| Task | Primary Role | Supporting Role |
|------|-------------|-----------------|
| "Should we build X feature?" | PM | VP of Product |
| "How should X be structured in the DB?" | Tech Lead | Dev |
| "Build the X page" | Dev | Tech Lead (if schema needed) |
| "Is the app ready to show Michael?" | QA | Dev (fixes) |
| "How do we position this vs. Allvue?" | VP of Product | PM |
| "Write a PRD for deal flow" | PM | — |
| "The LP page is returning a 500" | Dev | — |
| "What should we build next?" | PM | VP of Product |

---

## Personas (Who This Is Built For)
1. **Managing Partner** — needs cross-fund snapshot before LP meetings; does not live in spreadsheets
2. **CFO** — owns data accuracy; wants reporting automation and warehouse control (validated: Michael Rettagliata transcript)
3. **Head of IR** — manages LP lifecycle, fundraising pipeline, subscription processing
4. **Head of Private Credit / Portfolio Manager** — monitors positions, runs pro formas, manages deal pipeline
5. **Fund Operations Associate** — processes subscriptions, updates portfolio data, needs workflow + approval structure

## Files NOT to Touch Without Care
- `backend/src/schema.sql` — any change requires deleting `backend/data/gp-os.db` to re-seed
- `backend/src/seed.sql` — Stonecrest is the demo firm; keep names consistent across all docs/demo
- `frontend/src/api/index.ts` — single source of truth for all API calls; keep exports consistent with types

## Coding Conventions
- All monetary values stored as integers (cents × 1000 = dollars stored as raw dollars, display divides by 1M)
- Dates stored as ISO strings (YYYY-MM-DD)
- API key for AI features: passed by frontend in `x-api-key` header, never stored on server
- TypeScript `any` is acceptable for dynamic API response shapes in frontend pages
- Use `response?.data || []` pattern when consuming TanStack Query results
