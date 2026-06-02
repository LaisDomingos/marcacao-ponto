"use client";

import { useEffect, useState, useCallback } from "react";

type PunchType = "entrada" | "almoco_saida" | "almoco_volta" | "saida";

interface DayStatus {
  employeeId: number;
  employeeName: string;
  weeklyHours: number;
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

type ColKey = "entrada" | "almocoSaida" | "almocoVolta" | "saida";
const ALL_COLS: { key: ColKey; type: PunchType; label: string }[] = [
  { key: "entrada", type: "entrada", label: "Entr." },
  { key: "almocoSaida", type: "almoco_saida", label: "Almoço" },
  { key: "almocoVolta", type: "almoco_volta", label: "Volta" },
  { key: "saida", type: "saida", label: "Saída" },
];

// 20h não tem almoço: só entrada e saída.
function colsFor(weeklyHours: number) {
  return weeklyHours === 20
    ? ALL_COLS.filter((c) => c.type === "entrada" || c.type === "saida")
    : ALL_COLS;
}

export default function Kiosk({
  companyId,
  companyName,
  companyLogo,
  allowManual,
}: {
  companyId: number;
  companyName: string;
  companyLogo: string | null;
  allowManual: boolean;
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

  // ---- Preenchimento em massa do mês (fim do mês) ----
  const [showBulk, setShowBulk] = useState(false);
  const [bulkTimes, setBulkTimes] = useState({
    entrada: "09:00",
    almocoSaida: "12:00",
    almocoVolta: "13:00",
    saida: "18:00",
  });
  // Dias da semana trabalhados (0=Dom … 6=Sáb). Padrão: seg–sex.
  const [bulkDays, setBulkDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [bulkSaving, setBulkSaving] = useState(false);

  // Pré-visualização: abrir a tela com ?fim-mes=1 mostra o botão de
  // preenchimento do mês como se estivéssemos no fim do mês.
  const [previewEndOfMonth, setPreviewEndOfMonth] = useState(false);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setPreviewEndOfMonth(p.has("fim-mes") || p.get("preview") === "fim-mes");
  }, []);

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

  // Lançamento/ajuste manual de um horário (quando a empresa permite).
  async function manualSave(date: string, type: PunchType, time: string) {
    setError("");
    setConfirmation("");
    const res = await fetch("/api/punch/manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId: selectedId, pin, workDate: date, type, time }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Erro ao salvar a marcação.");
      return;
    }
    await loadStatus(); // recarrega status + histórico (recalcula horas)
  }

  // Preenche o mês de uma vez com os horários-base, nos dias da semana escolhidos.
  async function bulkFill() {
    setError("");
    setConfirmation("");
    if (bulkDays.length === 0) {
      setError("Selecione ao menos um dia da semana.");
      return;
    }
    setBulkSaving(true);
    try {
      // 20h não tem almoço: envia só entrada e saída.
      const times =
        status?.weeklyHours === 20
          ? { entrada: bulkTimes.entrada, saida: bulkTimes.saida }
          : bulkTimes;
      const res = await fetch("/api/punch/manual/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: selectedId,
          pin,
          times,
          weekdays: bulkDays,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao preencher o mês.");
        return;
      }
      setShowBulk(false);
      setConfirmation(
        data.daysFilled > 0
          ? `${data.daysFilled} dia(s) preenchido(s). Ajuste o que precisar abaixo.`
          : "Nenhum dia vazio para preencher (os dias já tinham marcação)."
      );
      await loadStatus();
    } finally {
      setBulkSaving(false);
    }
  }

  // Ferramenta de teste: apaga todas as marcações do funcionário.
  async function clearAll() {
    if (
      !window.confirm(
        "Apagar TODAS as marcações deste funcionário? (ferramenta de teste)"
      )
    )
      return;
    setError("");
    setConfirmation("");
    const res = await fetch("/api/punch/manual/clear", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId: selectedId, pin }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Erro ao apagar.");
      return;
    }
    setConfirmation("Todas as marcações foram apagadas.");
    await loadStatus();
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
                  {allowManual ? "mês atual + histórico" : "hoje + últimos 31 dias"}
                </span>
              </div>

              {allowManual && (
                <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 ring-1 ring-amber-100">
                  ✎ Você pode lançar/ajustar os horários dos dias do mês atual.
                  Clique fora do campo para salvar; apague para remover.
                </p>
              )}

              {allowManual && (isEndOfMonth() || previewEndOfMonth) && !showBulk && (
                <button
                  onClick={() => setShowBulk(true)}
                  className="btn-ghost mb-3 w-full p-2.5 ring-1 ring-indigo-200 text-indigo-700"
                >
                  📅 Preencher o mês de uma vez
                </button>
              )}

              {allowManual && showBulk && (
                <BulkFill
                  cols={colsFor(status.weeklyHours)}
                  times={bulkTimes}
                  setTimes={setBulkTimes}
                  days={bulkDays}
                  setDays={setBulkDays}
                  saving={bulkSaving}
                  onApply={bulkFill}
                  onCancel={() => setShowBulk(false)}
                />
              )}

              <PunchTable
                cols={colsFor(status.weeklyHours)}
                rows={buildRows(status, history, allowManual)}
                highlightDate={todayStr()}
                scroll
                onSave={allowManual ? manualSave : undefined}
                editFrom={monthStartStr(todayStr())}
                editTo={
                  hasFutureFill(history)
                    ? monthEndStr(todayStr())
                    : todayStr()
                }
              />
            </div>

            {allowManual && previewEndOfMonth && (
              <button
                onClick={clearAll}
                className="mx-auto block rounded-lg px-4 py-2 text-sm font-medium text-red-600 ring-1 ring-red-200 hover:bg-red-50"
              >
                🗑 Apagar tudo (teste)
              </button>
            )}

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

function monthStartStr(dateStr: string) {
  return `${dateStr.slice(0, 7)}-01`;
}

function monthEndStr(dateStr: string) {
  const [y, m] = dateStr.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${dateStr.slice(0, 7)}-${String(last).padStart(2, "0")}`;
}

// "Fim do mês": do dia 15 em diante.
function isEndOfMonth() {
  return Number(todayStr().slice(8, 10)) >= 15;
}

const WEEKDAYS: { value: number; label: string }[] = [
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
  { value: 0, label: "Dom" },
];

const BULK_LABELS: Record<ColKey, string> = {
  entrada: "Entrada",
  almocoSaida: "Saída p/ almoço",
  almocoVolta: "Volta do almoço",
  saida: "Saída",
};

type BulkTimes = {
  entrada: string;
  almocoSaida: string;
  almocoVolta: string;
  saida: string;
};

function BulkFill({
  cols,
  times,
  setTimes,
  days,
  setDays,
  saving,
  onApply,
  onCancel,
}: {
  cols: { key: ColKey; type: PunchType; label: string }[];
  times: BulkTimes;
  setTimes: (t: BulkTimes) => void;
  days: number[];
  setDays: (d: number[]) => void;
  saving: boolean;
  onApply: () => void;
  onCancel: () => void;
}) {
  const toggleDay = (v: number) =>
    setDays(days.includes(v) ? days.filter((d) => d !== v) : [...days, v]);

  return (
    <div className="mb-3 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
      <p className="mb-3 text-sm font-semibold text-slate-700">
        Preencher o mês com horários-base
      </p>

      <div className="mb-3">
        <span className="field-label">Dias da semana trabalhados</span>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {WEEKDAYS.map((w) => {
            const on = days.includes(w.value);
            return (
              <button
                key={w.value}
                type="button"
                onClick={() => toggleDay(w.value)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ring-1 transition ${
                  on
                    ? "bg-indigo-600 text-white ring-indigo-600"
                    : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-100"
                }`}
              >
                {w.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cols.map((c) => (
          <label key={c.key} className="block">
            <span className="field-label">{BULK_LABELS[c.key]}</span>
            <input
              type="time"
              value={times[c.key]}
              onChange={(e) => setTimes({ ...times, [c.key]: e.target.value })}
              className="field tabular-nums"
            />
          </label>
        ))}
      </div>

      <p className="mt-2 text-xs text-slate-500">
        Aplica aos dias selecionados do mês inteiro que ainda não têm marcação.
        Depois você pode ajustar cada dia na tabela.
      </p>

      <div className="mt-3 flex gap-2">
        <button
          onClick={onApply}
          disabled={saving}
          className="btn-primary flex-1 p-2.5 disabled:opacity-50"
        >
          {saving ? "Preenchendo…" : "Preencher"}
        </button>
        <button
          onClick={onCancel}
          disabled={saving}
          className="btn-ghost px-4 py-2.5"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

function emptyRow(workDate: string): HistoryRow {
  return {
    workDate,
    entrada: "",
    almocoSaida: "",
    almocoVolta: "",
    saida: "",
    worked: "—",
  };
}

// Há marcação em algum dia FUTURO do mês atual? (ou seja, o mês já foi
// preenchido até o fim via botão). Define se a tabela mostra o mês inteiro.
function hasFutureFill(history: HistoryRow[]): boolean {
  const today = todayStr();
  const ym = today.slice(0, 7);
  return history.some((r) => r.workDate.startsWith(ym) && r.workDate > today);
}

// Linhas da tabela. Com lançamento manual, mostra os dias do mês atual (mesmo
// vazios) para serem editados, e abaixo os dias de meses anteriores do histórico
// (somente leitura). Mostra o mês INTEIRO se o futuro já foi preenchido; caso
// contrário, só até hoje.
function buildRows(
  status: DayStatus,
  history: HistoryRow[],
  allowManual: boolean
): HistoryRow[] {
  if (!allowManual) return mergedRows(status, history);

  const today = todayStr();
  const ym = today.slice(0, 7);
  const lastDay = hasFutureFill(history)
    ? Number(monthEndStr(today).slice(8, 10))
    : Number(today.slice(8, 10)); // só até hoje

  const byDate = new Map(history.map((r) => [r.workDate, r]));
  byDate.set(today, todayRow(status, history)); // hoje vem do status

  const monthDays: HistoryRow[] = [];
  for (let d = lastDay; d >= 1; d--) {
    const wd = `${ym}-${String(d).padStart(2, "0")}`;
    monthDays.push(byDate.get(wd) ?? emptyRow(wd));
  }

  const older = history
    .filter((r) => r.workDate < `${ym}-01`)
    .sort((a, b) => b.workDate.localeCompare(a.workDate));

  return [...monthDays, ...older];
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
  cols,
  rows,
  scroll = false,
  highlightDate,
  onSave,
  editFrom,
  editTo,
}: {
  cols: { key: ColKey; type: PunchType; label: string }[];
  rows: HistoryRow[];
  scroll?: boolean;
  highlightDate?: string;
  onSave?: (date: string, type: PunchType, time: string) => void;
  editFrom?: string;
  editTo?: string;
}) {
  const canEdit = (date: string) =>
    !!onSave &&
    (!editFrom || date >= editFrom) &&
    (!editTo || date <= editTo);

  return (
    <div className="overflow-hidden rounded-xl ring-1 ring-slate-100">
      <div className={scroll ? "max-h-96 overflow-y-auto" : ""}>
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-3 py-2 font-semibold">Data</th>
              {cols.map((c) => (
                <th key={c.key} className="px-2 py-2 font-semibold">
                  {c.label}
                </th>
              ))}
              <th className="px-3 py-2 text-right font-semibold">Horas</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isToday = r.workDate === highlightDate;
              const editable = canEdit(r.workDate);
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
                  {cols.map(({ key, type }) => {
                    const value = r[key] as string;
                    if (editable) {
                      return (
                        <td key={key} className="px-2 py-1.5">
                          <input
                            type="time"
                            key={`${r.workDate}-${type}-${value}`}
                            defaultValue={value}
                            onBlur={(e) => {
                              if (e.target.value !== value)
                                onSave!(r.workDate, type, e.target.value);
                            }}
                            className="w-24 rounded border border-slate-200 p-1 tabular-nums"
                          />
                        </td>
                      );
                    }
                    return (
                      <td
                        key={key}
                        className="px-2 py-2 tabular-nums text-slate-600"
                      >
                        {value || "—"}
                      </td>
                    );
                  })}
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
