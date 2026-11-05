"use client";

import { useEffect, useState } from "react";
import {
  getAnalyticsOverview,
  getAgentPerformance,
  getToolAnalytics,
  getRecentTasks,
  getExecutionTrends,
  getAgentHealth,
  type AnalyticsOverview,
  type AgentPerformance,
  type ToolAnalytics,
  type RecentTask,
  type ExecutionTrend,
  type AgentHealth,
  type AnalyticsDateRange,
} from "@/lib/api";

const initialOverview: AnalyticsOverview = {
  total_tasks: 0,
  completed_tasks: 0,
  failed_tasks: 0,
  active_tasks: 0,
  success_rate: 0,
  average_execution_seconds: 0,
};

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds.toFixed(1)} sec`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)} min`;
  return `${(seconds / 3600).toFixed(1)} hrs`;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    completed: "bg-emerald-500/10 text-emerald-600",
    failed: "bg-red-500/10 text-red-500",
    running: "bg-blue-500/10 text-blue-500",
    pending: "bg-amber-500/10 text-amber-600",
    waiting_approval: "bg-purple-500/10 text-purple-500",
  };

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-medium ${
        styles[status] || "bg-gray-500/10 text-gray-500"
      }`}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}

function HealthBadge({
  status,
}: {
  status: AgentHealth["health_status"];
}) {
  const styles: Record<AgentHealth["health_status"], string> = {
    healthy: "bg-emerald-500/10 text-emerald-600",
    attention: "bg-amber-500/10 text-amber-600",
    inactive: "bg-gray-500/10 text-gray-500",
    no_data: "bg-slate-500/10 text-slate-500",
  };

  const labels: Record<AgentHealth["health_status"], string> = {
    healthy: "Healthy",
    attention: "Attention",
    inactive: "Inactive",
    no_data: "No data",
  };

  return (
    <span
      className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${
        styles[status] || styles.no_data
      }`}
    >
      {labels[status] || status}
    </span>
  );
}

function HealthStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-gray-400">
        {label}
      </p>
      <p className={`mt-0.5 font-semibold ${tone || "text-gray-800 dark:text-gray-100"}`}>
        {value}
      </p>
    </div>
  );
}

function MetricCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string | number;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <p className="text-sm text-gray-500">{label}</p>
      <h2 className="mt-3 text-3xl font-bold tracking-tight">{value}</h2>
      <p className="mt-2 text-xs text-gray-400">{description}</p>
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Metric cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <div
            key={item}
            className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
          >
            <div className="h-4 w-28 rounded bg-gray-200 dark:bg-gray-700" />
            <div className="mt-4 h-9 w-20 rounded bg-gray-200 dark:bg-gray-700" />
            <div className="mt-3 h-3 w-36 rounded bg-gray-100 dark:bg-gray-800" />
          </div>
        ))}
      </div>

      {/* Analytics charts */}
      <div className="grid gap-6 xl:grid-cols-2">
        {[1, 2].map((item) => (
          <div
            key={item}
            className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900"
          >
            <div className="h-5 w-40 rounded bg-gray-200 dark:bg-gray-700" />
            <div className="mt-3 h-3 w-52 rounded bg-gray-100 dark:bg-gray-800" />

            <div className="mt-8 space-y-7">
              {[1, 2, 3].map((bar) => (
                <div key={bar}>
                  <div className="mb-3 h-3 w-32 rounded bg-gray-200 dark:bg-gray-700" />
                  <div className="h-2 w-full rounded-full bg-gray-100 dark:bg-gray-800" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Agent health */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <div className="h-5 w-40 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="mt-3 h-3 w-52 rounded bg-gray-100 dark:bg-gray-800" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-40 rounded-xl bg-gray-100 dark:bg-gray-800"
            />
          ))}
        </div>
      </div>

      {/* Recent executions */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <div className="h-5 w-44 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="mt-6 space-y-5">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="flex gap-4">
              <div className="h-4 flex-1 rounded bg-gray-100 dark:bg-gray-800" />
              <div className="h-4 w-24 rounded bg-gray-100 dark:bg-gray-800" />
              <div className="h-4 w-20 rounded bg-gray-100 dark:bg-gray-800" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [overview, setOverview] =
    useState<AnalyticsOverview>(initialOverview);

  const [agents, setAgents] = useState<AgentPerformance[]>([]);
  const [tools, setTools] = useState<ToolAnalytics[]>([]);
  const [recentTasks, setRecentTasks] = useState<RecentTask[]>([]);
  const [trends, setTrends] = useState<ExecutionTrend[]>([]);
  const [agentHealth, setAgentHealth] = useState<AgentHealth[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState("");

  const [dateRange, setDateRange] =
    useState<AnalyticsDateRange>(null);

  useEffect(() => {
    let active = true;

    async function loadAnalytics() {
      try {
        setLoading(true);
        setError("");

        const [
          overviewData,
          agentData,
          toolData,
          taskData,
          trendsData,
          healthData,
        ] = await Promise.all([
          getAnalyticsOverview(dateRange),
          getAgentPerformance(dateRange),
          getToolAnalytics(dateRange),
          getRecentTasks(dateRange),
          getExecutionTrends(dateRange),
          getAgentHealth(dateRange),
        ]);

        if (!active) return;

        setOverview(overviewData);
        setAgents(agentData);
        setTools(toolData);
        setRecentTasks(taskData);
        setTrends(trendsData);
        setAgentHealth(healthData);
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load analytics."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }

    loadAnalytics();

    return () => {
      active = false;
    };
  }, [dateRange, refreshKey]);

  const maxToolCalls = Math.max(
    1,
    ...tools.map((tool) => tool.total_calls)
  );

  const mostUsedTool =
    [...tools].sort(
      (a, b) => b.total_calls - a.total_calls
    )[0] ?? null;

  const toolSuccessRate = mostUsedTool
    ? mostUsedTool.total_calls > 0
      ? (
          (mostUsedTool.successful_calls /
            mostUsedTool.total_calls) *
          100
        ).toFixed(1)
      : "0.0"
    : "0.0";

  const maxAgentTasks = Math.max(
    1,
    ...agents.map((agent) => agent.total_tasks)
  );

  const bestPerformingAgent =
    agents
      .filter(
        (agent) =>
          agent.completed_tasks + agent.failed_tasks > 0
      )
      .sort(
        (a, b) =>
          b.success_rate - a.success_rate ||
          b.total_tasks - a.total_tasks
      )[0] ?? null;

  const maxTrendTasks = Math.max(
    1,
    ...trends.map((item) => item.total_tasks)
  );

  const healthSummary = agentHealth.reduce(
    (acc, agent) => {
      acc[agent.health_status] = (acc[agent.health_status] || 0) + 1;
      return acc;
    },
    {} as Record<AgentHealth["health_status"], number>
  );

  return (
    <main className="min-h-screen bg-gray-50 px-5 py-8 text-gray-900 dark:bg-gray-950 dark:text-white md:px-10">
      <div className="mx-auto max-w-7xl space-y-8">

        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-medium text-blue-600">
              AGENTOS / ANALYTICS
            </p>
            <h1 className="mt-2 text-3xl font-bold">
              Performance Analytics
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              Monitor agent execution, productivity and tool usage.
            </p>

            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              Reporting period:
              {dateRange === 7
                ? "Last 7 days"
                : dateRange === 30
                  ? "Last 30 days"
                  : "All time"}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={dateRange ?? "all"}
              onChange={(event) => {
                const value = event.target.value;

                setDateRange(
                  value === "all" ? null : Number(value) as 7 | 30,
                );
              }}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium dark:border-gray-800 dark:bg-gray-900"
              aria-label="Analytics date range"
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="all">All time</option>
            </select>

            <button
              onClick={() => {
                setRefreshing(true);
                setRefreshKey((current) => current + 1);
              }}
              disabled={refreshing || loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800"
            >
              {refreshing && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
              )}
              {refreshing ? "Refreshing..." : "Refresh analytics"}
            </button>
          </div>
        </header>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <AnalyticsSkeleton />
        ) : (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Total executions"
                value={overview.total_tasks}
                description="All organization tasks"
              />
              <MetricCard
                label="Completed tasks"
                value={overview.completed_tasks}
                description="Successfully completed"
              />
              <MetricCard
                label="Failed tasks"
                value={overview.failed_tasks}
                description="Tasks requiring attention"
              />
              <MetricCard
                label="Active tasks"
                value={overview.active_tasks}
                description="Pending, running or awaiting approval"
              />
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <h2 className="text-lg font-semibold">
                    Daily execution trends
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Task volume and execution status over time
                  </p>
                </div>

                <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
                    Completed
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-red-500" />
                    Failed
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-blue-500" />
                    Active
                  </span>
                </div>
              </div>

              {trends.length === 0 ? (
                <div className="mt-6 rounded-xl border border-dashed border-gray-300 p-10 text-center dark:border-gray-700">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    No execution trends available
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Daily activity will appear here when tasks are created.
                  </p>
                </div>
              ) : (
                <div className="mt-8 overflow-x-auto">
                  <div className="flex min-w-max items-end gap-4 px-2">
                    {trends.map((item) => (
                      <div
                        key={item.date}
                        className="flex w-12 flex-col items-center gap-3"
                        title={`${item.date}: ${item.total_tasks} tasks`}
                      >
                        <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                          {item.total_tasks}
                        </span>

                        <div className="flex h-40 w-7 flex-col justify-end overflow-hidden rounded-t-md bg-gray-100 dark:bg-gray-800">
                          <div
                            className="w-full bg-blue-500"
                            style={{
                              height: `${(item.active_tasks / maxTrendTasks) * 100}%`,
                            }}
                          />
                          <div
                            className="w-full bg-red-500"
                            style={{
                              height: `${(item.failed_tasks / maxTrendTasks) * 100}%`,
                            }}
                          />
                          <div
                            className="w-full bg-emerald-500"
                            style={{
                              height: `${(item.completed_tasks / maxTrendTasks) * 100}%`,
                            }}
                          />
                        </div>

                        <span className="text-[10px] text-gray-500">
                          {new Date(`${item.date}T00:00:00`).toLocaleDateString(
                            "en-IN",
                            { day: "2-digit", month: "short" }
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
                <p className="text-sm text-gray-500">Task success rate</p>
                <div className="mt-3 flex items-end gap-2">
                  <span className="text-4xl font-bold">
                    {overview.success_rate.toFixed(1)}%
                  </span>
                </div>
                <div className="mt-5 h-3 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{
                      width: `${Math.min(100, Math.max(0, overview.success_rate))}%`,
                    }}
                  />
                </div>
                <p className="mt-3 text-xs text-gray-400">
                  Completed tasks divided by completed plus failed tasks.
                </p>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
                <p className="text-sm text-gray-500">
                  Average task lifetime
                </p>
                <h2 className="mt-3 text-4xl font-bold">
                  {formatDuration(overview.average_execution_seconds)}
                </h2>
                <p className="mt-3 text-xs text-gray-400">
                  Approximate duration from task creation to last update.
                </p>
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
              <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
                <h2 className="text-lg font-semibold">
                  Agent performance
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Execution volume by agent
                </p>

                {bestPerformingAgent && (
                  <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                          Top reliability
                        </p>
                        <p className="mt-1 font-semibold text-gray-900 dark:text-white">
                          {bestPerformingAgent.name}
                        </p>
                        <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                          {bestPerformingAgent.completed_tasks} completed ·{" "}
                          {bestPerformingAgent.failed_tasks} failed
                        </p>
                      </div>

                      <p className="text-2xl font-bold text-emerald-600">
                        {bestPerformingAgent.success_rate}%
                      </p>
                    </div>
                  </div>
                )}

                <div className="mt-6 space-y-6">
                  {agents.length === 0 && (
                    <div className="rounded-xl border border-dashed border-gray-300 p-6 text-center dark:border-gray-700">
                      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                        <span className="text-lg">🤖</span>
                      </div>
                      <p className="mt-3 text-sm font-medium text-gray-700 dark:text-gray-200">
                        No agent activity yet
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        Agent performance will appear here when tasks are executed.
                      </p>
                    </div>
                  )}

                  {agents.map((agent) => (
                    <div key={agent.agent_id}>
                      <div className="mb-2 flex justify-between gap-3">
                        <div>
                          <p className="font-medium">{agent.name}</p>
                          <p className="text-xs text-gray-500">
                            {agent.completed_tasks} completed · {agent.failed_tasks} failed
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">
                            {agent.total_tasks}
                          </p>
                          <p className="text-xs text-gray-500">
                            {agent.success_rate}% success
                          </p>
                        </div>
                      </div>

                      <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                        <div
                          className="h-full rounded-full bg-blue-500"
                          style={{
                            width: `${(agent.total_tasks / maxAgentTasks) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
                <h2 className="text-lg font-semibold">
                  Tool usage analytics
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Calls made by connected tools
                </p>

                {mostUsedTool && (
                  <div className="mt-5 rounded-xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-900 dark:bg-violet-950/30">
                    <p className="text-xs font-medium uppercase tracking-wide text-violet-700 dark:text-violet-400">
                      Most used tool
                    </p>

                    <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {mostUsedTool.tool_name}
                        </p>
                        <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                          {mostUsedTool.total_calls} total calls
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-2xl font-bold text-violet-600">
                          {toolSuccessRate}%
                        </p>
                        <p className="text-xs text-gray-500">
                          Success rate
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex gap-4 text-xs">
                      <span className="text-emerald-600">
                        {mostUsedTool.successful_calls} successful
                      </span>
                      <span className="text-red-500">
                        {mostUsedTool.failed_calls} failed
                      </span>
                    </div>
                  </div>
                )}

                <div className="mt-6 space-y-6">
                  {tools.length === 0 && (
                    <div className="rounded-xl border border-dashed border-gray-300 p-6 text-center dark:border-gray-700">
                      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                        <span className="text-lg">🛠️</span>
                      </div>
                      <p className="mt-3 text-sm font-medium text-gray-700 dark:text-gray-200">
                        No tool calls recorded
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        Tool usage statistics will appear after agents use their tools.
                      </p>
                    </div>
                  )}

                  {tools.map((tool) => (
                    <div key={tool.tool_name}>
                      <div className="mb-2 flex justify-between">
                        <span className="font-medium">{tool.tool_name}</span>
                        <span className="text-sm text-gray-500">
                          {tool.total_calls} calls
                        </span>
                      </div>

                      <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                        <div
                          className="h-full rounded-full bg-violet-500"
                          style={{
                            width: `${(tool.total_calls / maxToolCalls) * 100}%`,
                          }}
                        />
                      </div>

                      <p className="mt-2 text-xs text-gray-400">
                        {tool.successful_calls} successful · {tool.failed_calls} failed
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Step 3.4 — Agent health section */}
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div>
                  <h2 className="text-lg font-semibold">Agent health</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Live reliability snapshot for every agent in your organization.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 text-xs">
                  {agentHealth.length > 0 && (
                    <>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 font-medium text-emerald-600">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        {healthSummary.healthy || 0} healthy
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 font-medium text-amber-600">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                        {healthSummary.attention || 0} attention
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-500/10 px-2.5 py-1 font-medium text-gray-500">
                        <span className="h-1.5 w-1.5 rounded-full bg-gray-500" />
                        {healthSummary.inactive || 0} inactive
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-500/10 px-2.5 py-1 font-medium text-slate-500">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                        {healthSummary.no_data || 0} no data
                      </span>
                    </>
                  )}
                </div>
              </div>

              {agentHealth.length === 0 ? (
                <div className="mt-6 rounded-xl border border-dashed border-gray-300 p-10 text-center dark:border-gray-700">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                    <span className="text-lg">🩺</span>
                  </div>
                  <p className="mt-3 text-sm font-medium text-gray-700 dark:text-gray-200">
                    No agent health data available
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Create an agent and run a task to populate health metrics.
                  </p>
                </div>
              ) : (
                <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {agentHealth.map((agent) => (
                    <div
                      key={agent.agent_id}
                      className="flex flex-col rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/60"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{agent.name}</p>
                          <p className="mt-1 text-xs text-gray-500">
                            {agent.total_tasks} task
                            {agent.total_tasks === 1 ? "" : "s"}
                            {" · "}
                            {agent.status}
                          </p>
                        </div>
                        <HealthBadge status={agent.health_status} />
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                        <HealthStat
                          label="Success"
                          value={`${Number(agent.success_rate ?? 0).toFixed(1)}%`}
                          tone="text-emerald-600"
                        />
                        <HealthStat
                          label="Failure"
                          value={`${Number(agent.failure_rate ?? 0).toFixed(1)}%`}
                          tone="text-red-500"
                        />
                        <HealthStat
                          label="Avg time"
                          value={
                            agent.average_duration_seconds > 0
                              ? formatDuration(agent.average_duration_seconds)
                              : "—"
                          }
                        />
                        <HealthStat
                          label="Active"
                          value={String(agent.active_tasks)}
                        />
                      </div>

                      <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-3 text-[11px] text-gray-500 dark:border-gray-800">
                        <span>Last execution</span>
                        <span className="font-medium text-gray-700 dark:text-gray-300">
                          {agent.last_execution_at
                            ? new Date(agent.last_execution_at).toLocaleString()
                            : "Never"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
              <div className="border-b border-gray-200 p-6 dark:border-gray-800">
                <h2 className="text-lg font-semibold">
                  Recent executions
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Latest tasks across your organization
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800/50">
                    <tr>
                      <th className="px-6 py-4">Task</th>
                      <th className="px-6 py-4">Agent</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Created</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {recentTasks.map((task) => (
                      <tr key={task.task_id}>
                        <td className="px-6 py-4 font-medium">
                          {task.title}
                        </td>
                        <td className="px-6 py-4 text-gray-500">
                          {task.agent_name || "Unassigned"}
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge status={task.status} />
                        </td>
                        <td className="px-6 py-4 text-gray-500">
                          {new Date(task.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}

                    {recentTasks.length === 0 && (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-6 py-10 text-center"
                        >
                          <div className="flex flex-col items-center gap-2">
                            <span className="text-2xl">📊</span>
                            <span className="font-medium text-gray-700 dark:text-gray-200">
                              No executions yet
                            </span>
                            <span className="text-xs text-gray-500">
                              Your recent task executions will appear here.
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

      </div>
    </main>
  );
}