"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function CadastroPage() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<{ slug: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("As senhas não conferem.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName, email, password, confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao cadastrar.");
        return;
      }
      setDone({ slug: data.slug });
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    const kioskUrl = `${window.location.origin}/ponto/${done.slug}`;
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-md card p-8 space-y-5 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-3xl shadow-lg shadow-emerald-500/30">
            🎉
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            Empresa cadastrada!
          </h1>

          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-500">
              Código da sua empresa
            </p>
            <code className="block break-all text-2xl font-bold text-indigo-700 mt-1">
              {done.slug}
            </code>
            <p className="text-xs text-slate-500 mt-2">
              Use esse código na tela inicial para abrir a tela de ponto.
            </p>
          </div>

          <p className="text-slate-600 text-sm">
            Ou compartilhe o link direto com seus funcionários:
          </p>
          <code className="block break-all rounded-xl bg-slate-100 p-3 text-sm text-slate-700">
            {kioskUrl}
          </code>

          <button
            onClick={() => router.push("/admin")}
            className="btn-primary w-full p-3.5"
          >
            Ir para o painel do administrador
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-md card p-8 space-y-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">Cadastrar empresa</h1>
          <p className="text-slate-500 text-sm mt-1">
            Crie a conta da sua empresa e o primeiro administrador.
          </p>
        </div>

        <label className="block">
          <span className="field-label">Nome da empresa</span>
          <input
            className="field"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            autoFocus
          />
        </label>

        <label className="block">
          <span className="field-label">E-mail do administrador</span>
          <input
            type="email"
            className="field"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label className="block">
          <span className="field-label">Senha (mín. 6 caracteres)</span>
          <input
            type="password"
            className="field"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        <label className="block">
          <span className="field-label">Confirmar senha</span>
          <input
            type="password"
            className="field"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </label>

        <button
          type="submit"
          disabled={
            loading ||
            !companyName.trim() ||
            !email ||
            password.length < 6 ||
            password !== confirmPassword
          }
          className="btn-primary w-full p-3.5"
        >
          {loading ? "Cadastrando…" : "Cadastrar empresa"}
        </button>

        {error && (
          <p className="rounded-xl bg-red-50 text-red-700 ring-1 ring-red-100 p-3 text-center text-sm">
            {error}
          </p>
        )}

        <Link
          href="/"
          className="block text-center text-sm text-slate-400 hover:text-slate-600"
        >
          ← Voltar
        </Link>
      </form>
    </main>
  );
}
