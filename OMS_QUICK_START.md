# OMS Quick Start Guide

## 5-Minute Setup

### Step 1: Install Backend Dependencies
```bash
cd gp-os/backend
npm install
```

### Step 2: Start Backend
```bash
npm run dev
# Server runs on http://localhost:3001
```

### Step 3: Start Frontend
```bash
cd gp-os/frontend
npm run dev
# App runs on http://localhost:5173
```

### Step 4: Get API Key
1. Visit https://console.anthropic.com/keys
2. Create or copy an existing API key
3. Keep it handy for next step

### Step 5: Open OMS
1. Navigate to `http://localhost:5173/oms`
2. Enter Anthropic API key in the input field
3. Click "Set Key"

## Using the OMS

### Test Workflow

1. **Step 1 - Fund Selection**
   - Fund: Select from dropdown (e.g., "Stonecrest Direct Lending Fund III")
   - Vehicle: Select from dropdown
   - Share Class: Select from dropdown
   - Click "Next"

2. **Step 2 - Document Upload**
   - Click "Load Sample Document" to populate sample text
   - OR paste your own subscription agreement
   - Click "Extract Information"
   - Wait 2-5 seconds for AI to process

3. **Step 3 - Review & Confirm**
   - Review all extracted fields
   - Check confidence badges (HIGH/MEDIUM/LOW)
   - Click on "Source" to see document excerpt
   - Edit any incorrect fields
   - Click "Confirm & Create Commitment"

4. **Step 4 - Success**
   - See confirmation with commitment details
   - Click "View Commitment" to see the record
   - Or click "Create Another" to onboard more LPs

## Key Features

### Confidence Badges
- **GREEN (HIGH):** Directly stated in document - can accept as-is
- **AMBER (MEDIUM):** Inferred from context - review before confirming
- **RED (LOW):** Uncertain - should edit or verify

### Sample Document
A realistic subscription agreement example is built-in:
- Subscriber: Pacific Rim Capital Partners LP
- Amount: $75,000,000
- Share Class: Class A
- Close: First Close
- Contact: James Nakamura (j.nakamura@pacificrimcapital.com)

### Editable Fields
All extracted fields can be edited in Step 3:
- LP information (name, type)
- Investing entity details (legal name, type, domicile, tax ID)
- Investment terms (amount, share class, close number)
- Contact information (name, title, email)
- Special terms and notes

## Extracted Fields

The AI extracts these fields from subscription documents:

| Field | Type | Example |
|-------|------|---------|
| lp_name | string | Pacific Rim Capital Partners LP |
| lp_type | enum | pension, endowment, family_office, etc. |
| investing_entity_legal_name | string | Pacific Rim Capital Management LLC |
| investing_entity_type | enum | LP, LLC, trust, corporation |
| investing_entity_domicile | string | Delaware, United States |
| tax_id | string | 84-7654321 |
| commitment_amount | number | 75000000 |
| share_class | string | Class A |
| close_number | enum | first, second, third, final |
| contact_name | string | James Nakamura |
| contact_title | string | Managing Director, Private Credit |
| contact_email | string | j.nakamura@pacificrimcapital.com |
| special_terms | string | Any side letter modifications |
| notes | string | Additional observations |

## What Gets Created

When you confirm and create a commitment, the system creates:

1. **Limited Partner (if new)**
   - Name and type
   - Status: active

2. **Investing Entity (if new)**
   - Legal name, type, domicile
   - Tax ID
   - Linked to LP
   - AML/KYC status: pending
   - Subscription status: in_progress

3. **Contact (if info provided)**
   - Name, title, email
   - Role: operations
   - Linked to LP

4. **Commitment**
   - Amount and currency (USD)
   - Share class
   - Close number
   - Status: hard
   - Linked to investing entity and vehicle

5. **Document Record**
   - Subscription agreement metadata
   - Linked to commitment

6. **Side Letter (if special terms)**
   - Special terms text
   - Linked to commitment

## Common Issues & Solutions

### "API key required" Error
- Make sure you entered and set your API key
- Check that it's a valid Anthropic API key (starts with sk-ant-)

### Extraction Failed / No Response
- Check that document text is not empty
- Ensure API key has API access (not just billing)
- Check console for error messages
- Try with the sample document first

### Fund/Vehicle Dropdown Empty
- Backend may not be running (check http://localhost:3001/health)
- Database may need sample data
- Check backend console for errors

### Created Commitment Not Showing
- Backend stores in mock in-memory database
- Data will be lost on server restart
- Check browser console for POST errors

## API Endpoints Called

The frontend makes these API calls:

```
GET  http://localhost:3001/api/funds
GET  http://localhost:3001/api/investment-vehicles?fund_id=<id>
GET  http://localhost:3001/api/investment-vehicles/<id>/share-classes
POST http://localhost:3001/api/oms/extract
POST http://localhost:3001/api/oms/confirm
```

## Performance Tips

1. **Faster extractions:** Use shorter, cleaner documents
2. **Fewer errors:** Ensure document has clear sections for each field
3. **Batch processing:** Current system does one document at a time
4. **API cost:** ~$0.0005 per extraction (very cheap)

## Next Steps

1. Extract a few sample documents
2. Review accuracy and confidence levels
3. Test with real subscription agreements
4. Integrate database persistence
5. Add PDF upload support
6. Implement multi-user authentication

## Files to Know

- **Backend routes:** `/backend/src/routes/oms.ts`
- **Frontend page:** `/frontend/src/pages/oms/OMSPage.tsx`
- **Styles:** `/frontend/src/pages/oms/OMSPage.css`
- **Detailed docs:** `/OMS_IMPLEMENTATION.md`

## Need Help?

- Check browser console for JavaScript errors: F12 → Console tab
- Check backend console for API errors (running in terminal)
- See `/OMS_IMPLEMENTATION.md` for detailed documentation
- Review inline code comments in OMSPage.tsx and oms.ts

---

**Ready to go!** Start with http://localhost:5173/oms and "Load Sample Document" to test the full flow.
