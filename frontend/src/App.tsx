import React, { useState } from 'react';
import { Navbar } from './components/Navbar';
import { OverviewPage } from './pages/OverviewPage';
import { WorkloadLaboratoryPage } from './pages/WorkloadLaboratoryPage';
import { TraceLabPage } from './pages/TraceLabPage';
import { SchedulerSimulatorPage } from './pages/SchedulerSimulatorPage';
import { SchedulerComparisonPage } from './pages/SchedulerComparisonPage';
import { FairnessLaboratoryPage } from './pages/FairnessLaboratoryPage';
import { ExperimentStudioPage } from './pages/ExperimentStudioPage';
import { ResearchAnalyticsPage } from './pages/ResearchAnalyticsPage';
import { AdaptiveRecommendationPage } from './pages/AdaptiveRecommendationPage';
import { ExperimentHistoryPage } from './pages/ExperimentHistoryPage';
import { MethodologyGuidePage } from './pages/MethodologyGuidePage';
import { ProcessItem, ExperimentItem } from './types';

// Default initial workload
const INITIAL_WORKLOAD: ProcessItem[] = [
  { pid: 1, arrival_time: 0, burst_time: 8, priority: 3 },
  { pid: 2, arrival_time: 1, burst_time: 4, priority: 1 },
  { pid: 3, arrival_time: 2, burst_time: 9, priority: 4 },
  { pid: 4, arrival_time: 3, burst_time: 5, priority: 2 },
  { pid: 5, arrival_time: 4, burst_time: 2, priority: 1 },
];

export function App() {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [currentProcesses, setCurrentProcesses] = useState<ProcessItem[]>(INITIAL_WORKLOAD);
  const [selectedExperiment, setSelectedExperiment] = useState<ExperimentItem | null>(null);

  const handleNavigate = (tab: string) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLoadWorkload = (procs: ProcessItem[]) => {
    setCurrentProcesses(procs);
  };

  return (
    <div className="app-container">
      <Navbar activeTab={activeTab} setActiveTab={handleNavigate} />

      <main className="main-content">
        {activeTab === 'overview' && (
          <OverviewPage onNavigate={handleNavigate} />
        )}

        {activeTab === 'laboratory' && (
          <WorkloadLaboratoryPage
            currentProcesses={currentProcesses}
            setCurrentProcesses={setCurrentProcesses}
            onNavigate={handleNavigate}
          />
        )}

        {activeTab === 'traces' && (
          <TraceLabPage
            onLoadWorkload={handleLoadWorkload}
            onNavigate={handleNavigate}
          />
        )}

        {activeTab === 'simulator' && (
          <SchedulerSimulatorPage
            currentProcesses={currentProcesses}
            onNavigate={handleNavigate}
          />
        )}

        {activeTab === 'comparison' && (
          <SchedulerComparisonPage
            currentProcesses={currentProcesses}
            onNavigate={handleNavigate}
          />
        )}

        {activeTab === 'fairness' && (
          <FairnessLaboratoryPage
            currentProcesses={currentProcesses}
            onNavigate={handleNavigate}
          />
        )}

        {activeTab === 'experiments' && (
          <ExperimentStudioPage
            onNavigate={handleNavigate}
            onSelectExperimentForAnalytics={(exp) => {
              setSelectedExperiment(exp);
            }}
          />
        )}

        {activeTab === 'analytics' && (
          <ResearchAnalyticsPage
            activeExperiment={selectedExperiment}
            onNavigate={handleNavigate}
          />
        )}

        {activeTab === 'recommendation' && (
          <AdaptiveRecommendationPage
            currentProcesses={currentProcesses}
            onNavigate={handleNavigate}
          />
        )}

        {activeTab === 'history' && (
          <ExperimentHistoryPage
            onLoadWorkload={handleLoadWorkload}
            onNavigate={handleNavigate}
          />
        )}

        {activeTab === 'guide' && (
          <MethodologyGuidePage />
        )}
      </main>

      <footer style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)', padding: '20px', textAlign: 'center', fontSize: '0.8rem', color: 'var(--navy-500)', marginTop: 'auto' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <strong>Adaptive OS CPU Scheduling Analysis Platform</strong> &bull; Authoritative C Engine &bull; FastAPI Backend &bull; React/TypeScript UI
          </div>
          <div>
            Single-CPU Scheduling Simulation &bull; Jain's Fairness &bull; Statistical Experimentation
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
