// Utilidades de data/hora com fuso horário fixo (padrão Europe/Lisbon).
// Armazenamos sempre o instante em UTC (ISO) e derivamos a data/horário local
// para agrupar por dia e exibir.

export const TIMEZONE = process.env.TZ || "Europe/Lisbon";

/** Data atual (instante UTC) como ISO 8601. */
export function nowIso(): string {
  return new Date().toISOString();
}

/** Retorna YYYY-MM-DD do instante informado, no fuso configurado. */
export function workDate(iso: string = nowIso()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
  return parts; // en-CA já formata como YYYY-MM-DD
}

/** Hora local HH:MM (24h) do instante informado. */
export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

/** Primeiro dia (YYYY-MM-01) do mês da data informada (padrão: hoje). */
export function monthStart(dateStr: string = workDate()): string {
  return `${dateStr.slice(0, 7)}-01`;
}

/** Data legível DD/MM/AAAA a partir de YYYY-MM-DD. */
export function formatDateBr(workDateStr: string): string {
  const [y, m, d] = workDateStr.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Converte um horário de parede (YYYY-MM-DD + HH:MM) no fuso configurado para
 * o instante UTC correspondente (ISO 8601). Usado nas correções manuais.
 */
export function zonedWallTimeToUtc(workDateStr: string, time: string): string {
  const [y, mo, d] = workDateStr.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const naive = Date.UTC(y, mo - 1, d, h, mi, 0);

  // Itera duas vezes para acomodar transições de horário de verão.
  let ts = naive - tzOffsetMs(new Date(naive));
  ts = naive - tzOffsetMs(new Date(ts));
  return new Date(ts).toISOString();
}

function tzOffsetMs(date: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const map: Record<string, number> = {};
  for (const p of dtf.formatToParts(date)) {
    if (p.type !== "literal") map[p.type] = Number(p.value);
  }
  const asUtc = Date.UTC(
    map.year,
    map.month - 1,
    map.day,
    map.hour === 24 ? 0 : map.hour,
    map.minute,
    map.second
  );
  return asUtc - date.getTime();
}

/** Converte minutos em "HH:MM". */
export function minutesToHHMM(totalMinutes: number): string {
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return "00:00";
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
