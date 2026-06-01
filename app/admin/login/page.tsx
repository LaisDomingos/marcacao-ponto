"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Falha no login.");
        return;
      }
      router.push("/admin");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm card p-8 space-y-4">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-600 text-2xl shadow-lg shadow-indigo-500/30">
            🔐
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            Acesso do Administrador
          </h1>
        </div>

        <label className="block">
          <span className="field-label">E-mail</span>
          <input
            type="email"
            className="field"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
          />
        </label>

        <label className="block">
          <span className="field-label">Senha</span>
          <input
            type="password"
            className="field"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        <button
          type="submit"
          disabled={loading || !email || !password}
          className="btn-primary w-full p-3.5"
        >
          {loading ? "Entrando…" : "Entrar"}
        </button>

        {error && (
          <p className="rounded-xl bg-red-50 text-red-700 ring-1 ring-red-100 p-3 text-center text-sm">
            {error}
          </p>
        )}

        <p className="text-center text-sm text-slate-500">
          Ainda não tem conta?{" "}
          <Link href="/cadastro" className="font-medium text-indigo-600 hover:underline">
            Cadastrar empresa
          </Link>
        </p>
        <Link
          href="/"
          className="block text-center text-sm text-slate-400 hover:text-slate-600"
        >
          ← Início
        </Link>
      </form>
    </main>
  );
}
