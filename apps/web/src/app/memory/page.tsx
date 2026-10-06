"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { createMemory, getMemories, Memory } from "@/lib/api";

export default function MemoryPage() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const [type, setType] = useState("preference");
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");

  async function loadMemories() {
    try {
      setLoading(true);
      setError("");

      const data = await getMemories();
      setMemories(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load memories",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMemories();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!key.trim() || !value.trim()) {
      setError("Key and value are required.");
      return;
    }

    try {
      setCreating(true);
      setError("");

      await createMemory(
        type.trim(),
        key.trim(),
        value.trim(),
      );

      setKey("");
      setValue("");

      await loadMemories();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create memory",
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-6xl px-6 py-8">

        <div className="mb-8 flex items-center justify-between">
          <div>
            <Link
              href="/"
              className="text-sm text-slate-400 hover:text-white"
            >
              ← Back to Dashboard
            </Link>

            <h1 className="mt-4 text-3xl font-bold">
              🧠 Agent Memory
            </h1>

            <p className="mt-2 text-slate-400">
              Manage information your AI employees remember.
            </p>
          </div>

          <button
            onClick={loadMemories}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800"
          >
            Refresh
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="mb-8 rounded-xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="mb-4 text-lg font-semibold">
            Add Memory
          </h2>

          <form
            onSubmit={handleSubmit}
            className="grid gap-4 md:grid-cols-3"
          >
            <input
              value={type}
              onChange={(e) => setType(e.target.value)}
              placeholder="Type"
              className="rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-blue-500"
            />

            <input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="Key"
              className="rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-blue-500"
            />

            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Value"
              className="rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-blue-500"
            />

            <button
              type="submit"
              disabled={creating}
              className="rounded-lg bg-blue-600 px-4 py-3 font-medium hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50 md:col-span-3"
            >
              {creating ? "Saving..." : "Save Memory"}
            </button>
          </form>
        </div>

        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            Stored Memories
          </h2>

          <span className="text-sm text-slate-400">
            {memories.length} memories
          </span>
        </div>

        {loading ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center text-slate-400">
            Loading memories...
          </div>
        ) : memories.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900 p-12 text-center">
            <div className="text-4xl">🧠</div>

            <h3 className="mt-4 text-lg font-semibold">
              No memories yet
            </h3>

            <p className="mt-2 text-sm text-slate-400">
              Add a memory above to give your AI employee persistent context.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {memories.map((memory) => (
              <div
                key={memory.id}
                className="rounded-xl border border-slate-800 bg-slate-900 p-5"
              >
                <div className="mb-4 flex items-center justify-between">
                  <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-300">
                    {memory.type}
                  </span>

                  <span className="text-xs text-slate-500">
                    {memory.id.slice(0, 8)}
                  </span>
                </div>

                <p className="text-sm font-medium text-slate-400">
                  {memory.key}
                </p>

                <p className="mt-2 text-base text-white">
                  {memory.value}
                </p>

                {memory.agent_id && (
                  <p className="mt-4 text-xs text-slate-500">
                    Agent: {memory.agent_id.slice(0, 8)}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}