import type { Punch, PunchType } from "./types";

// Ordem fixa das marcações ao longo do dia.
export const PUNCH_ORDER: PunchType[] = [
  "entrada",
  "almoco_saida",
  "almoco_volta",
  "saida",
];

export const PUNCH_LABELS: Record<PunchType, string> = {
  entrada: "Entrada",
  almoco_saida: "Saída para Almoço",
  almoco_volta: "Volta do Almoço",
  saida: "Saída",
};

// Texto do botão de ação para cada próximo passo.
export const PUNCH_BUTTON_LABELS: Record<PunchType, string> = {
  entrada: "Registrar Entrada",
  almoco_saida: "Saída para Almoço",
  almoco_volta: "Registrar Volta do Almoço",
  saida: "Registrar Saída",
};

/**
 * Dado o conjunto de tipos já marcados no dia, retorna o próximo tipo esperado
 * ou null se o expediente já estiver encerrado.
 */
export function nextPunchType(
  existingTypes: PunchType[],
  order: PunchType[] = PUNCH_ORDER
): PunchType | null {
  for (const type of order) {
    if (!existingTypes.includes(type)) return type;
  }
  return null;
}

/**
 * Etapas de marcação conforme a jornada. Jornada de 20h não tem almoço:
 * apenas entrada e saída. Demais jornadas têm as 4 marcações.
 */
export function punchStepsFor(weeklyHours: number): PunchType[] {
  return weeklyHours === 20 ? ["entrada", "saida"] : PUNCH_ORDER;
}

/**
 * Calcula os minutos trabalhados no dia:
 *   (saída p/ almoço − entrada) + (saída − volta do almoço)
 * Marcações faltantes são tratadas sem quebrar (retorna o parcial possível).
 */
export function computeWorkedMinutes(dayPunches: Punch[]): number {
  const byType = new Map<PunchType, string>();
  for (const p of dayPunches) byType.set(p.type, p.punched_at);

  const entrada = byType.get("entrada");
  const almocoSaida = byType.get("almoco_saida");
  const almocoVolta = byType.get("almoco_volta");
  const saida = byType.get("saida");

  let minutes = 0;

  // Manhã: da entrada até a saída para o almoço.
  if (entrada && almocoSaida) {
    minutes += diffMinutes(entrada, almocoSaida);
  } else if (entrada && saida && !almocoSaida && !almocoVolta) {
    // Dia sem almoço registrado: entrada direto até a saída.
    minutes += diffMinutes(entrada, saida);
    return Math.max(0, minutes);
  }

  // Tarde: da volta do almoço até a saída.
  if (almocoVolta && saida) {
    minutes += diffMinutes(almocoVolta, saida);
  }

  return Math.max(0, minutes);
}

function diffMinutes(fromIso: string, toIso: string): number {
  return (new Date(toIso).getTime() - new Date(fromIso).getTime()) / 60000;
}
