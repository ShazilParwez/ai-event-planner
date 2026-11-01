import React from 'react';
import { 
  LayoutDashboard, 
  DollarSign, 
  Clock, 
  Briefcase, 
  Users, 
  Lightbulb, 
  CalendarDays,
  ShieldCheck,
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onSelectTab }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'events', label: 'Events Hub', icon: CalendarDays },
    { id: 'accessibility', label: 'Accessibility Hub', icon: ShieldCheck },
    { id: 'budget', label: 'Budget Intelligence', icon: DollarSign },
    { id: 'timeline', label: 'Timeline & Schedule', icon: Clock },
    { id: 'vendors', label: 'Vendor Checklists', icon: Briefcase },
    { id: 'guests', label: 'Guest Roster', icon: Users },
    { id: 'inspiration', label: 'Inspiration Studio', icon: Lightbulb },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 min-h-[calc(100vh-4rem)] p-4 flex flex-col justify-between hidden md:flex">
      <nav className="space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-emerald-50 text-emerald-800 font-semibold'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-600' : 'text-slate-400'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-500">
        <p className="font-semibold text-slate-700">PromptWars Challenge 5</p>
        <p className="mt-0.5">Phase 1 Architecture Foundation</p>
      </div>
    </aside>
  );
};

