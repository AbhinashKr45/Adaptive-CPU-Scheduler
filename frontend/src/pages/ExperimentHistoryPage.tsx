import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { ExperimentItem, ProcessItem } from '../types';
import {
  History, Trash2, Download, Play, Search,
  Eye, RefreshCw, FileText
} from 'lucide-react';

interface ExperimentHistoryProps {
  onLoadWorkload: (processes: ProcessItem[]) => void;
  onNavigate: (tab: string) => void;
}

export const ExperimentHistoryPage: React.FC<ExperimentHistoryProps> = ({
  onLoadWorkload,
  onNavigate
}) => {
  const [activeTab, setActiveTab] = useState<'simulations' | 'experiments'>('simulations');
  const [simulations, setSimulations] = useState<any[]>([]);
  const [experiments, setExperiments] = useState<ExperimentItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedSim, setSelectedSim] = useState<any | null>(null);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'simulations') {
        const sims = await api.listHistorySimulations(100);
        setSimulations(sims);
      } else {
        const exps = await api.listExperiments();
        setExperiments(exps);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSimulation = async (id: number) => {
    try {
      await api.deleteHistorySimulation(id);
      setSimulations(simulations.filter(s => s.id !== id));
      if (selectedSim?.id === id) setSelectedSim(null);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteExperiment = async (id: number) => {
    try {
      await api.deleteExperiment(id);
      setExperiments(experiments.filter(e => e.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const handleInspectSim = async (id: number) => {
    try {
      const full = await api.getHistorySimulation(id);
      setSelectedSim(full);
    } catch (e) {
      console.error(e);
    }
  };

  const handleRerunWorkload = (procs: ProcessItem[]) => {
    onLoadWorkload(procs);
    onNavigate('simulator');
  };

  const filteredSims = simulations.filter(s =>
    s.workload_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.algorithm.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredExps = experiments.filter(e =>
    e.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--navy-900)' }}>
            Experiment & Simulation History
          </h1>
          <p style={{ color: 'var(--navy-600)', fontSize: '0.9rem', marginTop: 4 }}>
            Audit trail of all executed runs, reproducible parameters, and research artifacts.
          </p>
        </div>

        <button className="btn btn-secondary" onClick={loadData} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh History
        </button>
      </div>

      {/* Tabs & Search */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className={`btn btn-sm ${activeTab === 'simulations' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('simulations')}
          >
            Simulation Runs ({simulations.length})
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'experiments' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('experiments')}
          >
            Batch Experiments ({experiments.length})
          </button>
        </div>

        <div style={{ position: 'relative', width: 280 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--navy-400)' }} />
          <input
            type="text"
            className="form-control"
            placeholder="Search records..."
            style={{ paddingLeft: 30 }}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Simulations Table */}
      {activeTab === 'simulations' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Persisted Simulation Runs</div>
          </div>
          {filteredSims.length > 0 ? (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Workload Name</th>
                    <th>Algorithm</th>
                    <th>Processes</th>
                    <th>Avg Wait</th>
                    <th>Avg Turnaround</th>
                    <th>Makespan</th>
                    <th>Date / Time</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSims.map(s => (
                    <tr key={s.id}>
                      <td>#{s.id}</td>
                      <td><strong>{s.workload_name}</strong></td>
                      <td><span className="badge badge-blue">{s.algorithm} {s.quantum > 0 ? `(q=${s.quantum})` : ''}</span></td>
                      <td>{s.process_count} procs</td>
                      <td>{s.metrics.avg_waiting_time?.toFixed(2)}</td>
                      <td>{s.metrics.avg_turnaround_time?.toFixed(2)}</td>
                      <td>{s.metrics.makespan}</td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--navy-500)' }}>
                        {new Date(s.created_at).toLocaleString()}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleInspectSim(s.id)}
                            title="Inspect details"
                          >
                            <Eye size={12} /> Inspect
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDeleteSimulation(s.id)}
                            title="Delete run"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">No matching simulation records found.</div>
          )}
        </div>
      )}

      {/* Batch Experiments Table */}
      {activeTab === 'experiments' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Batch Experiment History</div>
          </div>
          {filteredExps.length > 0 ? (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Experiment Name</th>
                    <th>Schedulers Tested</th>
                    <th>Seeds Evaluated</th>
                    <th>Status</th>
                    <th>Timestamp</th>
                    <th style={{ textAlign: 'right' }}>Export / Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExps.map(e => (
                    <tr key={e.id}>
                      <td>#{e.id}</td>
                      <td><strong>{e.name}</strong></td>
                      <td>{e.schedulers?.join(', ')}</td>
                      <td>{e.seeds?.length} seeds</td>
                      <td><span className="badge badge-green">{e.status}</span></td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--navy-500)' }}>
                        {new Date(e.created_at).toLocaleString()}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          <a
                            href={api.getExperimentCsvUrl(e.id)}
                            className="btn btn-secondary btn-sm"
                            download
                            title="Download CSV"
                          >
                            <Download size={12} /> CSV
                          </a>
                          <a
                            href={api.getExperimentJsonUrl(e.id)}
                            className="btn btn-secondary btn-sm"
                            download
                            title="Download JSON"
                          >
                            <Download size={12} /> JSON
                          </a>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDeleteExperiment(e.id)}
                            title="Delete"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">No matching experiment records found.</div>
          )}
        </div>
      )}

      {/* Inspect Simulation Modal / Drawer */}
      {selectedSim && (
        <div className="card" style={{ borderLeft: '4px solid var(--blue-600)' }}>
          <div className="card-header">
            <div className="card-title">
              Inspect Simulation #{selectedSim.id}: {selectedSim.workload_name} ({selectedSim.algorithm})
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => handleRerunWorkload(selectedSim.processes)}
              >
                <Play size={12} /> Reload in Simulator
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setSelectedSim(null)}
              >
                Close
              </button>
            </div>
          </div>

          <div style={{ fontSize: '0.82rem', color: 'var(--navy-700)', marginBottom: 12 }}>
            Makespan: <strong>{selectedSim.metrics.makespan}</strong> | Busy: <strong>{selectedSim.metrics.total_busy_time}</strong> | Switches: <strong>{selectedSim.metrics.context_switches}</strong> | Preemptions: <strong>{selectedSim.metrics.preemptions}</strong> | Progress Fairness: <strong>{selectedSim.metrics.jain_fairness_progress?.toFixed(4)}</strong>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>PID</th>
                  <th>Arrival</th>
                  <th>Burst</th>
                  <th>First Start</th>
                  <th>Completion</th>
                  <th>Waiting</th>
                  <th>Turnaround</th>
                </tr>
              </thead>
              <tbody>
                {selectedSim.processes.map((p: any) => (
                  <tr key={p.pid}>
                    <td>P{p.pid}</td>
                    <td>{p.arrival_time}</td>
                    <td>{p.burst_time}</td>
                    <td>{p.start_time}</td>
                    <td>{p.completion_time}</td>
                    <td>{p.waiting_time}</td>
                    <td>{p.turnaround_time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
