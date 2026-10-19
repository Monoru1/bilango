import { currentVersion, formatFcfa, isEdited, type Business, type Report } from '@gobilan/domain';
import { dayLong, hhmm } from './format';

/** Contenu texte du bilan du jour (testable, indépendant de jsPDF). PDF texte pur, généré à la volée, jamais stocké (§7.2). */
export function reportLines(business: Pick<Business, 'name'>, day: string, reports: Report[], offset: number): string[] {
  const out: string[] = [`GoBilan — ${business.name}`, `Bilan du ${dayLong(day)}`, ''];
  let revenue = 0, expenses = 0, cashIn = 0;
  for (const r of reports) {
    const c = currentVersion(r).content;
    revenue += c.revenue.total;
    expenses += c.expenses.total;
    cashIn += c.cashIn.total;
    out.push(`${r.authorName} — ${hhmm(r.submittedAt, offset)}${isEdited(r) ? ' (modifié)' : ''}`);
    out.push(`  Chiffre d'affaires : ${formatFcfa(c.revenue.total)}`);
    for (const l of c.revenue.lines) out.push(`    - ${l.label} : ${formatFcfa(l.amount)}`);
    out.push(`  Dépenses : ${formatFcfa(c.expenses.total)}`);
    for (const l of c.expenses.lines) out.push(`    - ${l.label} : ${formatFcfa(l.amount)}`);
    out.push(`  Ajout à la caisse : ${formatFcfa(c.cashIn.total)}`);
    if (c.note) out.push(`  Note : ${c.note}`);
    out.push('');
  }
  out.push(`Total du jour — CA : ${formatFcfa(revenue)} · Dépenses : ${formatFcfa(expenses)} · Ajouts : ${formatFcfa(cashIn)}`);
  // Espaces fines/insécables → espace simple : la police PDF standard ne les rend pas.
  return out.map((l) => l.replace(/[\u202f\u00a0]/g, ' '));
}

export async function downloadReportPdf(business: Pick<Business, 'name'>, day: string, reports: Report[], offset: number): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  doc.setFont('helvetica', 'normal');
  let y = 56;
  for (const line of reportLines(business, day, reports, offset)) {
    doc.setFontSize(line.startsWith('GoBilan') ? 16 : 11);
    for (const part of doc.splitTextToSize(line, 480) as string[]) {
      if (y > 780) { doc.addPage(); y = 56; }
      doc.text(part, 56, y);
      y += 16;
    }
  }
  doc.save(`bilan-${day}.pdf`);
}
