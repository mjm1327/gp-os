# OMS API Reference

## Overview

The Order Management System consists of two main endpoints:
1. **POST /api/oms/extract** - AI-powered extraction from subscription documents
2. **POST /api/oms/confirm** - Create commitment records from extracted data

Base URL: `http://localhost:3001` (default)

---

## POST /api/oms/extract

Analyzes a subscription document text and extracts structured information using Claude AI.

### Request

**URL:** `POST /api/oms/extract`

**Headers:**
```
Content-Type: application/json
x-api-key: sk-ant-... (required, Anthropic API key)
```

**Body:**
```json
{
  "document_text": "string (required)",
  "fund_name": "string (optional)",
  "vehicle_name": "string (optional)"
}
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `document_text` | string | Yes | Full text of the subscription document (can be plain text or base64) |
| `fund_name` | string | No | Name of the fund (for AI context) |
| `vehicle_name` | string | No | Name of the investment vehicle (for AI context) |

**Example Request:**
```bash
curl -X POST http://localhost:3001/api/oms/extract \
  -H "Content-Type: application/json" \
  -H "x-api-key: sk-ant-..." \
  -d '{
    "document_text": "SUBSCRIPTION AGREEMENT\n\nSubscriber Name: Pacific Rim Capital Partners LP\n...",
    "fund_name": "Stonecrest Direct Lending Fund III",
    "vehicle_name": "Fund III - Series A"
  }'
```

### Response

**Status: 200 OK**

```json
{
  "extracted": {
    "lp_name": {
      "value": "Pacific Rim Capital Partners LP",
      "confidence": "HIGH",
      "source_text": "Subscriber Name: Pacific Rim Capital Partners LP"
    },
    "lp_type": {
      "value": "limited_partnership",
      "confidence": "HIGH",
      "source_text": "Type of Investor: Limited Partnership"
    },
    "investing_entity_legal_name": {
      "value": "Pacific Rim Capital Management LLC",
      "confidence": "MEDIUM",
      "source_text": "By: Pacific Rim Capital Management LLC, its General Partner"
    },
    "investing_entity_type": {
      "value": "LLC",
      "confidence": "HIGH",
      "source_text": "Pacific Rim Capital Management LLC"
    },
    "investing_entity_domicile": {
      "value": "Delaware, United States",
      "confidence": "HIGH",
      "source_text": "Jurisdiction of Organization: Delaware, United States"
    },
    "tax_id": {
      "value": "84-7654321",
      "confidence": "HIGH",
      "source_text": "Tax Identification Number: 84-7654321"
    },
    "commitment_amount": {
      "value": 75000000,
      "confidence": "HIGH",
      "source_text": "Aggregate Capital Commitment: $75,000,000"
    },
    "share_class": {
      "value": "Class A",
      "confidence": "HIGH",
      "source_text": "Share Class: Class A"
    },
    "close_number": {
      "value": "first",
      "confidence": "HIGH",
      "source_text": "Requested Closing: First Close"
    },
    "contact_name": {
      "value": "James Nakamura",
      "confidence": "HIGH",
      "source_text": "Primary Contact: James Nakamura"
    },
    "contact_email": {
      "value": "j.nakamura@pacificrimcapital.com",
      "confidence": "HIGH",
      "source_text": "Email: j.nakamura@pacificrimcapital.com"
    },
    "contact_title": {
      "value": "Managing Director, Private Credit",
      "confidence": "HIGH",
      "source_text": "Title: Managing Director, Private Credit"
    },
    "special_terms": {
      "value": null,
      "confidence": "LOW",
      "source_text": null
    },
    "notes": {
      "value": null,
      "confidence": "LOW",
      "source_text": null
    }
  },
  "raw_response": "{\n  \"lp_name\": { ... }\n}"
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `extracted` | object | Main extraction results object |
| `extracted.[field].value` | string\|number\|null | Extracted value |
| `extracted.[field].confidence` | "HIGH"\|"MEDIUM"\|"LOW" | Confidence level |
| `extracted.[field].source_text` | string\|null | Quote from document supporting extraction |
| `raw_response` | string | Full response from Claude (for debugging) |

### Error Responses

**400 Bad Request** - Missing required field
```json
{
  "error": "document_text is required"
}
```

**400 Bad Request** - Missing API key
```json
{
  "error": "Anthropic API key required in x-api-key header"
}
```

**500 Internal Server Error** - API failure
```json
{
  "error": "Error message from Anthropic API",
  "raw_response": "Raw response text if available"
}
```

---

## POST /api/oms/confirm

Creates LP, investing entity, and commitment records based on extracted/reviewed data.

### Request

**URL:** `POST /api/oms/confirm`

**Headers:**
```
Content-Type: application/json
x-api-key: sk-ant-... (required for header consistency)
```

**Body:**
```json
{
  "fund_id": "string (required)",
  "vehicle_id": "string (required)",
  "share_class_id": "string (optional)",
  "lp_name": "string (required)",
  "lp_type": "string (optional)",
  "investing_entity_legal_name": "string (required)",
  "investing_entity_type": "string (optional)",
  "investing_entity_domicile": "string (optional)",
  "tax_id": "string (optional)",
  "commitment_amount": "number (required)",
  "close_number": "string (optional)",
  "contact_name": "string (optional)",
  "contact_email": "string (optional)",
  "contact_title": "string (optional)",
  "special_terms": "string (optional)",
  "document_title": "string (optional)"
}
```

**Parameters:**

| Parameter | Type | Required | Description | Valid Values |
|-----------|------|----------|-------------|---------------|
| `fund_id` | string | Yes | Fund identifier | From funds API |
| `vehicle_id` | string | Yes | Investment vehicle identifier | From vehicles API |
| `share_class_id` | string | No | Share class identifier | From share-classes API |
| `lp_name` | string | Yes | Limited partner legal name | Any string |
| `lp_type` | string | No | LP type for classification | pension, endowment, family_office, sovereign_wealth, foundation, insurance, fund_of_funds, other |
| `investing_entity_legal_name` | string | Yes | Legal name of investing entity | Any string |
| `investing_entity_type` | string | No | Entity legal structure | LP, LLC, trust, corporation, other |
| `investing_entity_domicile` | string | No | Jurisdiction of organization | Any string (e.g., "Delaware, United States") |
| `tax_id` | string | No | Tax ID / EIN | Any string |
| `commitment_amount` | number | Yes | Capital commitment in base currency | Positive number |
| `close_number` | string | No | Closing round | first, second, third, final |
| `contact_name` | string | No | Primary contact name | Any string |
| `contact_email` | string | No | Contact email address | Valid email format |
| `contact_title` | string | No | Contact job title | Any string |
| `special_terms` | string | No | Special terms / side letter notes | Any string (markdown supported) |
| `document_title` | string | No | Title for subscription document record | Any string |

**Example Request:**
```bash
curl -X POST http://localhost:3001/api/oms/confirm \
  -H "Content-Type: application/json" \
  -H "x-api-key: sk-ant-..." \
  -d '{
    "fund_id": "fund-001",
    "vehicle_id": "vehicle-001",
    "share_class_id": "sc-001",
    "lp_name": "Pacific Rim Capital Partners LP",
    "lp_type": "fund_of_funds",
    "investing_entity_legal_name": "Pacific Rim Capital Management LLC",
    "investing_entity_type": "LLC",
    "investing_entity_domicile": "Delaware, United States",
    "tax_id": "84-7654321",
    "commitment_amount": 75000000,
    "close_number": "first",
    "contact_name": "James Nakamura",
    "contact_email": "j.nakamura@pacificrimcapital.com",
    "contact_title": "Managing Director, Private Credit",
    "special_terms": "No side letters or special terms",
    "document_title": "Stonecrest DLF III - Subscription Agreement"
  }'
```

### Response

**Status: 200 OK**

```json
{
  "success": true,
  "lp": {
    "id": "1714081924350-1001",
    "name": "Pacific Rim Capital Partners LP",
    "type": "fund_of_funds",
    "status": "active",
    "created_at": "2024-04-25T18:35:24.350Z"
  },
  "entity": {
    "id": "1714081924350-1002",
    "lp_id": "1714081924350-1001",
    "legal_name": "Pacific Rim Capital Management LLC",
    "entity_type": "LLC",
    "domicile": "Delaware, United States",
    "tax_id": "84-7654321",
    "aml_kyc_status": "pending",
    "subscription_doc_status": "in_progress",
    "created_at": "2024-04-25T18:35:24.350Z"
  },
  "commitment": {
    "id": "1714081924350-1003",
    "investing_entity_id": "1714081924350-1002",
    "investment_vehicle_id": "vehicle-001",
    "share_class_id": "sc-001",
    "commitment_amount": 75000000,
    "close_number": "first",
    "currency": "USD",
    "status": "hard",
    "created_at": "2024-04-25T18:35:24.350Z"
  }
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Always true on success |
| `lp` | object | Created/found limited partner record |
| `lp.id` | string | LP unique identifier |
| `lp.name` | string | LP legal name |
| `lp.type` | string | LP classification type |
| `lp.status` | string | Always "active" for new LPs |
| `entity` | object | Created/found investing entity record |
| `entity.id` | string | Entity unique identifier |
| `entity.lp_id` | string | Parent LP identifier |
| `entity.legal_name` | string | Entity legal name |
| `entity.entity_type` | string | Entity structure type |
| `entity.domicile` | string | Entity jurisdiction |
| `entity.tax_id` | string | Entity tax ID |
| `entity.aml_kyc_status` | string | Always "pending" for new entities |
| `entity.subscription_doc_status` | string | Always "in_progress" for new commitments |
| `commitment` | object | Created commitment record |
| `commitment.id` | string | Commitment unique identifier |
| `commitment.investing_entity_id` | string | Associated entity |
| `commitment.investment_vehicle_id` | string | Associated vehicle |
| `commitment.share_class_id` | string | Associated share class (if any) |
| `commitment.commitment_amount` | number | Capital committed in base units |
| `commitment.close_number` | string | Closing round |
| `commitment.currency` | string | Always "USD" |
| `commitment.status` | string | Always "hard" for new commitments |
| `commitment.created_at` | string | ISO 8601 timestamp |

### Error Responses

**400 Bad Request** - Missing required field
```json
{
  "error": "fund_id is required"
}
```

**500 Internal Server Error** - Database failure
```json
{
  "error": "Error message describing the failure"
}
```

---

## Data Models

### LP Type (lp_type)
- `pension` - Pension plan
- `endowment` - University/foundation endowment
- `family_office` - Family office
- `sovereign_wealth` - Sovereign wealth fund
- `foundation` - Foundation
- `insurance` - Insurance company
- `fund_of_funds` - Fund of funds manager
- `other` - Other investor type

### Entity Type (investing_entity_type)
- `LP` - Limited partnership
- `LLC` - Limited liability company
- `trust` - Trust entity
- `corporation` - Corporation
- `other` - Other structure

### Close Number (close_number)
- `first` - First close
- `second` - Second close
- `third` - Third close
- `final` - Final close

### Confidence Levels
- `HIGH` - Directly stated in document (90-100% confidence)
- `MEDIUM` - Inferred from context (70-90% confidence)
- `LOW` - Uncertain/estimated (50-70% confidence)

---

## Database Records Created

### When /api/oms/confirm is called:

1. **limited_partners** table
   - Inserted if LP with same name doesn't exist (case-insensitive match)
   - Fields: id, name, type, status, created_at

2. **investing_entities** table
   - Inserted if entity with same legal name + LP ID doesn't exist
   - Fields: id, lp_id, legal_name, entity_type, domicile, tax_id, aml_kyc_status, subscription_doc_status, created_at

3. **commitments** table
   - Always inserted (new commitment record)
   - Fields: id, investing_entity_id, investment_vehicle_id, share_class_id, commitment_amount, close_number, currency, status, created_at

4. **contacts** table (optional)
   - Inserted if contact_name provided and doesn't already exist for LP
   - Fields: id, lp_id, name, title, email, role, created_at

5. **documents** table (optional)
   - Inserted if document_title provided
   - Links to commitment record
   - Fields: id, title, document_type, parent_entity_type, parent_entity_id, status, uploaded_by, created_at

6. **side_letters** table (optional)
   - Inserted if special_terms provided
   - Fields: id, commitment_id, investing_entity_id, investment_vehicle_id, other_modifications, created_at

---

## Integration with Frontend

### Type Definitions (TypeScript)

```typescript
interface ExtractedField {
  value: string | number | null;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  source_text: string | null;
}

interface ExtractedData {
  lp_name: ExtractedField;
  lp_type: ExtractedField;
  investing_entity_legal_name: ExtractedField;
  investing_entity_type: ExtractedField;
  investing_entity_domicile: ExtractedField;
  tax_id: ExtractedField;
  commitment_amount: ExtractedField;
  share_class: ExtractedField;
  close_number: ExtractedField;
  contact_name: ExtractedField;
  contact_email: ExtractedField;
  contact_title: ExtractedField;
  special_terms: ExtractedField;
  notes: ExtractedField;
}

interface ExtractResponse {
  extracted: ExtractedData;
  raw_response: string;
}

interface ConfirmResponse {
  success: boolean;
  lp: {
    id: string;
    name: string;
    type: string;
    status: string;
    created_at: string;
  };
  entity: {
    id: string;
    lp_id: string;
    legal_name: string;
    entity_type: string;
    domicile: string;
    tax_id: string;
    aml_kyc_status: string;
    subscription_doc_status: string;
    created_at: string;
  };
  commitment: {
    id: string;
    investing_entity_id: string;
    investment_vehicle_id: string;
    share_class_id: string | null;
    commitment_amount: number;
    close_number: string;
    currency: string;
    status: string;
    created_at: string;
  };
}
```

---

## Rate Limiting & Quotas

- **Extraction:** ~200 requests per minute (Anthropic API limits)
- **Confirmation:** No specific limit (database operation)
- **Cost per extraction:** ~$0.0005 (Claude Sonnet 4 pricing)

---

## Debugging

### Check Backend Health
```bash
curl http://localhost:3001/health
# Returns: {"status":"OK"} if running
```

### View Backend Logs
- Check terminal where `npm run dev` is running
- Look for extraction requests and responses
- Errors include full stack traces

### Browser Console (Frontend)
- F12 → Console tab
- Check for fetch errors
- API response objects logged when debugging enabled

### Test Extraction Locally
```bash
# Use curl to test extraction
curl -X POST http://localhost:3001/api/oms/extract \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{"document_text": "Your document text here"}'
```

---

## Roadmap

**Phase 1 (Current):** Basic extraction and creation
- Extract common fields from subscription docs
- Create LP, entity, and commitment records
- Simple confidence scoring

**Phase 2:** Enhanced validation
- Custom validation rules per fund
- Audit trail and logging
- Duplicate detection

**Phase 3:** Advanced features
- PDF upload and OCR
- Batch processing
- Template matching
- Webhook integrations
