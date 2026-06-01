"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type PunchType = "entrada" | "almoco_saida" | "almoco_volta" | "saida";

interface SheetRow {
  employeeId: number;
  employeeName: string;
  workDate: string;
  entrada: string;
  almocoSaida: string;
  almocoVolta: string;
  saida: string;
  worked: string;
}

interface AdminEmployee {
  id: number;
  name: string;
  weekly_hours: number;
  active: boolean;
  has_pin: boolean;
}

const HOURS_OPTIONS = [20, 32, 40];

const COLS: { key: keyof SheetRow; type: PunchType; label: string }[] = [
  { key: "entrada", type: "entrada", label: "Entrada" },
  { key: "almocoSaida", type: "almoco_saida", label: "Saída Almoço" },
  { key: "almocoVolta", type: "almoco_volta", label: "Volta Almoço" },
  { key: "saida", type: "saida", label: "Saída" },
];

function todayStr() {
  return new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD local
}

export default function AdminDashboard({
  email,
  companyName,
  companySlug,
  companyLogo,
  allowManualPunch,
}: {
  email: string;
  companyName: string;
  companySlug: string;
  companyLogo: string | null;
  allowManualPunch: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"folha" | "funcionarios">("folha");

  // ---- Logo ----
  const [logo, setLogo] = useState(companyLogo);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // ---- Lançamento manual de ponto pelo funcionário ----
  const [manualPunch, setManualPunch] = useState(allowManualPunch);
  const [savingManual, setSavingManual] = useState(false);

  // ---- Folha de ponto ----
  const [from, setFrom] = useState(todayStr());
  const [to, setTo] = useState(todayStr());
  const [filterEmployee, setFilterEmployee] = useState("");
  const [rows, setRows] = useState<SheetRow[]>([]);
  const [loadingSheet, setLoadingSheet] = useState(false);

  // ---- Funcionários ----
  const [employees, setEmployees] = useState<AdminEmployee[]>([]);
  const [newName, setNewName] = useState("");
  const [newHours, setNewHours] = useState(40);
  const [msg, setMsg] = useState("");

  const loadEmployees = useCallback(async () => {
    const res = await fetch("/api/admin/employees");
    if (res.ok) setEmployees((await res.json()).employees);
  }, []);

  const loadSheet = useCallback(async () => {
    setLoadingSheet(true);
    try {
      const qs = new URLSearchParams();
      if (from) qs.set("from", from);
      if (to) qs.set("to", to);
      if (filterEmployee) qs.set("employeeId", filterEmployee);
      const res = await fetch(`/api/admin/punches?${qs.toString()}`);
      if (res.ok) setRows((await res.json()).rows);
    } finally {
      setLoadingSheet(false);
    }
  }, [from, to, filterEmployee]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  useEffect(() => {
    loadSheet();
  }, [loadSheet]);

  function exportUrl(employeeId?: number) {
    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    const emp = employeeId ?? (filterEmployee ? Number(filterEmployee) : 0);
    if (emp) qs.set("employeeId", String(emp));
    return `/api/admin/export?${qs.toString()}`;
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  async function uploadLogo(file: File) {
    setUploadingLogo(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/logo", { method: "POST", body: fd });
      const d = await res.json();
      if (!res.ok) {
        flash(d.error ?? "Erro ao enviar a logo.");
        return;
      }
      setLogo(d.logoUrl);
      flash("Logo atualizada.");
    } finally {
      setUploadingLogo(false);
    }
  }

  async function removeLogo() {
    if (!window.confirm("Remover a logo da empresa?")) return;
    const res = await fetch("/api/admin/logo", { method: "DELETE" });
    if (res.ok) {
      setLogo(null);
      flash("Logo removida.");
    } else {
      flash("Erro ao remover a logo.");
    }
  }

  async function toggleManualPunch(next: boolean) {
    setSavingManual(true);
    setManualPunch(next); // otimista
    try {
      const res = await fetch("/api/admin/company", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowManualPunch: next }),
      });
      if (!res.ok) {
        setManualPunch(!next); // desfaz
        const d = await res.json();
        flash(d.error ?? "Erro ao salvar a configuração.");
        return;
      }
      flash(
        next
          ? "Funcionários podem lançar o ponto do mês manualmente."
          : "Lançamento manual desativado."
      );
    } finally {
      setSavingManual(false);
    }
  }

  async function correct(row: SheetRow, type: PunchType, time: string) {
    const res = await fetch("/api/admin/punches/correct", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeeId: row.employeeId,
        workDate: row.workDate,
        type,
        time,
      }),
    });
    if (res.ok) {
      loadSheet();
    } else {
      const d = await res.json();
      flash(d.error ?? "Erro ao corrigir.");
    }
  }

  async function addEmployee() {
    setMsg("");
    const res = await fetch("/api/admin/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, weeklyHours: newHours }),
    });
    const d = await res.json();
    if (!res.ok) {
      flash(d.error ?? "Erro ao criar funcionário.");
      return;
    }
    setNewName("");
    setNewHours(40);
    flash("Funcionário criado. Ele define o PIN no primeiro acesso.");
    loadEmployees();
  }

  async function patchEmployee(id: number, body: Record<string, unknown>) {
    const res = await fetch(`/api/admin/employees/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await res.json();
    if (!res.ok) {
      flash(d.error ?? "Erro ao atualizar.");
      return;
    }
    flash("Atualizado.");
    loadEmployees();
  }

  function flash(text: string) {
    setMsg(text);
    setTimeout(() => setMsg(""), 3000);
  }

  return (
    <main className="min-h-screen p-6 max-w-5xl mx-auto">
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logo}
              alt={companyName}
              className="h-11 w-11 rounded-xl object-contain bg-white ring-1 ring-slate-200"
            />
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-blue-600 text-xl shadow-lg shadow-indigo-500/30">
              🕒
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {companyName}
            </h1>
            <p className="text-slate-500 text-sm">
              Painel do administrador — {email}
            </p>
          </div>
        </div>
        <button onClick={logout} className="btn-ghost px-4 py-2">
          Sair
        </button>
      </header>

      {companySlug && (
        <div className="mb-6 flex flex-wrap items-center gap-x-8 gap-y-2 card px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Código da empresa
            </p>
            <code className="text-lg font-bold text-indigo-700">
              {companySlug}
            </code>
          </div>
          <p className="text-sm text-slate-500">
            Link de ponto dos funcionários:{" "}
            <a
              href={`/ponto/${companySlug}`}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-indigo-600 hover:underline break-all"
            >
              {`/ponto/${companySlug}`}
            </a>
          </p>
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-4 card px-5 py-4">
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-slate-50 ring-1 ring-slate-200">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logo}
              alt={companyName}
              className="h-full w-full object-contain"
            />
          ) : (
            <span className="text-2xl">🏢</span>
          )}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Logo da empresa
          </p>
          <p className="text-sm text-slate-500">
            Aparece aqui e na tela de ponto dos funcionários. PNG, JPG, WEBP ou
            SVG (máx. 2 MB).
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <label className="btn-ghost cursor-pointer px-4 py-2 text-sm">
              {uploadingLogo
                ? "Enviando…"
                : logo
                  ? "Trocar logo"
                  : "Enviar logo"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                disabled={uploadingLogo}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadLogo(f);
                  e.target.value = "";
                }}
              />
            </label>
            {logo && (
              <button
                onClick={removeLogo}
                disabled={uploadingLogo}
                className="btn-ghost px-4 py-2 text-sm text-red-600"
              >
                Remover
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 card px-5 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Lançamento manual de ponto
          </p>
          <p className="text-sm text-slate-500">
            Permite que o funcionário lance/ajuste manualmente os pontos do mês
            atual (dias anteriores e hoje) na própria tela de ponto.
          </p>
        </div>
        <button
          role="switch"
          aria-checked={manualPunch}
          disabled={savingManual}
          onClick={() => toggleManualPunch(!manualPunch)}
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition disabled:opacity-50 ${
            manualPunch ? "bg-indigo-600" : "bg-slate-300"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
              manualPunch ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      <nav className="flex gap-2 mb-6 p-1 rounded-2xl bg-slate-100/70 w-fit ring-1 ring-slate-200/70">
        <TabButton active={tab === "folha"} onClick={() => setTab("folha")}>
          Folha de Ponto
        </TabButton>
        <TabButton
          active={tab === "funcionarios"}
          onClick={() => setTab("funcionarios")}
        >
          Funcionários
        </TabButton>
      </nav>

      {msg && (
        <p className="mb-4 rounded-xl bg-indigo-50 text-indigo-800 ring-1 ring-indigo-100 p-3 text-sm">
          {msg}
        </p>
      )}

      {tab === "folha" && (
        <section>
          <div className="flex flex-wrap items-end gap-3 mb-4 card p-4">
            <label className="text-sm">
              <span className="field-label">De</span>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="field !p-2 !mt-1"
              />
            </label>
            <label className="text-sm">
              <span className="field-label">Até</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="field !p-2 !mt-1"
              />
            </label>
            <label className="text-sm">
              <span className="field-label">Funcionário</span>
              <select
                value={filterEmployee}
                onChange={(e) => setFilterEmployee(e.target.value)}
                className="field !p-2 !mt-1"
              >
                <option value="">Todos</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </label>
            <a
              href={exportUrl()}
              className="ml-auto rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-4 py-2.5 font-semibold shadow-lg shadow-emerald-500/25 transition hover:from-emerald-700 hover:to-teal-700"
            >
              ⬇ Exportar Excel
            </a>
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-slate-500 text-xs uppercase tracking-wider">
                  <th className="p-3 font-semibold">Funcionário</th>
                  <th className="p-3 font-semibold">Data</th>
                  {COLS.map((c) => (
                    <th key={c.key} className="p-3 font-semibold">
                      {c.label}
                    </th>
                  ))}
                  <th className="p-3 font-semibold">Horas</th>
                  <th className="p-3 font-semibold">Baixar</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="p-8 text-center text-slate-400"
                    >
                      {loadingSheet
                        ? "Carregando…"
                        : "Nenhuma marcação no período."}
                    </td>
                  </tr>
                )}
                {rows.map((r) => (
                  <tr
                    key={`${r.employeeId}-${r.workDate}`}
                    className="border-t border-slate-100 hover:bg-slate-50/60 transition"
                  >
                    <td className="p-3 font-medium text-slate-800">
                      {r.employeeName}
                    </td>
                    <td className="p-3 text-slate-600">{formatBr(r.workDate)}</td>
                    {COLS.map((c) => (
                      <td key={c.key} className="p-2">
                        <input
                          type="time"
                          defaultValue={r[c.key] as string}
                          onBlur={(e) => {
                            if (e.target.value !== (r[c.key] as string)) {
                              correct(r, c.type, e.target.value);
                            }
                          }}
                          className="rounded-lg border border-slate-200 bg-white p-1 w-28 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                        />
                      </td>
                    ))}
                    <td className="p-3 font-semibold text-slate-800 tabular-nums">
                      {r.worked}
                    </td>
                    <td className="p-2">
                      <a
                        href={exportUrl(r.employeeId)}
                        title={`Baixar Excel de ${r.employeeName} no período`}
                        className="inline-block rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 px-3 py-1 text-xs font-semibold hover:bg-emerald-100 whitespace-nowrap transition"
                      >
                        ⬇ Excel
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Dica: edite um horário e clique fora do campo para salvar a correção.
            Apague o horário para remover a marcação.
          </p>
        </section>
      )}

      {tab === "funcionarios" && (
        <section className="space-y-6">
          <div className="card p-5">
            <h2 className="font-semibold mb-3 text-slate-800">Novo funcionário</h2>
            <div className="flex flex-wrap gap-3 items-end">
              <label className="text-sm">
                <span className="field-label">Nome</span>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="field !p-2 !mt-1"
                />
              </label>
              <label className="text-sm">
                <span className="field-label">Jornada semanal</span>
                <select
                  value={newHours}
                  onChange={(e) => setNewHours(Number(e.target.value))}
                  className="field !p-2 !mt-1"
                >
                  {HOURS_OPTIONS.map((h) => (
                    <option key={h} value={h}>
                      {h}h
                    </option>
                  ))}
                </select>
              </label>
              <button
                onClick={addEmployee}
                disabled={!newName.trim()}
                className="btn-primary px-5 py-2.5"
              >
                Adicionar
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-3">
              O funcionário cria o próprio PIN no primeiro acesso à tela de ponto.
            </p>
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-slate-500 text-xs uppercase tracking-wider">
                  <th className="p-3 font-semibold">Nome</th>
                  <th className="p-3 font-semibold">Jornada</th>
                  <th className="p-3 font-semibold">PIN</th>
                  <th className="p-3 font-semibold">Situação</th>
                  <th className="p-3 font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((e) => (
                  <tr
                    key={e.id}
                    className="border-t border-slate-100 hover:bg-slate-50/60 transition"
                  >
                    <td className="p-3">
                      <input
                        defaultValue={e.name}
                        onBlur={(ev) => {
                          if (ev.target.value.trim() && ev.target.value !== e.name)
                            patchEmployee(e.id, { name: ev.target.value });
                        }}
                        className="rounded-lg border border-slate-200 bg-white p-1.5 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                      />
                    </td>
                    <td className="p-3">
                      <select
                        value={e.weekly_hours}
                        onChange={(ev) =>
                          patchEmployee(e.id, {
                            weeklyHours: Number(ev.target.value),
                          })
                        }
                        className="rounded-lg border border-slate-200 bg-white p-1.5 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                      >
                        {HOURS_OPTIONS.map((h) => (
                          <option key={h} value={h}>
                            {h}h
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-3">
                      {e.has_pin ? (
                        <span className="badge bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                          Definido
                        </span>
                      ) : (
                        <span className="badge bg-amber-50 text-amber-700 ring-1 ring-amber-100">
                          Aguardando 1º acesso
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      {e.active ? (
                        <span className="badge bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                          Ativo
                        </span>
                      ) : (
                        <span className="badge bg-slate-100 text-slate-500 ring-1 ring-slate-200">
                          Inativo
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() =>
                          patchEmployee(e.id, { active: !e.active })
                        }
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-50 transition"
                      >
                        {e.active ? "Desativar" : "Reativar"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
        active
          ? "bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200"
          : "text-slate-500 hover:text-slate-700"
      }`}
    >
      {children}
    </button>
  );
}

function formatBr(d: string) {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}
