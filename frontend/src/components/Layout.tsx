import { ReactNode, useState } from 'react';
import Sidebar from './Sidebar';
import IntelligenceDrawer from './IntelligenceDrawer';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      <main
        className="flex-1 overflow-auto bg-gray-50 transition-all duration-200"
        style={{ marginLeft: collapsed ? '3.5rem' : '14rem' }}
      >
        <div className="p-8">
          {children}
        </div>
      </main>
      <IntelligenceDrawer />
    </div>
  );
}
