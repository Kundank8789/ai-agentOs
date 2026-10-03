"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import { createTask, getTasks } from "@/lib/api";

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
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadTasks() {
    try {
      setLoading(true);
      setError("");

      const data = await getTasks();
      setTasks(data);
    } catch (error) {
      console.error(error);
      setError(
        error instanceof Error ? error.message : "Failed to load tasks",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTasks();
  }, []);

  async function handleCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!title.trim()) {
      setError("Please enter a task title.");
      return;
    }

    if (!description.trim()) {
      setError("Please describe what AgentOS should do.");
      return;
    }

    try {
      setCreating(true);

      await createTask(title.trim(), description.trim());

      setTitle("");
      setDescription("");

      setSuccess("Task created successfully.");

      await loadTasks();
    } catch (error) {
      console.error(error);
      setError(
        error instanceof Error ? error.message : "Failed to create task",
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#09090b] text-white">
      <div className="flex min-h-screen">
        {/* Sidebar */}
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
            <NavItem href="/tasks" active label="Tasks" icon="✓" />
            <NavItem href="/approvals" label="Approvals" icon="!" />
            <NavItem href="/agents" label="Agents" icon="✦" />
            <NavItem href="/audit" label="Audit Logs" icon="◷" />
          </nav>
        </aside>

        {/* Main */}
        <section className="flex-1">
          <header className="border-b border-white/10 px-6 py-5 md:px-10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-zinc-500">Workspace</p>

                <h1 className="text-xl font-semibold">
                  Tasks
                </h1>
              </div>

              <button
                onClick={loadTasks}
                disabled={loading}
                className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/10 disabled:opacity-50"
              >
                Refresh
              </button>
            </div>
          </header>

          <div className="p-6 md:p-10">
            {/* Create Task */}
            <div className="mb-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <div className="mb-6">
                <p className="mb-2 text-sm text-blue-400">
                  AI workforce
                </p>

                <h2 className="text-2xl font-semibold">
                  Create an AI task
                </h2>

                <p className="mt-2 text-sm text-zinc-500">
                  Tell AgentOS what you want your AI employee to do.
                </p>
              </div>

              {error && (
                <div className="mb-5 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              {success && (
                <div className="mb-5 rounded-lg border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-400">
                  {success}
                </div>
              )}

              <form onSubmit={handleCreateTask} className="space-y-5">
                <div>
                  <label
                    htmlFor="title"
                    className="mb-2 block text-sm text-zinc-300"
                  >
                    Task title
                  </label>

                  <input
                    id="title"
                    type="text"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Find today's delayed orders"
                    maxLength={255}
                    className="w-full rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none transition placeholder:text-zinc-700 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30"
                  />
                </div>

                <div>
                  <label
                    htmlFor="description"
                    className="mb-2 block text-sm text-zinc-300"
                  >
                    What should AgentOS do?
                  </label>

                  <textarea
                    id="description"
                    value={description}
                    onChange={(event) =>
                      setDescription(event.target.value)
                    }
                    placeholder="Find today's delayed orders, identify the affected customers, and prepare the follow-up actions."
                    rows={5}
                    className="w-full resize-none rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none transition placeholder:text-zinc-700 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={creating}
                    className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-medium transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {creating ? "Creating..." : "Create Task"}
                  </button>
                </div>
              </form>
            </div>

            {/* Task List */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02]">
              <div className="border-b border-white/10 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold">
                      Your Tasks
                    </h2>

                    <p className="mt-1 text-xs text-zinc-500">
                      Tasks created in your workspace
                    </p>
                  </div>

                  <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-zinc-400">
                    {tasks.length}
                  </span>
                </div>
              </div>

              <div className="divide-y divide-white/10">
                {loading ? (
                  <div className="p-6 text-sm text-zinc-500">
                    Loading tasks...
                  </div>
                ) : tasks.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-sm text-zinc-400">
                      No tasks yet.
                    </p>

                    <p className="mt-1 text-xs text-zinc-600">
                      Create your first AI task above.
                    </p>
                  </div>
                ) : (
                  tasks.map((task) => (
                    <Link
                      key={task.id}
                      href={`/tasks/${task.id}`}
                      className="block p-5 transition hover:bg-white/[0.03]"
                    >
                      <div className="flex items-start justify-between gap-5">
                        <div className="min-w-0">
                          <h3 className="text-sm font-medium">
                            {task.title}
                          </h3>

                          {task.description && (
                            <p className="mt-2 line-clamp-2 text-xs text-zinc-500">
                              {task.description}
                            </p>
                          )}

                          <p className="mt-3 text-[11px] text-zinc-700">
                            {new Date(task.created_at).toLocaleString()}
                          </p>
                        </div>

                        <StatusBadge status={task.status} />
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

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
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${
        active
          ? "bg-blue-500/10 text-blue-400"
          : "text-zinc-500 hover:bg-white/5 hover:text-zinc-200"
      }`}
    >
      <span>{icon}</span>
      {label}
    </Link>
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
      {status.replaceAll("_", " ")}
    </span>
  );
}