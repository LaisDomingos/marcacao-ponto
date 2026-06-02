import bcrypt from "bcryptjs";
import { getSupabase } from "./supabase";
import type { Employee, Punch, PunchType } from "./types";
import { nextPunchType, punchStepsFor, PUNCH_LABELS } from "./punch";
import { formatTime, workDate } from "./time";

// Jornadas semanais permitidas (horas contratadas).
export const ALLOWED_WEEKLY_HOURS = [20, 32, 40];

export interface DayStatus {
  employeeId: number;
  employeeName: string;
  weeklyHours: number;
  done: { type: PunchType; label: string; time: string; iso: string }[];
  next: PunchType | null;
  finished: boolean;
}

export async function getActiveEmployees(
  companyId: number
): Promise<{ id: number; name: string; hasPin: boolean }[]> {
  const { data, error } = await getSupabase()
    .from("employees")
    .select("id, name, pin_hash")
    .eq("company_id", companyId)
    .eq("active", true)
    .order("name");
  if (error) throw error;
  // Nunca devolvemos o hash ao cliente — só se o PIN já foi definido.
  return (data ?? []).map((e) => ({
    id: e.id,
    name: e.name,
    hasPin: e.pin_hash != null,
  }));
}

/** Valida o PIN do funcionário; retorna o registro se válido, senão null. */
export async function verifyPin(
  id: number,
  pin: string
): Promise<Employee | null> {
  const { data } = await getSupabase()
    .from("employees")
    .select("*")
    .eq("id", id)
    .eq("active", true)
    .maybeSingle();
  if (!data) return null;
  const emp = data as Employee;
  if (!emp.pin_hash) return null; // PIN ainda não definido (1º acesso pendente)
  return bcrypt.compareSync(pin, emp.pin_hash) ? emp : null;
}

export async function getTodaysPunches(employeeId: number): Promise<Punch[]> {
  const { data } = await getSupabase()
    .from("punches")
    .select("*")
    .eq("employee_id", employeeId)
    .eq("work_date", workDate())
    .order("punched_at");
  return (data ?? []) as Punch[];
}

export async function buildDayStatus(emp: Employee): Promise<DayStatus> {
  const punches = await getTodaysPunches(emp.id);
  const done = punches.map((p) => ({
    type: p.type,
    label: PUNCH_LABELS[p.type],
    time: formatTime(p.punched_at),
    iso: p.punched_at,
  }));
  const next = nextPunchType(
    punches.map((p) => p.type),
    punchStepsFor(emp.weekly_hours)
  );
  return {
    employeeId: emp.id,
    employeeName: emp.name,
    weeklyHours: emp.weekly_hours,
    done,
    next,
    finished: next === null,
  };
}
