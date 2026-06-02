import ExcelJS from "exceljs";
import type { SheetRow } from "./sheet";

const DARK_BLUE: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF1F4E79" },
};
const WEEKEND_BLUE: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF2E5496" },
};

const DOW_PT = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];
const MONTHS_PT = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

// Número no padrão PT com vírgula e 2 casas (ex.: 8,00 / 1,50).
function n2(x: number): string {
  return (Math.round(x * 100) / 100).toFixed(2).replace(".", ",");
}

function diffHours(a: string, b: string): number {
  if (!a || !b) return 0;
  const [ah, am] = a.split(":").map(Number);
  const [bh, bm] = b.split(":").map(Number);
  return Math.max(0, (bh * 60 + bm - (ah * 60 + am)) / 60);
}

/**
 * Folha mensal no formato "Registo Diário de Horas de Trabalho":
 * título com o nome da empresa, funcionário, mês, uma linha por dia do mês
 * (fins de semana destacados) e linhas de assinatura. `rows` traz só os dias
 * com marcação; os demais saem zerados.
 */
export function buildMonthlySheet(
  wb: ExcelJS.Workbook,
  opts: {
    companyName: string;
    employeeName: string;
    weeklyHours: number;
    month: string; // AAAA-MM
    rows: SheetRow[];
    sheetName?: string; // nome da aba (default: nome do funcionário)
  }
) {
  const { companyName, employeeName, weeklyHours, month, rows } = opts;
  // Excel limita a 31 chars e proíbe \ / ? * [ ] :
  const tabName = (opts.sheetName ?? employeeName ?? "Registo")
    .replace(/[\\/?*[\]:]/g, " ")
    .slice(0, 31)
    .trim() || "Registo";
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const yy = String(y).slice(2);
  const dailyNormal = weeklyHours / 5; // horas normais por dia trabalhado
  const semAlmoco = weeklyHours === 20;

  const ws = wb.addWorksheet(tabName);

  // Título com o nome da empresa.
  ws.mergeCells("A1:J1");
  const title = ws.getCell("A1");
  title.value = `${companyName} — Registo Diário de Horas de Trabalho`;
  title.font = { bold: true, size: 13, color: { argb: "FFFFFFFF" } };
  title.fill = DARK_BLUE;
  title.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(1).height = 24;

  ws.mergeCells("A3:J3");
  ws.getCell("A3").value = "Não segue nenhuma Contratação Coletiva de Trabalho.";
  ws.getCell("A3").font = { size: 9 };

  // Funcionário (esq.) + Mês (dir.).
  ws.getCell("A5").value = `Funcionário: ${employeeName}`;
  ws.getCell("A5").font = { bold: true, size: 11 };
  ws.getCell("H5").value = "Mês";
  ws.getCell("H5").font = { bold: true, size: 9 };
  ws.mergeCells("I5:J5");
  ws.getCell("I5").value = `${MONTHS_PT[m - 1]} de ${y}`;
  ws.getCell("I5").font = { bold: true };

  // Cabeçalho da tabela.
  const header = ws.addRow([
    "Data",
    "Dia Semana",
    "Entrada",
    "Saída",
    "Início Pausa",
    "Fim Pausa",
    "Pausa (h)",
    "Horas Trabalhadas",
    "Horas Normais",
    "Horas Extra",
  ]);
  header.eachCell((cell) => {
    cell.fill = DARK_BLUE;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });

  const byDate = new Map(rows.map((r) => [r.workDate, r]));

  for (let d = 1; d <= lastDay; d++) {
    const wd = `${month}-${String(d).padStart(2, "0")}`;
    const dow = new Date(`${wd}T12:00:00Z`).getUTCDay();
    const r = byDate.get(wd);

    const entrada = r?.entrada ?? "";
    const saida = r?.saida ?? "";
    const inicioPausa = semAlmoco ? "" : r?.almocoSaida ?? "";
    const fimPausa = semAlmoco ? "" : r?.almocoVolta ?? "";
    // Dia vazio (sem nenhuma marcação) fica no tom escuro.
    const vazio = !entrada && !saida && !inicioPausa && !fimPausa;
    const pausa = diffHours(inicioPausa, fimPausa);
    const worked = (r?.workedMinutes ?? 0) / 60;
    const normal = Math.min(worked, dailyNormal);
    const extra = Math.max(0, worked - dailyNormal);

    const row = ws.addRow([
      `${m}/${d}/${yy}`,
      DOW_PT[dow],
      entrada,
      saida,
      inicioPausa,
      fimPausa,
      n2(pausa),
      n2(worked),
      n2(normal),
      n2(extra),
    ]);
    row.alignment = { horizontal: "center" };
    row.getCell(1).alignment = { horizontal: "right" };
    if (vazio) {
      row.eachCell((cell) => {
        cell.fill = WEEKEND_BLUE;
        cell.font = { color: { argb: "FFFFFFFF" }, size: 10 };
      });
    } else {
      row.font = { size: 10 };
    }
  }

  // Assinaturas.
  ws.addRow([]);
  ws.addRow([]);
  ws.addRow(["Assinatura do Responsável da Empresa"]);
  ws.addRow([]);
  ws.addRow(["Assinatura do Funcionário"]);

  ws.columns = [
    { width: 10 },
    { width: 15 },
    { width: 9 },
    { width: 9 },
    { width: 12 },
    { width: 11 },
    { width: 10 },
    { width: 14 },
    { width: 12 },
    { width: 11 },
  ];
}

/** Nome de arquivo seguro a partir de um texto livre. */
export function slugFilename(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
