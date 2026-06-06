"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function HomePage() {
  const router = useRouter();
  const [code, setCode] = useState("");

  function openKiosk(e: React.FormEvent) {
    e.preventDefault();
    const slug = code.trim().toLowerCase();
    if (slug) router.push(`/ponto/${slug}`);
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md card p-8 space-y-7">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-600 text-3xl shadow-lg shadow-indigo-500/30">
            🕒
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Sistema de Ponto
          </h1>
          <p className="text-slate-500 mt-1">
            Marcação de ponto para a sua empresa
          </p>
        </div>

        <div className="space-y-3">
          <Link href="/cadastro" className="btn-primary block p-3.5 text-center">
            Cadastrar minha empresa
          </Link>
          <Link
            href="/admin/login"
            className="btn-ghost block p-3.5 text-center"
          >
            Acesso do administrador
          </Link>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-white/80 px-3 text-xs uppercase tracking-wider text-slate-400">
              funcionário
            </span>
          </div>
        </div>

        <form onSubmit={openKiosk} className="space-y-2">
          <label className="field-label">
            Abrir a tela de ponto da empresa
          </label>
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="código da empresa (ex.: minha-empresa)"
              className="field flex-1"
            />
            <button
              type="submit"
              disabled={!code.trim()}
              className="rounded-xl bg-slate-900 text-white px-5 font-semibold transition hover:bg-slate-800 disabled:opacity-40"
            >
              Abrir
            </button>
          </div>
        </form>
      </div>

      <p className="mt-6 text-xs text-slate-400 text-center">
        Feito para registrar entrada, almoço e saída de forma simples.
        <br />
        Desenvolvido por{" "}
        <span className="font-semibold text-slate-500">Laís Santos</span>
      </p>
    </main>
  );
}
