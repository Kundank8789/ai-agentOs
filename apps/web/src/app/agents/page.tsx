"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const API_URL = "http://127.0.0.1:8000";

type Agent = {
  id: string;
  name: string;
  description?: string;
  status?: string;
  role?: string;
  model?: string;
};

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadAgents() {
    try {
      const response = await fetch(`${API_URL}/agents/`);

      if (!response.ok) {
        throw new Error("Failed to load agents");
      }

      const data = await response.json();
      setAgents(data);
    } catch (error) {
      console.error("Agents fetch error:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAgents();
  }, []);

  return (
    <main className="min-h-screen bg-[#09090b] text-white p-6 md:p-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8">
          <Link
            href="/"
            className="text-sm text-zinc-500 transition hover:text-zinc-300"
          >
            ← Back to dashboard
          </Link>

          <h1 className="mt-4 text-3xl font-semibold tracking-tight">
            AI Agents
          </h1>

          <p className="mt-2 text-zinc-400">
            Your AI employees — each specialized for a different
            part of your business.
          </p>
        </header>

        {loading ? (
          <p className="text-zinc-500">Loading agents...</p>
        ) : agents.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center">
            <p className="text-zinc-400">No agents yet.</p>
            <p className="mt-2 text-sm text-zinc-600">
              Seed one with{" "}
              <code className="rounded bg-white/5 px-1.5 py-0.5">
                python -m app.seed
              </code>
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {agents.map((agent) => (
              <Link
                key={agent.id}
                href={`/agents/${agent.id}`}
                className="group rounded-2xl border border-white/10 bg-white/[0.02] p-5 transition hover:border-blue-500/40 hover:bg-white/[0.04]"
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10 text-lg text-blue-400">
                    ✦
                  </div>

                  {agent.status && (
                    <span className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-zinc-400">
                      {agent.status}
                    </span>
                  )}
                </div>

                <h2 className="mt-4 text-base font-medium">
                  {agent.name}
                </h2>

                <p className="mt-1 line-clamp-2 text-sm text-zinc-500">
                  {agent.description || "No description provided."}
                </p>

                <p className="mt-4 text-xs font-medium text-blue-400 opacity-0 transition group-hover:opacity-100">
                  View agent →
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}