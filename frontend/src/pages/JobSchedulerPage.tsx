import React, { useState } from 'react';
import {
  Clock,
  Play,
  RotateCw,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Layers,
  Terminal,
  Server,
  Activity,
  History,
} from 'lucide-react';
import { StatusBadge } from '../components/common/StatusBadge';

interface ScheduledJob {
  id: string;
  name: string;
  category: 'Telemetry Discovery' | 'Directory Sync' | 'Hardware Lifecycle' | 'Compliance Audit';
  schedule: string;
  last_run: string;
  duration_seconds: number;
  status: 'Idle' | 'Running' | 'Scheduled' | 'Paused';
  last_result: 'Success' | 'Warning' | 'Error';
  records_processed: number;
  next_run: string;
  description: string;
}

const INITIAL_JOBS: ScheduledJob[] = [
  {
    id: 'JOB-01',
    name: 'BigFix Endpoint Telemetry Collector',
    category: 'Telemetry Discovery',
    schedule: 'Every 30 minutes',
    last_run: '2026-10-10T03:30:00Z',
    duration_seconds: 14.2,
    status: 'Idle',
    last_result: 'Success',
    records_processed: 1240,
    next_run: '2026-10-10T04:00:00Z',
    description: 'Polls BigFix REST API for newly checked-in Windows/Linux desktops and datacenter nodes.',
  },
  {
    id: 'JOB-02',
    name: 'Jamf Pro Cloud Inventory Ingestion',
    category: 'Telemetry Discovery',
    schedule: 'Every 30 minutes',
    last_run: '2026-10-10T03:30:00Z',
    duration_seconds: 8.7,
    status: 'Idle',
    last_result: 'Success',
    records_processed: 680,
    next_run: '2026-10-10T04:00:00Z',
    description: 'Syncs enrolled macOS hardware attributes, FileVault states, and primary logged-in usernames.',
  },
  {
    id: 'JOB-03',
    name: 'Workday HCM Personnel Directory Delta',
    category: 'Directory Sync',
    schedule: 'Daily at 01:00 UTC',
    last_run: '2026-10-10T01:00:00Z',
    duration_seconds: 45.1,
    status: 'Idle',
    last_result: 'Success',
    records_processed: 14200,
    next_run: '2026-10-11T01:00:00Z',
    description: 'Ingests active employee status, manager hierarchy, department codes, and terminations.',
  },
  {
    id: 'JOB-04',
    name: 'OEM Hardware Lifecycle & EOL Warranty Probe',
    category: 'Hardware Lifecycle',
    schedule: 'Daily at 04:00 UTC',
    last_run: '2026-10-09T04:00:00Z',
    duration_seconds: 112.5,
    status: 'Idle',
    last_result: 'Success',
    records_processed: 1920,
    next_run: '2026-10-10T04:00:00Z',
    description: 'Queries Apple, Dell, Lenovo, and HP warranty APIs to refresh calculated EOL obsolescence dates.',
  },
  {
    id: 'JOB-05',
    name: 'Audit Exception & Anomaly Detector',
    category: 'Compliance Audit',
    schedule: 'Every 2 hours',
    last_run: '2026-10-10T02:00:00Z',
    duration_seconds: 22.0,
    status: 'Idle',
    last_result: 'Warning',
    records_processed: 1920,
    next_run: '2026-10-10T04:00:00Z',
    description: 'Cross-correlates asset logins with Workday terminations and flags unmapped root/contractor accounts.',
  },
];

export const JobSchedulerPage: React.FC = () => {
  const [jobs, setJobs] = useState<ScheduledJob[]>(INITIAL_JOBS);
  const [runningJobId, setRunningJobId] = useState<string | null>(null);
  const [logModalJob, setLogModalJob] = useState<ScheduledJob | null>(null);

  const handleRunNow = (jobId: string) => {
    setRunningJobId(jobId);
    setJobs(prev =>
      prev.map(j => (j.id === jobId ? { ...j, status: 'Running' as const } : j))
    );

    setTimeout(() => {
      setJobs(prev =>
        prev.map(j => {
          if (j.id === jobId) {
            return {
              ...j,
              status: 'Idle' as const,
              last_run: new Date().toISOString(),
              last_result: 'Success' as const,
              records_processed: j.records_processed + Math.floor(Math.random() * 5),
            };
          }
          return j;
        })
      );
      setRunningJobId(null);
    }, 1800);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-4 bg-white rounded-lg border border-slate-200">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-50 text-blue-700 rounded-lg shrink-0 mt-0.5">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Enterprise Job Scheduler &amp; Sync Engines
            </h2>
            <p className="text-xs text-slate-600 mt-1 max-w-3xl leading-relaxed">
              Manages automated data pipelines between BigFix, Jamf Pro Cloud, Workday HCM, and OEM warranty databases. Real-time run telemetry and on-demand trigger dispatch.
            </p>
          </div>
        </div>
      </div>

      {/* Summary KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="p-4 bg-white rounded-lg border border-slate-200">
          <span className="text-xs font-semibold text-slate-500 block mb-1">Active Automated Pipelines</span>
          <span className="text-2xl font-bold font-mono text-slate-900 tabular-nums">{jobs.length}</span>
          <span className="text-[11px] text-slate-400 block mt-1">Configured schedulers</span>
        </div>

        <div className="p-4 bg-white rounded-lg border border-slate-200">
          <span className="text-xs font-semibold text-slate-500 block mb-1">Last Sync Cycle</span>
          <span className="text-2xl font-bold font-mono text-slate-900 tabular-nums">100% OK</span>
          <span className="text-[11px] text-emerald-600 block mt-1">No fatal pipeline failures</span>
        </div>

        <div className="p-4 bg-white rounded-lg border border-slate-200">
          <span className="text-xs font-semibold text-slate-500 block mb-1">Total Records Synced Today</span>
          <span className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
            {jobs.reduce((acc, j) => acc + j.records_processed, 0).toLocaleString()}
          </span>
          <span className="text-[11px] text-slate-400 block mt-1">Across 5 connectors</span>
        </div>

        <div className="p-4 bg-white rounded-lg border border-slate-200">
          <span className="text-xs font-semibold text-slate-500 block mb-1">Next Scheduled Execution</span>
          <span className="text-base font-bold font-mono text-blue-700 truncate block mt-1">
            04:00 UTC (Next sync)
          </span>
          <span className="text-[11px] text-slate-400 block mt-1">Automated cron daemon</span>
        </div>
      </div>

      {/* Jobs Table */}
      <div className="p-3 sm:p-5 bg-white rounded-lg border border-slate-200 space-y-4 shadow-2xs w-full">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Configured Synchronization Tasks</h3>
            <p className="text-xs text-slate-500">Autonomous ingestion engines and policy reconciliation cron jobs</p>
          </div>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold select-none text-[11px] sm:text-xs">
              <tr>
                <th className="py-2.5 px-2 sm:px-3">Job Name &amp; Connector</th>
                <th className="py-2.5 px-2 sm:px-3">Schedule Cadence</th>
                <th className="py-2.5 px-2 sm:px-3">Status</th>
                <th className="py-2.5 px-2 sm:px-3">Last Result</th>
                <th className="py-2.5 px-2 sm:px-3">Records Ingested</th>
                <th className="py-2.5 px-2 sm:px-3">Last Run Time</th>
                <th className="py-2.5 px-2 sm:px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {jobs.map(job => (
                <tr key={job.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-3">
                    <div className="font-semibold text-slate-900">{job.name}</div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">{job.description}</div>
                  </td>

                  <td className="py-3 px-3">
                    <span className="font-medium text-slate-800">{job.schedule}</span>
                    <span className="block text-[10px] text-slate-400 font-mono">Next: {new Date(job.next_run).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </td>

                  <td className="py-3 px-3 whitespace-nowrap">
                    {job.status === 'Running' ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                        <RotateCw className="w-3 h-3 animate-spin text-blue-600" />
                        <span>Running...</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                        <span>Idle (Standby)</span>
                      </span>
                    )}
                  </td>

                  <td className="py-3 px-3 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${
                        job.last_result === 'Success'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}
                    >
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>{job.last_result} ({job.duration_seconds}s)</span>
                    </span>
                  </td>

                  <td className="py-3 px-3 font-mono text-slate-900 font-semibold tabular-nums">
                    {job.records_processed.toLocaleString()}
                  </td>

                  <td className="py-3 px-3 font-mono text-slate-500 tabular-nums">
                    {new Date(job.last_run).toLocaleTimeString()}
                  </td>

                  <td className="py-3 px-3 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setLogModalJob(job)}
                        className="p-1 text-slate-500 hover:text-slate-800 rounded hover:bg-slate-100"
                        title="View Execution Logs"
                      >
                        <Terminal className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleRunNow(job.id)}
                        disabled={runningJobId === job.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded transition-colors shadow-2xs"
                      >
                        <Play className="w-3 h-3" />
                        <span>Run Now</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log modal */}
      {logModalJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-xl w-full border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-bold text-slate-900">Execution Logs: {logModalJob.name}</h3>
              </div>
              <button
                onClick={() => setLogModalJob(null)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            </div>
            <div className="p-4 bg-slate-900 text-slate-200 font-mono text-[11px] h-64 overflow-y-auto space-y-1">
              <p className="text-slate-400">[2026-10-10 03:30:00 UTC] Starting scheduler worker daemon for {logModalJob.id}...</p>
              <p className="text-emerald-400">[2026-10-10 03:30:01 UTC] Auth handshake established with upstream API connector.</p>
              <p className="text-slate-300">[2026-10-10 03:30:04 UTC] Ingesting pagination payload (delta token: sync_v2_9941)...</p>
              <p className="text-slate-300">[2026-10-10 03:30:10 UTC] Extracted {logModalJob.records_processed} hardware &amp; identity telemetry records.</p>
              <p className="text-emerald-400">[2026-10-10 03:30:14 UTC] Reconciled database entities. Transaction committed successfully.</p>
              <p className="text-blue-400">[2026-10-10 03:30:14 UTC] Job execution completed in {logModalJob.duration_seconds}s. Next run scheduled for {new Date(logModalJob.next_run).toUTCString()}.</p>
            </div>
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 text-right">
              <button
                onClick={() => setLogModalJob(null)}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
