"use client";

import { useEffect, useState, useCallback } from "react";

type PunchType = "entrada" | "almoco_saida" | "almoco_volta" | "saida";

interface DayStatus {
  employeeId: number;
  employeeName: string;
  done: { type: PunchType; label: string; time: string }[];
  next: PunchType | null;
  finished: boolean;
}

interface HistoryRow {
  workDate: string;
  entrada: string;
  almocoSaida: string;
  almocoVolta: string;
  saida: string;
  worked: string;
}

const NEXT_BUTTON_LABEL: Record<PunchType, string> = {
  entrada: "Registrar Entrada",
  almoco_saida: "Registrar Saída para Almoço",
  almoco_volta: "Registrar Volta do Almoço",
  saida: "Registrar Saída",
};

export default function Kiosk({
  companyId,
  companyName,
  companyLogo,
}: {
  companyId: number;
  companyName: string;
  companyLogo: string | null;
}) {
  const [employees, setEmployees] = useState<
    { id: number; name: string; hasPin: boolean }[]
  >([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [status, setStatus] = useState<DayStatus | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);

  const loadEmployees = useCallback(() => {
    fetch(`/api/employees?companyId=${companyId}`)
      .then((r) => r.json())
      .then((d) => setEmployees(d.employees ?? []))
      .catch(() => setError("Não foi possível carregar a lista de funcionários."));
  }, [companyId]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  const selectedEmp = employees.find((e) => e.id === selectedId) ?? null;
  // Primeiro acesso: funcionário selecionado que ainda não definiu o PIN.
  const isFirstAccess = selectedEmp != null && !selectedEmp.hasPin;

  const reset = useCallback(() => {
    setSelectedId(null);
    setPin("");
    setPinConfirm("");
    setStatus(null);
    setHistory([]);
    setError("");
    setConfirmation("");
  }, []);

  async function loadHistory(id: number, pinValue: string) {
    try {
      const res = await fetch("/api/punch/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: id, pin: pinValue }),
      });
      if (res.ok) setHistory((await res.json()).rows ?? []);
    } catch {
      // histórico é secundário; ignora falha
    }
  }

  // Primeiro acesso: define o PIN e já entra.
  async function createPin() {
    setError("");
    if (pin.length !== 4) {
      setError("O PIN deve ter 4 dígitos.");
      return;
    }
    if (pin !== pinConfirm) {
      setError("Os PINs não conferem.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/punch/set-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: selectedId, pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao criar o PIN.");
        return;
      }
      loadEmployees(); // atualiza hasPin
      await loadStatus(); // entra no fluxo normal
    } finally {
      setLoading(false);
    }
  }

  async function loadStatus() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/punch/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: selectedId, pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao validar PIN.");
        return;
      }
      setStatus(data.status);
      if (selectedId) loadHistory(selectedId, pin);
    } finally {
      setLoading(false);
    }
  }

  async function punch() {
    setError("");
    setConfirmation("");
    setLoading(true);
    try {
      const res = await fetch("/api/punch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: selectedId, pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao registrar marcação.");
        if (data.status) setStatus(data.status);
        return;
      }
      setStatus(data.status);
      const marcada = data.status.done.find(
        (d: DayStatus["done"][number]) => d.type === data.registered.type
      );
      setConfirmation(
        `${data.registered.label} registrada às ${marcada?.time ?? ""} ✓`
      );
      if (selectedId) loadHistory(selectedId, pin);
      setTimeout(reset, 4000);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className={`w-full card p-8 ${status ? "max-w-4xl" : "max-w-md"}`}>
        <div className="mb-6 text-center">
          {companyLogo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={companyLogo}
              alt={companyName}
              className="mx-auto mb-3 h-20 w-20 rounded-2xl object-contain bg-white ring-1 ring-slate-200"
            />
          )}
          <span className="badge bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100">
            {companyName}
          </span>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
            Marcação de Ponto
          </h1>
          <p className="mt-1 text-slate-500 capitalize">{hojeFmt()}</p>
        </div>

        {!status && (
          <div className="space-y-4">
            <label className="block">
              <span className="field-label">Funcionário</span>
              <select
                className="field text-lg"
                value={selectedId ?? ""}
                onChange={(e) =>
                  setSelectedId(e.target.value ? Number(e.target.value) : null)
                }
              >
                <option value="">Selecione seu nome…</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                    {e.hasPin ? "" : " (1º acesso)"}
                  </option>
                ))}
              </select>
            </label>

            {isFirstAccess && (
              <p className="rounded-xl bg-indigo-50 text-indigo-800 ring-1 ring-indigo-100 p-3 text-sm">
                👋 Primeiro acesso: crie o seu PIN de 4 dígitos. Ele será pedido
                nas próximas vezes — guarde-o em segredo.
              </p>
            )}

            <label className="block">
              <span className="field-label">
                {isFirstAccess ? "Crie seu PIN (4 dígitos)" : "PIN (4 dígitos)"}
              </span>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                className="field text-center text-3xl tracking-[0.6em]"
                value={pin}
                onChange={(e) =>
                  setPin(e.target.value.replace(/\D/g, "").slice(0, 4))
                }
                placeholder="••••"
              />
            </label>

            {isFirstAccess && (
              <label className="block">
                <span className="field-label">Confirme o PIN</span>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  className="field text-center text-3xl tracking-[0.6em]"
                  value={pinConfirm}
                  onChange={(e) =>
                    setPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 4))
                  }
                  placeholder="••••"
                />
              </label>
            )}

            <button
              onClick={isFirstAccess ? createPin : loadStatus}
              disabled={!selectedId || pin.length !== 4 || loading}
              className="btn-primary w-full p-3.5 text-lg"
            >
              {loading
                ? "Aguarde…"
                : isFirstAccess
                  ? "Criar PIN e entrar"
                  : "Continuar"}
            </button>
          </div>
        )}

        {status && (
          <div className="space-y-6">
            <p className="text-center text-lg text-slate-600">
              Olá, <strong className="text-slate-900">{status.employeeName}</strong>
            </p>

            {confirmation && (
              <p className="rounded-xl bg-emerald-100 text-emerald-800 p-3 text-center font-semibold">
                {confirmation}
              </p>
            )}

            {status.finished && !confirmation && (
              <p className="rounded-xl bg-slate-100 text-slate-700 p-3 text-center font-semibold">
                Expediente encerrado hoje ✓
              </p>
            )}

            {status.next && !confirmation && (
              <button
                onClick={punch}
                disabled={loading}
                className="btn-primary w-full p-4 text-xl"
              >
                {loading ? "Registrando…" : NEXT_BUTTON_LABEL[status.next]}
              </button>
            )}

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                  Meu ponto
                </h2>
                <span className="text-xs text-slate-400">
                  hoje + últimos 31 dias
                </span>
              </div>

              <PunchTable
                rows={mergedRows(status, history)}
                highlightDate={todayStr()}
                scroll
              />
            </div>

            <button
              onClick={reset}
              className="btn-ghost w-full p-2.5 md:mx-auto md:w-64 md:block"
            >
              Voltar
            </button>
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-xl bg-red-50 text-red-700 ring-1 ring-red-100 p-3 text-center text-sm">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}

function todayStr() {
  return new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD local
}

// Monta a linha de hoje a partir do status, no mesmo formato da tabela.
function todayRow(status: DayStatus, history: HistoryRow[]): HistoryRow {
  const today = todayStr();
  const timeOf = (t: PunchType) =>
    status.done.find((d) => d.type === t)?.time ?? "";
  return {
    workDate: today,
    entrada: timeOf("entrada"),
    almocoSaida: timeOf("almoco_saida"),
    almocoVolta: timeOf("almoco_volta"),
    saida: timeOf("saida"),
    worked: history.find((r) => r.workDate === today)?.worked ?? "—",
  };
}

// Junta o dia de hoje (no topo) com o histórico, sem duplicar a linha de hoje.
function mergedRows(status: DayStatus, history: HistoryRow[]): HistoryRow[] {
  const today = todayStr();
  return [
    todayRow(status, history),
    ...history.filter((r) => r.workDate !== today),
  ];
}

function PunchTable({
  rows,
  scroll = false,
  highlightDate,
}: {
  rows: HistoryRow[];
  scroll?: boolean;
  highlightDate?: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl ring-1 ring-slate-100">
      <div className={scroll ? "max-h-80 overflow-y-auto" : ""}>
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-3 py-2 font-semibold">Data</th>
              <th className="px-2 py-2 font-semibold">Entr.</th>
              <th className="px-2 py-2 font-semibold">Almoço</th>
              <th className="px-2 py-2 font-semibold">Volta</th>
              <th className="px-2 py-2 font-semibold">Saída</th>
              <th className="px-3 py-2 text-right font-semibold">Horas</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isToday = r.workDate === highlightDate;
              return (
              <tr
                key={r.workDate}
                className={`border-t border-slate-100 ${
                  isToday
                    ? "bg-indigo-50/70 hover:bg-indigo-50"
                    : "hover:bg-slate-50/70"
                }`}
              >
                <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-700">
                  {formatBr(r.workDate)}
                  {isToday && (
                    <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700 align-middle">
                      hoje
                    </span>
                  )}
                </td>
                <td className="px-2 py-2 tabular-nums text-slate-600">
                  {r.entrada || "—"}
                </td>
                <td className="px-2 py-2 tabular-nums text-slate-600">
                  {r.almocoSaida || "—"}
                </td>
                <td className="px-2 py-2 tabular-nums text-slate-600">
                  {r.almocoVolta || "—"}
                </td>
                <td className="px-2 py-2 tabular-nums text-slate-600">
                  {r.saida || "—"}
                </td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums text-indigo-700">
                  {r.worked}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatBr(d: string) {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function hojeFmt() {
  return new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}
