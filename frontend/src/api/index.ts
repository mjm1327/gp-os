import axios from 'axios';
import * as Types from '../types/index';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  }
});

// Health Check
export const checkHealth = async () => {
  return api.get('/health');
};

// Firms
export const getFirms = async () => {
  return api.get<Types.Firm[]>('/firms');
};

export const getFirmById = async (id: number) => {
  return api.get<Types.Firm>(`/firms/${id}`);
};

export const createFirm = async (firm: Types.Firm) => {
  return api.post<Types.Firm>('/firms', firm);
};

export const updateFirm = async (id: number, firm: Partial<Types.Firm>) => {
  return api.put<Types.Firm>(`/firms/${id}`, firm);
};

// Asset Classes
export const getAssetClasses = async () => {
  return api.get<Types.AssetClass[]>('/asset-classes');
};

export const getAssetClassById = async (id: number) => {
  return api.get<Types.AssetClass>(`/asset-classes/${id}`);
};

export const createAssetClass = async (assetClass: Types.AssetClass) => {
  return api.post<Types.AssetClass>('/asset-classes', assetClass);
};

export const createSubAssetClass = async (assetClassId: number, subClass: Types.SubAssetClass) => {
  return api.post<Types.SubAssetClass>(`/asset-classes/${assetClassId}/sub-classes`, subClass);
};

// Funds
export const getFunds = async () => {
  return api.get<Types.Fund[]>('/funds');
};

export const getFundById = async (id: number) => {
  return api.get<Types.Fund>(`/funds/${id}`);
};

export const createFund = async (fund: Types.Fund) => {
  return api.post<Types.Fund>('/funds', fund);
};

export const updateFund = async (id: number, fund: Partial<Types.Fund>) => {
  return api.put<Types.Fund>(`/funds/${id}`, fund);
};

export const createShareClass = async (fundId: number, data: Partial<Types.ShareClass>) => {
  return api.post<Types.ShareClass>(`/funds/${fundId}/share-classes`, data);
};

export const updateShareClass = async (fundId: number, scId: number, data: Partial<Types.ShareClass>) => {
  return api.put<Types.ShareClass>(`/funds/${fundId}/share-classes/${scId}`, data);
};

export const createVehicle = async (fundId: number, data: Partial<Types.InvestmentVehicle>) => {
  return api.post<Types.InvestmentVehicle>(`/funds/${fundId}/vehicles`, data);
};

export const createFundDocument = async (fundId: number, data: Partial<Types.Document>) => {
  return api.post<Types.Document>(`/funds/${fundId}/documents`, data);
};

// Investment Vehicles
export const getInvestmentVehicles = async () => {
  return api.get<Types.InvestmentVehicle[]>('/investment-vehicles');
};

export const getInvestmentVehicleById = async (id: number) => {
  return api.get<Types.InvestmentVehicle>(`/investment-vehicles/${id}`);
};

export const createInvestmentVehicle = async (vehicle: Types.InvestmentVehicle) => {
  return api.post<Types.InvestmentVehicle>('/investment-vehicles', vehicle);
};

export const updateInvestmentVehicle = async (id: number, vehicle: Partial<Types.InvestmentVehicle>) => {
  return api.put<Types.InvestmentVehicle>(`/investment-vehicles/${id}`, vehicle);
};

// Limited Partners
export const getLimitedPartners = async () => {
  return api.get<Types.LimitedPartner[]>('/limited-partners');
};

export const getLimitedPartnerById = async (id: number) => {
  return api.get<Types.LimitedPartner>(`/limited-partners/${id}`);
};

export const createLimitedPartner = async (partner: Types.LimitedPartner) => {
  return api.post<Types.LimitedPartner>('/limited-partners', partner);
};

export const updateLimitedPartner = async (id: number, partner: Partial<Types.LimitedPartner>) => {
  return api.put<Types.LimitedPartner>(`/limited-partners/${id}`, partner);
};

// Investing Entities
export const getInvestingEntities = async () => {
  return api.get<Types.InvestingEntity[]>('/investing-entities');
};

export const getInvestingEntityById = async (id: number) => {
  return api.get<Types.InvestingEntity>(`/investing-entities/${id}`);
};

export const createInvestingEntity = async (entity: Types.InvestingEntity) => {
  return api.post<Types.InvestingEntity>('/investing-entities', entity);
};

export const updateInvestingEntity = async (id: number, entity: Partial<Types.InvestingEntity>) => {
  return api.put<Types.InvestingEntity>(`/investing-entities/${id}`, entity);
};

// Contacts
export const getContacts = async () => {
  return api.get<Types.Contact[]>('/contacts');
};

export const getContactById = async (id: number) => {
  return api.get<Types.Contact>(`/contacts/${id}`);
};

export const createContact = async (contact: Types.Contact) => {
  return api.post<Types.Contact>('/contacts', contact);
};

export const updateContact = async (id: number, contact: Partial<Types.Contact>) => {
  return api.put<Types.Contact>(`/contacts/${id}`, contact);
};

// Deals
export const getDeals = async () => {
  return api.get<Types.Deal[]>('/deals');
};

export const getDealById = async (id: number) => {
  return api.get<Types.Deal>(`/deals/${id}`);
};

export const createDeal = async (deal: Types.Deal) => {
  return api.post<Types.Deal>('/deals', deal);
};

export const updateDeal = async (id: number, deal: Partial<Types.Deal>) => {
  return api.put<Types.Deal>(`/deals/${id}`, deal);
};

// Portfolio
export const getPortfolioSummary = async () => {
  return api.get('/portfolio/summary');
};

export const getPortfolioOverview = async () => {
  return api.get('/portfolio/overview');
};

export const getPositions = async (fundId?: number) => {
  return api.get<Types.Position[]>('/portfolio', { params: fundId ? { fund_id: fundId } : {} });
};

export const getPositionDetail = async (id: number) => {
  return api.get(`/portfolio/positions/${id}`);
};

export const getPositionsByDeal = async (dealId: number) => {
  return api.get<Types.Position[]>(`/portfolio/deal/${dealId}`);
};

export const createPosition = async (position: Types.Position) => {
  return api.post<Types.Position>('/portfolio', position);
};

export const updatePosition = async (id: number, position: Partial<Types.Position>) => {
  return api.put<Types.Position>(`/portfolio/${id}`, position);
};

export const getPortfolioMetrics = async (dealId: number) => {
  return api.get<Types.PortfolioMetric[]>(`/portfolio/metrics/${dealId}`);
};

export const analyzePortfolio = async (question: string, apiKey: string, fundId?: number) => {
  return api.post('/portfolio/analyze', { question, fund_id: fundId }, {
    headers: { 'x-api-key': apiKey },
  });
};

// Capital Accounting
export const getCapitalSummary = async () => {
  return api.get('/capital-accounting/summary');
};

export const getCapitalCalls = async () => {
  return api.get<Types.CapitalCall[]>('/capital-accounting/calls');
};

export const getCapitalCallById = async (id: number) => {
  return api.get<Types.CapitalCall>(`/capital-accounting/call/${id}`);
};

export const createCapitalCall = async (call: Types.CapitalCall) => {
  return api.post<Types.CapitalCall>('/capital-accounting/call', call);
};

export const getDistributions = async () => {
  return api.get<Types.Distribution[]>('/capital-accounting/distributions');
};

export const getDistributionById = async (id: number) => {
  return api.get<Types.Distribution>(`/capital-accounting/distribution/${id}`);
};

export const createDistribution = async (distribution: Types.Distribution) => {
  return api.post<Types.Distribution>('/capital-accounting/distribution', distribution);
};

export const getFundNAV = async (vehicleId: number) => {
  return api.get<Types.FundNAV>(`/capital-accounting/nav/${vehicleId}`);
};

// Dashboard
export const getDashboardFunds = async () => {
  return api.get('/dashboard/funds');
};
