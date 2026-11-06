
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  acknowledgeAlert,
  getAlerts,
  getAlertSummary,
  getAlertSettings,
  getAgents,
  updateAlertSettings,
  type AgentAlert,
  type AlertSummary,
  type AlertSettings,
  type Agent,
} from "@/lib/api";

const initialSummary: AlertSummary = {
  total: 0,
  active: 0,
  acknowledged: 0,
  resolved: 0,
  critical_active: 0,
  warning_active: 0,
};

const initialSettings: AlertSettings = {
  warning_threshold: 20,
  critical_threshold: 40,
  min_completed_tasks: 4,
};

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-red-500/10 text-red-400 border-red-500/20",
    acknowledged: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    resolved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  };

  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-medium ${styles[status] || ""}`}>
      {status}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const critical = severity === "critical";

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${
        critical
          ? "bg-red-500/10 text-red-400"
          : "bg-amber-500/10 text-amber-400"
      }`}
    >
      {severity.toUpperCase()}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  description,
  color,
}: {
  label: string;
  value: number;
  description: string;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <p className="text-sm text-zinc-400">{label}</p>
      <p className={`mt-3 text-3xl font-bold ${color}`}>{value}</p>
      <p className="mt-2 text-xs text-zinc-500">{description}</p>
    </div>
  );
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AgentAlert[]>([]);
  const [summary, setSummary] = useState(initialSummary);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [settings, setSettings] = useState(initialSettings);

  const [statusFilter, setStatusFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [agentFilter, setAgentFilter] = useState("all");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [alertData, summaryData, agentData, settingsData] =
        await Promise.all([
          getAlerts(),
          getAlertSummary(),
          getAgents(),
          getAlertSettings(),
        ]);

      setAlerts(alertData);
      setSummary(summaryData);
      setAgents(agentData);
      setSettings(settingsData);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load alerts",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      const statusMatch =
        statusFilter === "all" || alert.status === statusFilter;

      const severityMatch =
        severityFilter === "all" || alert.severity === severityFilter;

      const agentMatch =
        agentFilter === "all" || alert.agent_id === agentFilter;

      return statusMatch && severityMatch && agentMatch;
    });
  }, [alerts, statusFilter, severityFilter, agentFilter]);

  const agentNames = useMemo(() => {
    return Object.fromEntries(
      agents.map((agent) => [agent.id, agent.name]),
    );
  }, [agents]);

  async function handleAcknowledge(alertId: string) {
    try {
      setAcknowledgingId(alertId);
      setError("");
      setSuccess("");

      await acknowledgeAlert(alertId);

      setSuccess("Alert acknowledged successfully.");
      await loadDashboard();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to acknowledge alert",
      );
    } finally {
      setAcknowledgingId(null);
    }
  }

  async function handleSaveSettings(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const result = await updateAlertSettings(settings);

      setSettings(result.settings);
      setSuccess(result.message);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save settings",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#09090b] px-5 py-8 text-white md:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-medium text-red-400">
              MONITORING CENTER
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">
              Agent Alerts
            </h1>
            <p className="mt-2 text-sm text-zinc-400">
              Monitor agent failures and manage operational alerts.
            </p>
          </div>

          <button
            onClick={() => void loadDashboard()}
            disabled={loading}
            className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium transition hover:bg-white/10 disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "↻ Refresh"}
          </button>
        </header>

        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-400">
            {success}
          </div>
        )}

        <section>
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Alert overview</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Organization-wide alert statistics
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              label="Total alerts"
              value={summary.total}
              description="All recorded alerts"
              color="text-white"
            />
            <SummaryCard
              label="Active alerts"
              value={summary.active}
              description="Require attention"
              color="text-red-400"
            />
            <SummaryCard
              label="Critical alerts"
              value={summary.critical_active}
              description="Active critical incidents"
              color="text-red-500"
            />
            <SummaryCard
              label="Resolved alerts"
              value={summary.resolved}
              description="Successfully resolved"
              color="text-emerald-400"
            />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <SummaryCard
              label="Warning alerts"
              value={summary.warning_active}
              description="Active warning incidents"
              color="text-amber-400"
            />
            <SummaryCard
              label="Acknowledged alerts"
              value={summary.acknowledged}
              description="Already reviewed by your team"
              color="text-blue-400"
            />
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
          <div className="mb-5">
            <h2 className="text-lg font-semibold">Alert history</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Review and acknowledge agent incidents.
            </p>
          </div>

          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-white/10 bg-[#111114] px-4 py-3 text-sm text-white outline-none"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="resolved">Resolved</option>
            </select>

            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="rounded-xl border border-white/10 bg-[#111114] px-4 py-3 text-sm text-white outline-none"
            >
              <option value="all">All severities</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>

            <select
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              className="rounded-xl border border-white/10 bg-[#111114] px-4 py-3 text-sm text-white outline-none"
            >
              <option value="all">All agents</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="py-16 text-center text-sm text-zinc-500">
              Loading alerts...
            </div>
          ) : filteredAlerts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 py-16 text-center">
              <p className="text-lg font-medium text-zinc-300">
                No alerts found
              </p>
              <p className="mt-2 text-sm text-zinc-500">
                No alerts match your selected filters.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAlerts.map((alert) => (
                <article
                  key={alert.id}
                  className="rounded-xl border border-white/10 bg-white/[0.02] p-4 transition hover:bg-white/[0.04] md:p-5"
                >
                  <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <SeverityBadge severity={alert.severity} />
                        <StatusBadge status={alert.status} />
                      </div>

                      <h3 className="mt-3 font-semibold text-zinc-100">
                        {alert.title}
                      </h3>

                      <p className="mt-2 text-sm leading-6 text-zinc-400">
                        {alert.message}
                      </p>

                      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-zinc-500">
                        <span>
                          Agent: {agentNames[alert.agent_id] || "Unknown agent"}
                        </span>

                        <span>
                          Failure rate: {alert.failure_rate ?? "N/A"}%
                        </span>

                        <span>
                          Threshold: {alert.threshold ?? "N/A"}%
                        </span>

                        <span>
                          Created: {formatDate(alert.created_at)}
                        </span>
                      </div>

                      {alert.acknowledged_at && (
                        <p className="mt-2 text-xs text-blue-400">
                          Acknowledged: {formatDate(alert.acknowledged_at)}
                        </p>
                      )}

                      {alert.resolved_at && (
                        <p className="mt-2 text-xs text-emerald-400">
                          Resolved: {formatDate(alert.resolved_at)}
                        </p>
                      )}
                    </div>

                    {alert.status === "active" && (
                      <button
                        onClick={() => void handleAcknowledge(alert.id)}
                        disabled={acknowledgingId === alert.id}
                        className="shrink-0 rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-2.5 text-sm font-medium text-blue-400 transition hover:bg-blue-500/20 disabled:opacity-50"
                      >
                        {acknowledgingId === alert.id
                          ? "Acknowledging..."
                          : "Acknowledge"}
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}

          <p className="mt-5 text-xs text-zinc-500">
            Showing {filteredAlerts.length} of {alerts.length} alerts
          </p>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold">Alert configuration</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Configure organization-wide failure-rate thresholds.
            </p>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-5">
            <div className="grid gap-5 md:grid-cols-3">
              <label className="block">
                <span className="mb-2 block text-sm text-zinc-300">
                  Warning threshold (%)
                </span>
                <input
                  type="number"
                  min="0.01"
                  max="99"
                  step="0.01"
                  required
                  value={settings.warning_threshold}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      warning_threshold: Number(e.target.value),
                    })
                  }
                  className="w-full rounded-xl border border-white/10 bg-[#111114] px-4 py-3 text-white outline-none focus:border-amber-500/50"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm text-zinc-300">
                  Critical threshold (%)
                </span>
                <input
                  type="number"
                  min="0.01"
                  max="100"
                  step="0.01"
                  required
                  value={settings.critical_threshold}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      critical_threshold: Number(e.target.value),
                    })
                  }
                  className="w-full rounded-xl border border-white/10 bg-[#111114] px-4 py-3 text-white outline-none focus:border-red-500/50"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm text-zinc-300">
                  Minimum completed tasks
                </span>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  step="1"
                  required
                  value={settings.min_completed_tasks}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      min_completed_tasks: Number(e.target.value),
                    })
                  }
                  className="w-full rounded-xl border border-white/10 bg-[#111114] px-4 py-3 text-white outline-none focus:border-purple-500/50"
                />
              </label>
            </div>

            <div className="flex flex-col justify-between gap-4 border-t border-white/10 pt-5 sm:flex-row sm:items-center">
              <p className="text-xs text-zinc-500">
                Warning must be lower than Critical. Saving requires owner or admin permissions.
              </p>

              <button
                type="submit"
                disabled={
                  saving ||
                  settings.warning_threshold <= 0 ||
                  settings.warning_threshold >= settings.critical_threshold ||
                  settings.critical_threshold > 100 ||
                  settings.min_completed_tasks < 1
                }
                className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving ? "Saving..." : "Save configuration"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
