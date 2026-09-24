"use client";

import Link from "next/link";

const agents = [
  {
    id: "crm",
    name: "CRM Agent",
    description: "Manages leads, customers, CRM updates and follow-ups.",
    status: "active",
    tasks: 24,
    success: "96%",
    lastActive: "2 minutes ago",
    capabilities: [
      "Read CRM data",
      "Create leads",
      "Update customer status",
      "Create follow-up tasks",
    ],
  },
  {
    id: "support",
    name: "Customer Support Agent",
    description: "Handles customer support workflows and communication.",
    status: "active",
    tasks: 18,
    success: "94%",
    lastActive: "5 minutes ago",
    capabilities: [
      "Read customer messages",
      "Draft replies",
      "Classify support requests",
      "Escalate sensitive issues",
    ],
  },
  {
    id: "operations",
    name: "Operations Agent",
    description: "Handles orders, delays, notifications and operational workflows.",
    status: "idle",
    tasks: 31,
    success: "98%",
    lastActive: "18 minutes ago",
    capabilities: [
      "Check delayed orders",
      "Create notifications",
      "Update order status",
      "Create approval requests",
    ],
  },
];

export default function AgentsPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-7xl px-8 py-10">
        <div className="mb-10">
          <Link
            href="/"
            className="text-sm text-zinc-500 transition hover:text-white"
          >
            ← Back to dashboard
          </Link>

          <div className="mt-8">
            <p className="text-sm font-medium text-blue-400">AI Workforce</p>

            <h1 className="mt-2 text-4xl font-semibold tracking-tight">
              AI Agents
            </h1>

            <p className="mt-3 max-w-2xl text-zinc-400">
              Manage your AI employees, their capabilities and operational
              activity.
            </p>
          </div>
        </div>

        <div className="mb-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            <p className="text-sm text-zinc-500">Total agents</p>
            <p className="mt-2 text-3xl font-semibold">3</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            <p className="text-sm text-zinc-500">Active</p>
            <p className="mt-2 text-3xl font-semibold text-green-400">2</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            <p className="text-sm text-zinc-500">Tasks completed</p>
            <p className="mt-2 text-3xl font-semibold">73</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition hover:border-white/20"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/5 text-xl">
                    🤖
                  </div>

                  <div>
                    <h2 className="text-xl font-semibold">{agent.name}</h2>

                    <div className="mt-2 flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          agent.status === "active"
                            ? "bg-green-400"
                            : "bg-zinc-500"
                        }`}
                      />

                      <span
                        className={
                          agent.status === "active"
                            ? "text-sm text-green-400"
                            : "text-sm text-zinc-500"
                        }
                      >
                        {agent.status === "active" ? "Active" : "Idle"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <p className="mt-6 text-sm leading-6 text-zinc-400">
                {agent.description}
              </p>

              <div className="mt-6 grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-white/5 bg-black/30 p-4">
                  <p className="text-xs text-zinc-500">Tasks completed</p>
                  <p className="mt-1 text-xl font-semibold">{agent.tasks}</p>
                </div>

                <div className="rounded-xl border border-white/5 bg-black/30 p-4">
                  <p className="text-xs text-zinc-500">Success rate</p>
                  <p className="mt-1 text-xl font-semibold">{agent.success}</p>
                </div>
              </div>

              <div className="mt-6">
                <p className="text-xs uppercase tracking-wider text-zinc-600">
                  Capabilities
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {agent.capabilities.map((capability) => (
                    <span
                      key={capability}
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-300"
                    >
                      {capability}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-5">
                <p className="text-xs text-zinc-500">
                  Last active: {agent.lastActive}
                </p>

                <Link
                  href={`/agents/${agent.id}`}
                  className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium transition hover:bg-white/10"
                >
                  View Agent →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}