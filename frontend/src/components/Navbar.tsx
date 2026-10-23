import React from 'react';
import {
  Cpu, LayoutDashboard, FlaskConical, Play,
  BarChart2, Scale, Layers, LineChart, Sparkles,
  History, BookOpen, Database
} from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const tabs = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'laboratory', label: 'Workload Laboratory', icon: FlaskConical },
    { id: 'traces', label: 'Trace Laboratory', icon: Database },
    { id: 'simulator', label: 'Scheduler Simulator', icon: Play },
    { id: 'comparison', label: 'Scheduler Comparison', icon: BarChart2 },
    { id: 'fairness', label: 'Fairness Laboratory', icon: Scale },
    { id: 'recommendation', label: 'Adaptive Recommendation', icon: Sparkles },
    { id: 'experiments', label: 'Experiment Studio', icon: Layers },
    { id: 'analytics', label: 'Research Analytics', icon: LineChart },
    { id: 'history', label: 'Experiment History', icon: History },
    { id: 'guide', label: 'Methodology Guide', icon: BookOpen },
  ];

  return (
    <header className="navbar">
      <div className="navbar-header">
        <div className="navbar-brand">
          <div className="brand-icon">
            <Cpu size={20} />
          </div>
          <div>
            <div className="brand-title">Adaptive OS Scheduling & Performance Platform</div>
            <div className="brand-subtitle">Operating Systems Research & Statistical Analysis Framework</div>
          </div>
        </div>
        <div>
          <span className="engine-status-badge">
            <span className="status-dot"></span>
            Authoritative C Engine Active
          </span>
        </div>
      </div>

      <nav className="navbar-tabs">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`nav-tab-${tab.id}`}
              className={`nav-tab ${isActive ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </header>
  );
};
