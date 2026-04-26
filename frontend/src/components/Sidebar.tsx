import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

interface SidebarItem {
  label: string;
  path: string;
  icon: string;
  children?: SidebarItem[];
}

const SIDEBAR_ITEMS: SidebarItem[] = [
  { label: 'Dashboard', path: '/', icon: '📊' },
  {
    label: 'Security Master',
    path: '/security-master',
    icon: '🏛️',
    children: [
      { label: 'Asset Classes', path: '/security-master/asset-classes' },
      { label: 'Funds', path: '/security-master/funds' },
      { label: 'Investment Vehicles', path: '/security-master/vehicles' },
    ],
  },
  {
    label: 'LP Management',
    path: '/lp-management',
    icon: '👥',
    children: [
      { label: 'Limited Partners', path: '/lp-management/partners' },
      { label: 'Contacts', path: '/lp-management/contacts' },
    ],
  },
  { label: 'Order Management', path: '/oms', icon: '📋' },
  { label: 'Deal Flow', path: '/deal-flow', icon: '📈' },
  { label: 'Portfolio Monitoring', path: '/portfolio', icon: '💼' },
  { label: 'Covenant Monitoring', path: '/covenants', icon: '⚖️' },
  { label: 'Tasks', path: '/tasks', icon: '✓' },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const location = useLocation();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (path: string) => {
    const newGroups = new Set(expandedGroups);
    if (newGroups.has(path)) {
      newGroups.delete(path);
    } else {
      newGroups.add(path);
    }
    setExpandedGroups(newGroups);
  };

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <div
      className="sidebar h-screen fixed left-0 top-0 overflow-y-auto overflow-x-hidden flex flex-col transition-all duration-200 z-20"
      style={{ width: collapsed ? '3.5rem' : '14rem' }}
    >
      {/* Header */}
      <div
        className={`border-b border-gray-700 flex items-center ${
          collapsed ? 'justify-center py-4 px-2' : 'justify-between px-5 py-5'
        }`}
      >
        {!collapsed && (
          <div>
            <h1 className="text-xl font-bold text-white">GP OS</h1>
            <p className="text-xs text-gray-400 mt-0.5">Stonecrest Capital</p>
          </div>
        )}
        <button
          onClick={onToggle}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="text-gray-400 hover:text-white transition-colors p-1 rounded focus:outline-none"
          style={{ flexShrink: 0 }}
        >
          {collapsed ? (
            // Right-pointing chevrons (expand)
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M7 4l5 5-5 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ) : (
            // Left-pointing chevrons (collapse)
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M11 4L6 9l5 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
      </div>

      {/* Nav */}
      <nav className="mt-4 flex-1">
        {SIDEBAR_ITEMS.map((item) => {
          const active = isActive(item.path);
          const expanded = expandedGroups.has(item.path);

          if (collapsed) {
            // Icon-only mode — show just the icon, full item is a link to the first child or the path
            const dest = item.children ? item.children[0].path : item.path;
            return (
              <Link
                key={item.path}
                to={dest}
                title={item.label}
                className={`sidebar-nav-item flex items-center justify-center px-0 ${active ? 'active' : ''}`}
                style={{ paddingLeft: 0, paddingRight: 0 }}
              >
                <span className="text-lg">{item.icon}</span>
              </Link>
            );
          }

          // Expanded mode
          if (item.children) {
            return (
              <div key={item.path}>
                <button
                  onClick={() => toggleGroup(item.path)}
                  className={`sidebar-nav-item w-full text-left flex items-center justify-between ${active ? 'active' : ''}`}
                >
                  <span className="flex items-center">
                    <span className="mr-3">{item.icon}</span>
                    {item.label}
                  </span>
                  <span className={`transition-transform text-xs ${expanded ? 'rotate-180' : ''}`}>▼</span>
                </button>
                {expanded && (
                  <div className="bg-sidebar-hover">
                    {item.children.map((child) => (
                      <Link
                        key={child.path}
                        to={child.path}
                        className={`sidebar-nav-item pl-12 block ${isActive(child.path) ? 'active' : ''}`}
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`sidebar-nav-item flex items-center ${active ? 'active' : ''}`}
            >
              <span className="mr-3">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
