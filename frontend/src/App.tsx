import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Pages
import Dashboard from './pages/Dashboard';
import AssetClasses from './pages/security-master/AssetClasses';
import Funds from './pages/security-master/Funds';
import FundDetail from './pages/security-master/FundDetail';
import InvestmentVehicles from './pages/security-master/InvestmentVehicles';
import LimitedPartners from './pages/crm/LimitedPartners';
import LPDetail from './pages/crm/LPDetail';
import Contacts from './pages/crm/Contacts';
import DealFlow from './pages/DealFlow';
import Portfolio from './pages/Portfolio';
import Documents from './pages/Documents';
import CapitalAccounting from './pages/CapitalAccounting';
import OMSPage from './pages/oms/OMSPage';
import PositionDetail from './pages/portfolio/PositionDetail';
import InvestorPortal from './pages/InvestorPortal';
import Tasks from './pages/Tasks';
import CovenantMonitoring from './pages/CovenantMonitoring';
import CovenantDetail from './pages/CovenantDetail';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/security-master/asset-classes" element={<AssetClasses />} />
          <Route path="/security-master/funds" element={<Funds />} />
          <Route path="/security-master/funds/:id" element={<FundDetail />} />
          <Route path="/security-master/vehicles" element={<InvestmentVehicles />} />
          <Route path="/lp-management/partners" element={<LimitedPartners />} />
          <Route path="/lp-management/partners/:id" element={<LPDetail />} />
          <Route path="/lp-management/contacts" element={<Contacts />} />
          <Route path="/deal-flow" element={<DealFlow />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/portfolio/positions/:id" element={<PositionDetail />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/capital" element={<CapitalAccounting />} />
          <Route path="/oms" element={<OMSPage />} />
          <Route path="/investor/:token" element={<InvestorPortal />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/covenants" element={<CovenantMonitoring />} />
          <Route path="/covenants/:id" element={<CovenantDetail />} />
        </Routes>
      </Router>
    </QueryClientProvider>
  );
}
