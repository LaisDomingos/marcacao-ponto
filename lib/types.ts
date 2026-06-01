// Tipos compartilhados do domínio.

export type PunchType = "entrada" | "almoco_saida" | "almoco_volta" | "saida";

export interface Company {
  id: number;
  name: string;
  slug: string;
  logo_url: string | null;
  allow_manual_punch: boolean;
  created_at: string;
}

export type WeeklyHours = 20 | 32 | 40;

export interface Employee {
  id: number;
  company_id: number;
  name: string;
  pin_hash: string | null; // nulo até o funcionário definir no 1º acesso
  weekly_hours: WeeklyHours;
  active: boolean;
  created_at: string;
}

export interface Admin {
  id: number;
  company_id: number;
  email: string;
  password_hash: string;
  created_at: string;
}

export interface Punch {
  id: number;
  company_id: number;
  employee_id: number;
  type: PunchType;
  punched_at: string; // timestamptz (ISO, UTC)
  work_date: string; // date (YYYY-MM-DD)
  created_at: string;
}
