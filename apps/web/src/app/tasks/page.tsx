"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const API_URL = "http://127.0.0.1:8000";

type Task = {
  id: string;
  title: string;
  description?: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadTasks() {
    try {
      setLoading(true);

      const response = await fetch(`${API_URL}/tasks/`);

      if (!response.ok) {
        throw new Error("Failed to load tasks");
      }

      const data = await response.json();
      setTasks(data);
    } catch (error) {
      console.error("Tasks fetch error:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTasks();
  }, []);

  return (
    <main className="min-h-screen bg-[#09090b] p-6 text-white md:p-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8">
          <Link
            href="/"
            className="text-sm text-zinc-500 transition hover:text-zinc-300"
          >
            ← Back to dashboard
          </Link>

          <div className="mt-4 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                Tasks
              </h1>

              <p className="mt-2 text-zinc-400">
                Manage and monitor AI employee tasks.
              </p>
            </div>

            <button
              onClick={loadTasks}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/10"
            >
              Refresh
            </button>
          </div>
        </header>

        {loading ? (
          <p className="text-zinc-500">Loading tasks...</p>
        ) : tasks.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center">
            <p className="text-zinc-400">No tasks yet.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {tasks.map((task) => (
              <Link
                key={task.id}
                href={`/tasks/${task.id}`}
                className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 transition hover:border-blue-500/40 hover:bg-white/[0.04]"
              >
                <div className="flex items-start justify-between gap-4">
                  <h2 className="font-medium">
                    {task.title}
                  </h2>

                  <StatusBadge status={task.status} />
                </div>

                <p className="mt-2 line-clamp-2 text-sm text-zinc-500">
                  {task.description || "No description provided."}
                </p>

                <div className="mt-5 text-xs text-blue-400">
                  View task →
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    completed: "bg-green-500/10 text-green-400",
    running: "bg-blue-500/10 text-blue-400",
    pending: "bg-zinc-500/10 text-zinc-400",
    waiting_approval: "bg-yellow-500/10 text-yellow-400",
    failed: "bg-red-500/10 text-red-400",
  };

  return (
    <span
      className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] ${
        styles[status] ?? "bg-white/5 text-zinc-400"
      }`}
    >
      {status.replace("_", " ")}
    </span>
  );
}