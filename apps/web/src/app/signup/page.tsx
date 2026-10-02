"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { signup } from "@/lib/api";

export default function SignupPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      await signup(name, email, password);

      router.push("/login");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to create account. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#09090b] text-white">
      <div className="flex min-h-screen items-center justify-center px-6 py-10">
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

          {/* Signup Card */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 shadow-2xl">

            <div className="mb-6">
              <h1 className="text-2xl font-semibold">
                Create your account
              </h1>

              <p className="mt-2 text-sm text-zinc-500">
                Create your AgentOS workspace.
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="mb-5 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Name */}
              <div>
                <label
                  htmlFor="name"
                  className="mb-2 block text-sm text-zinc-300"
                >
                  Full name
                </label>

                <input
                  id="name"
                  type="text"
                  required
                  minLength={2}
                  maxLength={255}
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Your name"
                  className="w-full rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none transition placeholder:text-zinc-700 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30"
                />
              </div>

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
                  minLength={8}
                  maxLength={128}
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none transition placeholder:text-zinc-700 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30"
                />
              </div>

              {/* Confirm Password */}
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="mb-2 block text-sm text-zinc-300"
                >
                  Confirm password
                </label>

                <input
                  id="confirmPassword"
                  type="password"
                  required
                  minLength={8}
                  maxLength={128}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) =>
                    setConfirmPassword(event.target.value)
                  }
                  placeholder="Enter your password again"
                  className="w-full rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none transition placeholder:text-zinc-700 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30"
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Creating account..." : "Create account"}
              </button>
            </form>

            {/* Login */}
            <div className="mt-6 border-t border-white/10 pt-6 text-center">
              <p className="text-sm text-zinc-500">
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="text-blue-400 transition hover:text-blue-300"
                >
                  Sign in
                </Link>
              </p>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-zinc-700">
            Your workspace is created securely.
          </p>
        </div>
      </div>
    </main>
  );
}