"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AuditLog, getAuditLogs } from "@/lib/api";

function NavItem({
  href,
  label,
  icon,
  active = false,
}: {
  href: string;
  label: string;
  icon: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
        active
          ? "bg-white/10 text-white"
          : "text-zinc-400 hover:bg-white/5 hover:text-white"
      }`}
    >
      <span className="w-5 text-center">{icon}</span>
      {label}
    </Link>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function formatEventType(value: string) {
  return value
    .replace(/\./g, " ")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function actorLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  async function loadLogs() {
    try {
      setError("");
      const data = await getAuditLogs();
      setLogs(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load audit logs",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    try {
      setRefreshing(true);
      await loadLogs();
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadLogs();
  }, []);

  const filteredLogs =
    filter === "all"
      ? logs
      : logs.filter((log) => log.actor_type === filter);

  return (
    <main className="min-h-screen bg-[#09090b] text-white">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 border-r border-white/10 bg-[#0c0c0f] p-6 md:block">
          <div className="mb-10">
            <Link
              href="/"
              className="text-2xl font-bold tracking-tight"
            >
              Agent<span className="text-blue-500">OS</span>
            </Link>

            <p className="mt-1 text-xs text-zinc-500">
              AI Employee Platform
            </p>
          </div>

          <nav className="space-y-2">
            <NavItem href="/" label="Dashboard" icon="⌂" />
            <NavItem href="/tasks" label="Tasks" icon="✓" />
            <NavItem href="/approvals" label="Approvals" icon="!" />
            <NavItem href="/agents" label="Agents" icon="✦" />
            <NavItem href="/audit" active label="Audit Logs" icon="◷" />
          </nav>
        </aside>

        <section className="flex-1">
          <header className="border-b border-white/10 px-6 py-5 md:px-10">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-zinc-500">Workspace</p>

                <h1 className="text-xl font-semibold">
                  Audit Logs
                </h1>

                <p className="mt-1 text-sm text-zinc-500">
                  Complete activity history for your AI employees.
                </p>
              </div>

              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </header>

          <div className="p-6 md:p-10">
            <div className="mb-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
                <p className="text-xs uppercase tracking-wider text-zinc-500">
                  Total Events
                </p>
                <p className="mt-2 text-3xl font-semibold">
                  {logs.length}
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
                <p className="text-xs uppercase tracking-wider text-zinc-500">
                  Agent Events
                </p>
                <p className="mt-2 text-3xl font-semibold">
                  {logs.filter((log) => log.actor_type === "agent").length}
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
                <p className="text-xs uppercase tracking-wider text-zinc-500">
                  User Events
                </p>
                <p className="mt-2 text-3xl font-semibold">
                  {logs.filter((log) => log.actor_type === "user").length}
                </p>
              </div>
            </div>

            <div className="mb-5 flex flex-wrap gap-2">
              {["all", "agent", "user"].map((value) => (
                <button
                  key={value}
                  onClick={() => setFilter(value)}
                  className={`rounded-lg px-4 py-2 text-sm transition ${
                    filter === value
                      ? "bg-blue-500 text-white"
                      : "border border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {value === "all"
                    ? "All Events"
                    : `${actorLabel(value)} Events`}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-10 text-center text-zinc-500">
                Loading audit logs...
              </div>
            ) : error ? (
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6">
                <p className="font-medium text-red-400">
                  Failed to load audit logs
                </p>
                <p className="mt-1 text-sm text-zinc-500">
                  {error}
                </p>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-10 text-center">
                <p className="font-medium">No audit events found</p>
                <p className="mt-1 text-sm text-zinc-500">
                  AgentOS activity will appear here as tasks run.
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] text-left">
                    <thead className="border-b border-white/10 bg-white/[0.03]">
                      <tr>
                        <th className="px-5 py-4 text-xs font-medium uppercase tracking-wider text-zinc-500">
                          Event
                        </th>
                        <th className="px-5 py-4 text-xs font-medium uppercase tracking-wider text-zinc-500">
                          Actor
                        </th>
                        <th className="px-5 py-4 text-xs font-medium uppercase tracking-wider text-zinc-500">
                          Action
                        </th>
                        <th className="px-5 py-4 text-xs font-medium uppercase tracking-wider text-zinc-500">
                          Message
                        </th>
                        <th className="px-5 py-4 text-xs font-medium uppercase tracking-wider text-zinc-500">
                          Time
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-white/5">
                      {filteredLogs.map((log) => (
                        <tr
                          key={log.id}
                          className="transition hover:bg-white/[0.03]"
                        >
                          <td className="px-5 py-4">
                            <span className="rounded-md bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-400">
                              {formatEventType(log.event_type)}
                            </span>
                          </td>

                          <td className="px-5 py-4 text-sm">
                            <span
                              className={
                                log.actor_type === "agent"
                                  ? "text-purple-400"
                                  : "text-emerald-400"
                              }
                            >
                              {actorLabel(log.actor_type)}
                            </span>
                          </td>

                          <td className="px-5 py-4 text-sm text-zinc-300">
                            {log.action}
                          </td>

                          <td className="max-w-md px-5 py-4 text-sm text-zinc-500">
                            {log.message || "—"}
                          </td>

                          <td className="whitespace-nowrap px-5 py-4 text-xs text-zinc-500">
                            {formatDate(log.created_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
