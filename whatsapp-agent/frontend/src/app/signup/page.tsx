"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { api, ApiError, setToken } from "@/lib/apiClient";

export default function SignupPage() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.post<{ access_token: string }>("/auth/signup", {
        company_name: companyName,
        name,
        email,
        password,
      });
      setToken(res.access_token);
      router.push("/dashboard/settings?tab=whatsapp");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="card p-8">
          <h1 className="text-xl font-semibold text-ink-800">Create your workspace</h1>
          <p className="mt-1 text-sm text-ink-400">One account per business — you'll connect WhatsApp next.</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="label">Company name</label>
              <input className="input" required value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Acme Interiors" />
            </div>
            <div>
              <label className="label">Your name</label>
              <input className="input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
            </div>
            <div>
              <label className="label">Work email</label>
              <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@acme.com" />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                className="input"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
              {loading ? "Creating..." : "Create workspace"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-400">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-brand-600 hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
