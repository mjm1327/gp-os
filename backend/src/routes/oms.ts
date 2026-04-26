import express, { Router, Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';

const router: Router = express.Router();

interface ExtractedField {
  value: string | number | null;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  source_text: string | null;
}

interface ExtractedSubscriptionData {
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

const EXTRACTION_PROMPT = `You are analyzing a subscription document for a private fund investment. Extract the following information and return as JSON.

For each field, include:
- value: the extracted value (null if not found)
- confidence: "HIGH" (directly stated), "MEDIUM" (inferred), or "LOW" (uncertain/estimated)
- source_text: the exact text from the document that supports this extraction

Return this exact JSON structure:
{
  "lp_name": { "value": string|null, "confidence": string, "source_text": string|null },
  "lp_type": { "value": "pension"|"endowment"|"family_office"|"sovereign_wealth"|"foundation"|"insurance"|"fund_of_funds"|"other"|null, "confidence": string, "source_text": string|null },
  "investing_entity_legal_name": { "value": string|null, "confidence": string, "source_text": string|null },
  "investing_entity_type": { "value": "LP"|"LLC"|"trust"|"corporation"|"other"|null, "confidence": string, "source_text": string|null },
  "investing_entity_domicile": { "value": string|null, "confidence": string, "source_text": string|null },
  "tax_id": { "value": string|null, "confidence": string, "source_text": string|null },
  "commitment_amount": { "value": number|null, "confidence": string, "source_text": string|null },
  "share_class": { "value": string|null, "confidence": string, "source_text": string|null },
  "close_number": { "value": "first"|"second"|"third"|"final"|null, "confidence": string, "source_text": string|null },
  "contact_name": { "value": string|null, "confidence": string, "source_text": string|null },
  "contact_email": { "value": string|null, "confidence": string, "source_text": string|null },
  "contact_title": { "value": string|null, "confidence": string, "source_text": string|null },
  "special_terms": { "value": string|null, "confidence": string, "source_text": string|null },
  "notes": { "value": string|null, "confidence": string, "source_text": string|null }
}

Document text:
{DOCUMENT_TEXT}`;

router.post('/extract', async (req: Request, res: Response): Promise<void> => {
  try {
    const { document_text, fund_name, vehicle_name } = req.body;

    if (!document_text) {
      res.status(400).json({ error: 'document_text is required' });
      return;
    }

    const apiKey = req.headers['x-api-key'] as string;
    if (!apiKey) {
      res.status(400).json({ error: 'Anthropic API key required in x-api-key header' });
      return;
    }

    const client = new Anthropic({ apiKey });

    const prompt = EXTRACTION_PROMPT.replace('{DOCUMENT_TEXT}', document_text);

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: `${prompt}\n\nContext: This subscription is for ${fund_name || 'Unknown Fund'}, vehicle: ${vehicle_name || 'Unknown Vehicle'}`
        }
      ]
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

    // Parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      res.status(500).json({ error: 'Failed to parse AI response', raw_response: responseText });
      return;
    }

    const extracted: ExtractedSubscriptionData = JSON.parse(jsonMatch[0]);
    res.json({ extracted, raw_response: responseText });
  } catch (error) {
    console.error('OMS extraction error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

interface ConfirmRequest {
  fund_id: string;
  vehicle_id: string;
  share_class_id?: string;
  lp_name: string;
  lp_type?: string;
  investing_entity_legal_name: string;
  investing_entity_type?: string;
  investing_entity_domicile?: string;
  tax_id?: string;
  commitment_amount: number;
  close_number?: string;
  contact_name?: string;
  contact_email?: string;
  contact_title?: string;
  special_terms?: string;
  document_title?: string;
}

interface DatabaseResult {
  id: string;
  name?: string;
  legal_name?: string;
  commitment_amount?: number;
  [key: string]: any;
}

interface TransactionResult {
  lp: DatabaseResult;
  entity: DatabaseResult;
  commitment: DatabaseResult;
}

// Mock database for demonstration - in production, replace with actual DB
const mockDatabase = {
  limited_partners: new Map<string, DatabaseResult>(),
  investing_entities: new Map<string, DatabaseResult>(),
  commitments: new Map<string, DatabaseResult>(),
  contacts: new Map<string, DatabaseResult>(),
  documents: new Map<string, DatabaseResult>(),
  side_letters: new Map<string, DatabaseResult>()
};

let idCounter = 1000;

function generateId(): string {
  return `${Date.now()}-${++idCounter}`;
}

router.post('/confirm', (req: Request, res: Response): void => {
  const {
    fund_id,
    vehicle_id,
    share_class_id,
    lp_name,
    lp_type,
    investing_entity_legal_name,
    investing_entity_type,
    investing_entity_domicile,
    tax_id,
    commitment_amount,
    close_number,
    contact_name,
    contact_email,
    contact_title,
    special_terms,
    document_title
  } = req.body as ConfirmRequest;

  try {
    const result: TransactionResult = {
      lp: { id: '' },
      entity: { id: '' },
      commitment: { id: '' }
    };

    // 1. Find or create LP
    let lp = Array.from(mockDatabase.limited_partners.values()).find(
      (p: DatabaseResult) => p.name?.toLowerCase() === lp_name.toLowerCase()
    );

    if (!lp) {
      const lpId = generateId();
      lp = {
        id: lpId,
        name: lp_name,
        type: lp_type || 'other',
        status: 'active',
        created_at: new Date().toISOString()
      };
      mockDatabase.limited_partners.set(lpId, lp);
    }

    result.lp = lp;

    // 2. Find or create InvestingEntity
    let entity = Array.from(mockDatabase.investing_entities.values()).find(
      (e: DatabaseResult) =>
        e.legal_name?.toLowerCase() === investing_entity_legal_name.toLowerCase() &&
        e.lp_id === lp.id
    );

    if (!entity) {
      const entityId = generateId();
      entity = {
        id: entityId,
        lp_id: lp.id,
        legal_name: investing_entity_legal_name,
        entity_type: investing_entity_type || 'other',
        domicile: investing_entity_domicile || null,
        tax_id: tax_id || null,
        aml_kyc_status: 'pending',
        subscription_doc_status: 'in_progress',
        created_at: new Date().toISOString()
      };
      mockDatabase.investing_entities.set(entityId, entity);
    }

    result.entity = entity;

    // 3. Create contact if provided
    if (contact_name) {
      const existingContact = Array.from(mockDatabase.contacts.values()).find(
        (c: DatabaseResult) =>
          c.lp_id === lp.id && c.name?.toLowerCase() === contact_name.toLowerCase()
      );

      if (!existingContact) {
        const contactId = generateId();
        const contact = {
          id: contactId,
          lp_id: lp.id,
          name: contact_name,
          title: contact_title || null,
          email: contact_email || null,
          role: 'operations',
          created_at: new Date().toISOString()
        };
        mockDatabase.contacts.set(contactId, contact);
      }
    }

    // 4. Create commitment
    const commitmentId = generateId();
    const commitment: DatabaseResult = {
      id: commitmentId,
      investing_entity_id: entity.id,
      investment_vehicle_id: vehicle_id,
      share_class_id: share_class_id || null,
      commitment_amount: commitment_amount,
      close_number: close_number || 'first',
      currency: 'USD',
      status: 'hard',
      created_at: new Date().toISOString()
    };
    mockDatabase.commitments.set(commitmentId, commitment);

    result.commitment = commitment;

    // 5. Store document metadata
    if (document_title) {
      const docId = generateId();
      const doc = {
        id: docId,
        title: document_title,
        document_type: 'subscription_agreement',
        parent_entity_type: 'commitment',
        parent_entity_id: commitment.id,
        status: 'executed',
        uploaded_by: 'OMS Upload',
        created_at: new Date().toISOString()
      };
      mockDatabase.documents.set(docId, doc);
    }

    // 6. Store special terms note if any
    if (special_terms) {
      const sideLetterID = generateId();
      const sideLetter = {
        id: sideLetterID,
        commitment_id: commitment.id,
        investing_entity_id: entity.id,
        investment_vehicle_id: vehicle_id,
        other_modifications: special_terms,
        created_at: new Date().toISOString()
      };
      mockDatabase.side_letters.set(sideLetterID, sideLetter);
    }

    res.json({
      success: true,
      lp: result.lp,
      entity: result.entity,
      commitment: result.commitment
    });
  } catch (error) {
    console.error('OMS confirm error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
