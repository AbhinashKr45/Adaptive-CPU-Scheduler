import React from 'react';
import { ProcessResultItem } from '../types';

interface ProcessTableProps {
  processes: ProcessResultItem[];
}

export const ProcessTable: React.FC<ProcessTableProps> = ({ processes }) => {
  if (!processes || processes.length === 0) {
    return <div className="empty-state">No process data available.</div>;
  }

  return (
    <div className="table-container">
      <table className="data-table">
        <thead>
          <tr>
            <th>PID</th>
            <th>Arrival Time</th>
            <th>Burst Time</th>
            <th>Priority</th>
            <th>First Start</th>
            <th>Completion</th>
            <th>Turnaround Time</th>
            <th>Response Time</th>
            <th>Waiting Time</th>
            <th>Executed Service</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {processes.map((p) => {
            const isCompleted = p.completion_time >= 0;
            return (
              <tr key={p.pid}>
                <td><strong>P{p.pid}</strong></td>
                <td>{p.arrival_time}</td>
                <td>{p.burst_time}</td>
                <td>
                  <span className="badge badge-gray">Pri {p.priority}</span>
                </td>
                <td>{p.start_time >= 0 ? p.start_time : '-'}</td>
                <td>{p.completion_time >= 0 ? p.completion_time : '-'}</td>
                <td><strong>{p.turnaround_time}</strong></td>
                <td>{p.response_time >= 0 ? p.response_time : '-'}</td>
                <td>{p.waiting_time}</td>
                <td>{p.executed_time} / {p.burst_time}</td>
                <td>
                  {isCompleted ? (
                    <span className="badge badge-green">Completed</span>
                  ) : (
                    <span className="badge badge-orange">Incomplete</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
