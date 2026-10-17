
"use client";

import { useEffect, useMemo, useState } from "react";
import { getTools, type AgentTool } from "@/lib/api";

const categoryIcons: Record<string, string> = {
  Data: "📊",
  Communication: "✉️",
  Sales: "🤝",
  Research: "🔎",
  AI: "🧠",
};

export default function ToolsPage() {
  const [tools, setTools] = useState<AgentTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");

  useEffect(() => {
    let active = true;

    async function loadTools() {
      try {
        const data = await getTools();
        if (active) setTools(data);
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load tools",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadTools();

    return () => {
      active = false;
    };
  }, []);

  const categories = useMemo(
    () => ["All", ...new Set(tools.map((tool) => tool.category))],
    [tools],
  );

  const filteredTools = useMemo(() => {
    const query = search.trim().toLowerCase();

    return tools.filter((tool) => {
      const matchesSearch =
        tool.name.toLowerCase().includes(query) ||
        tool.description.toLowerCase().includes(query);

      const matchesCategory =
        category === "All" || tool.category === category;

      return matchesSearch && matchesCategory;
    });
  }, [tools, search, category]);

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-10 text-white sm:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header>
          <p className="text-sm font-medium text-cyan-400">
            AGENTOS WORKSPACE
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Tool Registry
          </h1>

          <p className="mt-3 max-w-2xl text-slate-400">
            Explore the tools available to your AI employees,
            their categories, and their approval requirements.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Registered tools" value={tools.length} />
          <StatCard
            label="AI tools"
            value={tools.filter((tool) => tool.category === "AI").length}
          />
          <StatCard
            label="Marked for approval"
            value={tools.filter((tool) => tool.approval_required).length}
          />
        </section>

        <section className="flex flex-col gap-3 sm:flex-row">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search tools..."
            aria-label="Search tools"
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 outline-none focus:border-cyan-500 sm:flex-1"
          />

          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            aria-label="Filter by category"
            className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3"
          >
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </section>

        {loading && (
          <p className="text-slate-400">Loading registered tools...</p>
        )}

        {!loading && error && (
          <div
            role="alert"
            className="rounded-xl border border-red-500/30 bg-red-500/10 p-5"
          >
            <p className="font-semibold text-red-300">
              Could not load tools
            </p>
            <p className="mt-2 text-sm text-red-200">{error}</p>
            <p className="mt-2 text-sm text-slate-400">
              Check that the API is running and you are logged in.
            </p>
          </div>
        )}

        {!loading && !error && filteredTools.length === 0 && (
          <div className="rounded-xl border border-slate-800 p-8 text-center">
            <p className="font-medium">No tools found</p>
            <p className="mt-2 text-sm text-slate-400">
              Try another search or category.
            </p>
          </div>
        )}

        {!loading && !error && filteredTools.length > 0 && (
          <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredTools.map((tool) => (
              <article
                key={tool.name}
                className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 transition hover:border-cyan-500/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800 text-2xl">
                    {categoryIcons[tool.category] ?? "🧩"}
                  </div>

                  <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">
                    {tool.category}
                  </span>
                </div>

                <h2 className="mt-5 text-lg font-semibold">
                  {tool.name.replaceAll("_", " ")}
                </h2>

                <p className="mt-2 min-h-12 text-sm leading-6 text-slate-400">
                  {tool.description}
                </p>

                <div className="mt-5 flex flex-wrap gap-2">
                  <span className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-300">
                    {tool.integration_type === "mock"
                      ? "Mock integration"
                      : tool.integration_type === "ai"
                        ? "AI capability"
                        : tool.integration_type}
                  </span>

                  <span
                    className={`rounded-lg px-3 py-1.5 text-xs ${
                      tool.approval_required
                        ? "bg-amber-500/10 text-amber-300"
                        : "bg-emerald-500/10 text-emerald-300"
                    }`}
                  >
                    {tool.approval_required
                      ? "Approval marked"
                      : "No approval marked"}
                  </span>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}
