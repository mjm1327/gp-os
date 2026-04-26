# Order Management System (OMS) Implementation Guide

## Overview

The Order Management System is a complete workflow for onboarding limited partners (LPs) into a fund. The system leverages Claude AI to automatically extract subscription document information, which users can review and confirm before creating commitment records.

### OMS Workflow

```
1. Select Fund & Vehicle → 2. Upload Document → 3. Review & Confirm → 4. Success
```

---

## Architecture

### Backend

**Location:** `/backend/src/routes/oms.ts`

#### Endpoints

**POST /api/oms/extract**
- Extracts structured data from subscription documents using Claude API
- **Request:**
  ```json
  {
    "document_text": "string (base64 or plain text)",
    "fund_name": "string (optional, for context)",
    "vehicle_name": "string (optional, for context)"
  }
  ```
- **Headers:** `x-api-key: <ANTHROPIC_API_KEY>`
- **Response:**
  ```json
  {
    "extracted": {
      "lp_name": { "value": "...", "confidence": "HIGH|MEDIUM|LOW", "source_text": "..." },
      "lp_type": { ... },
      "investing_entity_legal_name": { ... },
      "investing_entity_type": { ... },
      "investing_entity_domicile": { ... },
      "tax_id": { ... },
      "commitment_amount": { ... },
      "share_class": { ... },
      "close_number": { ... },
      "contact_name": { ... },
      "contact_email": { ... },
      "contact_title": { ... },
      "special_terms": { ... },
      "notes": { ... }
    },
    "raw_response": "string (full AI response)"
  }
  ```

**POST /api/oms/confirm**
- Creates LP, investing entity, and commitment records
- **Request:**
  ```json
  {
    "fund_id": "string",
    "vehicle_id": "string",
    "share_class_id": "string (optional)",
    "lp_name": "string",
    "lp_type": "string (optional)",
    "investing_entity_legal_name": "string",
    "investing_entity_type": "string (optional)",
    "investing_entity_domicile": "string (optional)",
    "tax_id": "string (optional)",
    "commitment_amount": "number",
    "close_number": "first|second|third|final (optional)",
    "contact_name": "string (optional)",
    "contact_email": "string (optional)",
    "contact_title": "string (optional)",
    "special_terms": "string (optional)",
    "document_title": "string (optional)"
  }
  ```
- **Response:**
  ```json
  {
    "success": true,
    "lp": { "id": "...", "name": "...", ... },
    "entity": { "id": "...", "legal_name": "...", ... },
    "commitment": { "id": "...", "commitment_amount": "...", ... }
  }
  ```

#### AI Extraction Prompt

The backend uses a structured prompt to extract key subscription document fields. Claude is instructed to:

- Extract specific fields with their exact values
- Assign confidence levels (HIGH/MEDIUM/LOW) based on:
  - **HIGH:** Directly stated in the document
  - **MEDIUM:** Inferred from context
  - **LOW:** Uncertain or estimated
- Include source text from the document that supports each extraction

**Model:** claude-sonnet-4-20250514 (or configured model)
**Max Tokens:** 2048

#### Database Integration

The backend includes mock database functions for demonstration. In production, replace with actual database calls:

- **Find/Create LP:** Match by name (case-insensitive)
- **Find/Create InvestingEntity:** Match by legal name + LP ID
- **Create Contacts:** Only if contact name is provided
- **Create Commitments:** Store with vehicle, share class, amount, close number
- **Store Documents:** Link subscription agreement metadata to commitment
- **Store Terms:** Save special terms as side letters

---

### Frontend

**Location:** `/frontend/src/pages/oms/OMSPage.tsx`

#### Features

**4-Step Wizard**

1. **Step 1: Fund & Vehicle Selection**
   - Dropdown selectors for Fund, Investment Vehicle, Share Class
   - Loads dynamically from backend API
   - Validates selection before proceeding

2. **Step 2: Document Upload**
   - Textarea for pasting subscription document text
   - "Load Sample Document" button with realistic example
   - Upload via drag-and-drop or paste
   - Shows loading state during extraction
   - Error handling with retry option

3. **Step 3: Review & Confirm**
   - Display all extracted fields organized in sections:
     - LP Information
     - Investing Entity
     - Investment Terms
     - Contact
     - Special Terms & Notes
   - Each field shows:
     - Input field (editable)
     - Confidence badge (HIGH/MEDIUM/LOW with color coding)
     - Expandable source text from document
   - User can edit any field before confirming
   - Final validation before creation

4. **Step 4: Success**
   - Confirmation with key details
   - Links to view the created commitment
   - Option to create another commitment

**API Key Management**
- API key input at top of page (collapsible after set)
- Stored in localStorage under `anthropic_api_key`
- Passed as `x-api-key` header to extraction endpoint

**Design**
- Professional financial UI with clean white panels
- Confidence badges: HIGH (green), MEDIUM (amber), LOW (red)
- Step indicator with visual progress
- Responsive design for mobile/tablet
- Loading spinners for async operations
- Error messages with clear messaging

#### File Structure

```
frontend/src/pages/oms/
├── OMSPage.tsx        # Main component (React, 500+ lines)
└── OMSPage.css        # Styling (responsive, 400+ lines)
```

#### Component State

- **Step control:** 1 | 2 | 3 | 4
- **API key:** Stored locally, not in state
- **Fund/Vehicle/ShareClass:** Selected IDs
- **Document text:** Raw subscription document
- **Extracted data:** Full extracted JSON from AI
- **Edited data:** User-modified extraction results
- **Created commitment:** Success response data

---

## Setup & Installation

### Backend Prerequisites

1. **Install dependencies:**
   ```bash
   cd backend
   npm install
   ```

2. **Verify @anthropic-ai/sdk is in package.json:**
   ```json
   {
     "dependencies": {
       "@anthropic-ai/sdk": "^0.29.1"
     }
   }
   ```

3. **Start the server:**
   ```bash
   npm run dev
   # Runs on http://localhost:3001
   ```

### Frontend Prerequisites

1. **Dependencies already included:**
   - React Router (routing)
   - React Query (data fetching)
   - TypeScript

2. **Start the dev server:**
   ```bash
   cd frontend
   npm run dev
   # Runs on http://localhost:5173 (Vite default)
   ```

3. **Navigate to:** `http://localhost:5173/oms`

### API Key Setup

1. Get an Anthropic API key from https://console.anthropic.com
2. In the OMS page, enter your API key in the top input field
3. Click "Set Key" to store it locally
4. Key is saved to localStorage and used for all extraction requests

---

## Usage Examples

### Sample Subscription Document

The frontend includes a sample document that can be loaded:

```
SUBSCRIPTION AGREEMENT
Stonecrest Direct Lending Fund III

SUBSCRIBER INFORMATION
Subscriber Name: Pacific Rim Capital Partners LP
Type of Investor: Limited Partnership
Jurisdiction of Organization: Delaware, United States
Tax Identification Number: 84-7654321

CONTACT INFORMATION
Primary Contact: James Nakamura
Title: Managing Director, Private Credit
Email: j.nakamura@pacificrimcapital.com

SUBSCRIPTION DETAILS
Aggregate Capital Commitment: $75,000,000
Share Class: Class A
Requested Closing: First Close
```

### Typical Flow

1. **Select Fund:** "Stonecrest Direct Lending Fund III"
2. **Select Vehicle:** "Fund III - Series A"
3. **Select Share Class:** "Class A"
4. **Paste/Upload:** Click "Load Sample Document" or paste real subscription agreement
5. **Extract:** Click "Extract Information" (Claude analyzes in 2-5 seconds)
6. **Review:** Verify all fields, edit if needed
   - Check confidence levels
   - Review source text
   - Correct any extraction errors
7. **Confirm:** Click "Confirm & Create Commitment"
8. **Success:** View the created commitment details

---

## Confidence Levels Explained

### HIGH (Green Badge)
- **Criteria:** Field is explicitly stated in the document
- **Example:** "Aggregate Capital Commitment: $75,000,000" → HIGH confidence
- **Action:** Can accept as-is

### MEDIUM (Amber Badge)
- **Criteria:** Field inferred from context but not explicitly stated
- **Example:** LP type inferred from "Limited Partnership" in legal name → MEDIUM
- **Action:** Review and confirm

### LOW (Red Badge)
- **Criteria:** Field uncertain, estimated, or unclear from document
- **Example:** Commitment amount mentioned in prose but not in subscription block → LOW
- **Action:** Edit or request clarification

---

## API Integration Points

### GET /api/funds
Returns list of funds for selection dropdown.

**Response Format:**
```json
[
  {
    "id": "fund-001",
    "name": "Stonecrest Direct Lending Fund III",
    "vehicle_ids": ["vehicle-001", "vehicle-002"]
  }
]
```

### GET /api/investment-vehicles?fund_id=<fund_id>
Returns vehicles for a selected fund.

**Response Format:**
```json
[
  {
    "id": "vehicle-001",
    "name": "Fund III - Series A",
    "share_class_ids": ["sc-001", "sc-002"]
  }
]
```

### GET /api/investment-vehicles/<vehicle_id>/share-classes
Returns share classes for a vehicle.

**Response Format:**
```json
[
  {
    "id": "sc-001",
    "name": "Class A"
  }
]
```

### POST /api/oms/extract
Claude AI extraction (documented above)

### POST /api/oms/confirm
Create commitment records (documented above)

---

## Error Handling

### Extraction Errors

**Missing API Key:**
- Prompt user to enter API key
- Store securely in localStorage

**Invalid Document:**
- Show error: "Document text is required"
- Suggest using sample document

**AI Response Parse Error:**
- Show error: "Failed to parse AI response"
- Include raw response for debugging
- Offer retry option

**Rate Limiting:**
- If Anthropic API rate limit hit, show friendly error
- Advise user to wait before retrying

### Confirmation Errors

**Missing Required Fields:**
- Validate LP name and commitment amount
- Show validation errors before submit

**Database Errors:**
- Show generic error message
- Log details to console for debugging
- Offer to try again

---

## Performance Considerations

1. **Document Size:** Supports up to 50MB in request
2. **Extraction Time:** 2-5 seconds for typical subscription docs
3. **API Cost:** ~0.05 cents per extraction (Claude Sonnet pricing)
4. **Caching:** Fund/vehicle lists are fetched once and cached in React state

---

## Security Notes

1. **API Keys:** Stored in browser localStorage (not ideal for production)
   - **Recommendation:** Replace with backend token exchange
   - Implement OAuth flow with Anthropic
   - Backend validates and makes extraction calls

2. **PII Handling:** Subscription documents may contain sensitive info
   - API key should have minimal scope
   - Documents not logged or stored by default
   - Consider implementing audit logging

3. **Input Validation:** All user inputs validated before API calls
   - Empty document rejected
   - Amounts validated as numbers
   - Email format checked

---

## Future Enhancements

1. **PDF Upload:** Convert PDF to text on frontend or backend
2. **OCR Support:** Handle scanned documents
3. **Batch Processing:** Upload multiple documents at once
4. **Field Customization:** Let users configure which fields to extract
5. **Template Matching:** Match documents to fund-specific templates
6. **Audit Trail:** Log all extractions and edits
7. **Document Storage:** Save uploaded documents in S3/blob storage
8. **Multi-language:** Support documents in multiple languages
9. **Validation Rules:** Custom business logic for fund-specific requirements
10. **Integration:** Webhook notifications to other systems

---

## Troubleshooting

### "API key required" error
- Ensure API key is entered in the field at top of page
- Click "Set Key" button
- Clear localStorage and re-enter: `localStorage.removeItem('anthropic_api_key')`

### Extraction is slow
- Large documents take longer (Claude processes sequentially)
- Consider splitting large subscription agreements
- Check API usage at console.anthropic.com

### Created commitment not showing
- Check browser console for errors
- Verify backend is running on http://localhost:3001
- Check database setup in backend

### Confidence levels seem wrong
- AI's assessments depend on document quality/clarity
- Always review extracted data before confirming
- Edit fields where confidence is LOW

---

## Files Modified/Created

**Backend:**
- `/backend/src/routes/oms.ts` ← NEW
- `/backend/package.json` ← UPDATED (added @anthropic-ai/sdk)
- `/backend/src/index.ts` ← UPDATED (added OMS router)

**Frontend:**
- `/frontend/src/pages/oms/OMSPage.tsx` ← NEW
- `/frontend/src/pages/oms/OMSPage.css` ← NEW
- `/frontend/src/App.tsx` ← UPDATED (added /oms route)
- `/frontend/src/components/Sidebar.tsx` ← UPDATED (added Order Management nav item)

---

## Next Steps

1. Install backend dependencies: `cd backend && npm install`
2. Start backend: `npm run dev` (runs on port 3001)
3. Start frontend: `npm run dev` (runs on port 5173)
4. Get Anthropic API key from https://console.anthropic.com
5. Navigate to http://localhost:5173/oms
6. Enter API key and start onboarding LPs

---

## Questions & Support

For issues or questions about the OMS implementation, refer to:
- Claude API docs: https://docs.anthropic.com
- Component code: Inline comments in OMSPage.tsx
- Backend routes: Inline comments in oms.ts
