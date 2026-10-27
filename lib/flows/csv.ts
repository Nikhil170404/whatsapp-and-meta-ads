/**
 * Leads as CSV. Cells that start with = + - @ are prefixed with an apostrophe so a spreadsheet never
 * runs them as a formula (a customer typing "=HYPERLINK(...)" as their name must not become an attack).
 */
const escape = (v: unknown): string => {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function leadsToCsv(leads: { created_at: string; flow_name?: string | null; phone: string; name?: string | null; email?: string | null; fields?: Record<string, string> | null; note?: string | null }[]): string {
  const keys = new Set<string>();
  for (const l of leads) for (const k of Object.keys(l.fields ?? {})) if (!["name", "email"].includes(k)) keys.add(k);
  const extra = [...keys].sort();
  const header = ["Date", "Flow", "Phone", "Name", "Email", ...extra, "Note"];
  const rows = leads.map((l) => [
    l.created_at, l.flow_name, l.phone.startsWith("+") ? l.phone : `+${l.phone}`, l.name, l.email,
    ...extra.map((k) => l.fields?.[k]), l.note,
  ]);
  return [header, ...rows].map((r) => r.map(escape).join(",")).join("\r\n") + "\r\n";
}
