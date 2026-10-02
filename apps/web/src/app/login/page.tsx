"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { login } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      await login(email, password);

      router.push("/");
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to login. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#09090b] text-white">
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-md">
          {/* Brand */}
          <div className="mb-8 text-center">
            <Link
              href="/"
              className="text-3xl font-bold tracking-tight"
            >
              Agent<span className="text-blue-500">OS</span>
            </Link>

            <p className="mt-2 text-sm text-zinc-500">
              AI Employee Platform
            </p>
          </div>

          {/* Card */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 shadow-2xl">
            <div className="mb-6">
              <h1 className="text-2xl font-semibold">
                Welcome back
              </h1>

              <p className="mt-2 text-sm text-zinc-500">
                Sign in to your AgentOS workspace.
              </p>
            </div>

            {error && (
              <div className="mb-5 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm text-zinc-300"
                >
                  Email
                </label>

                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@company.com"
                  className="w-full rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none transition placeholder:text-zinc-700 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30"
                />
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm text-zinc-300"
                >
                  Password
                </label>

                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none transition placeholder:text-zinc-700 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30"
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Signing in..." : "Sign in"}
              </button>
            </form>

            <div className="mt-6 border-t border-white/10 pt-6 text-center">
              <p className="text-sm text-zinc-500">
                Don't have an account?{" "}
                <Link
                  href="/signup"
                  className="text-blue-400 transition hover:text-blue-300"
                >
                  Create account
                </Link>
              </p>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-zinc-700">
            Secure access to your AI workforce.
          </p>
        </div>
      </div>
    </main>
  );
}