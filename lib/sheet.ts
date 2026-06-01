import { getSupabase } from "./supabase";
import type { Punch, PunchType } from "./types";
import { computeWorkedMinutes } from "./punch";
import { formatTime, minutesToHHMM } from "./time";

export interface SheetRow {
  employeeId: number;
  employeeName: string;
  workDate: string; // YYYY-MM-DD
  entrada: string; // HH:MM ou ""
  almocoSaida: string;
  almocoVolta: string;
  saida: string;
  workedMinutes: number;
  worked: string; // HH:MM
}

export interface SheetFilters {
  companyId: number;
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  employeeId?: number;
}

interface JoinedPunch extends Punch {
  employees: { name: string } | null;
}

/**
 * Monta a folha de ponto: uma linha por funcionário/dia no período, com os
 * horários das quatro marcações e o total de horas trabalhadas.
 */
export async function buildSheet(filters: SheetFilters): Promise<SheetRow[]> {
  let query = getSupabase()
    .from("punches")
    .select("id, employee_id, type, punched_at, work_date, employees(name)")
    .eq("company_id", filters.companyId);

  if (filters.from) query = query.gte("work_date", filters.from);
  if (filters.to) query = query.lte("work_date", filters.to);
  if (filters.employeeId) query = query.eq("employee_id", filters.employeeId);

  const { data, error } = await query.order("punched_at");
  if (error) throw error;

  const rows = (data ?? []) as unknown as JoinedPunch[];

  // Agrupa por funcionário+dia.
  const groups = new Map<string, JoinedPunch[]>();
  for (const r of rows) {
    const key = `${r.employee_id}|${r.work_date}`;
    const arr = groups.get(key) ?? [];
    arr.push(r);
    groups.set(key, arr);
  }

  const result: SheetRow[] = [];
  for (const punches of groups.values()) {
    const timeOf = (t: PunchType) => {
      const p = punches.find((x) => x.type === t);
      return p ? formatTime(p.punched_at) : "";
    };
    const workedMinutes = computeWorkedMinutes(punches as Punch[]);
    result.push({
      employeeId: punches[0].employee_id,
      employeeName: punches[0].employees?.name ?? "—",
      workDate: punches[0].work_date,
      entrada: timeOf("entrada"),
      almocoSaida: timeOf("almoco_saida"),
      almocoVolta: timeOf("almoco_volta"),
      saida: timeOf("saida"),
      workedMinutes,
      worked: minutesToHHMM(workedMinutes),
    });
  }

  result.sort(
    (a, b) =>
      a.employeeName.localeCompare(b.employeeName) ||
      a.workDate.localeCompare(b.workDate)
  );

  return result;
}
