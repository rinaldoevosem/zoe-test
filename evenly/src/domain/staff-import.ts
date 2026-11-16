/**
 * Staff import (beta ticket 09): parse a spreadsheet exported as CSV into Staff Members. Pure; the service
 * upserts the rows by email. Columns (any order, case-insensitive): Name, Email, Clinical Role, FTE, Tags.
 * Tags are separated by ";" and a Certification carries its expiry as `tag:YYYY-MM-DD`.
 */
import type { LocalDate } from "./types";

export interface ImportedStaff {
  line: number;
  name: string;
  email: string;
  clinicalRole: string;
  fte: number;
  tags: string[];
  tagExpiry: Record<string, LocalDate>;
}

export interface ImportError { line: number; message: string }

export function parseStaffCsv(text: string): { rows: ImportedStaff[]; errors: ImportError[] } {
  const records = parseCsv(text).filter((r) => r.cells.some((c) => c.trim()));
  if (!records.length) return { rows: [], errors: [{ line: 1, message: "The file is empty" }] };
  const header = records[0].cells.map((h) => h.trim().toLowerCase().replace(/[\s_-]+/g, " "));
  const col = (...names: string[]) => header.findIndex((h) => names.includes(h));
  const at = { name: col("name"), email: col("email", "email address"), role: col("clinical role", "role"), fte: col("fte"), tags: col("tags", "skills") };
  if (at.name < 0 || at.email < 0) return { rows: [], errors: [{ line: records[0].line, message: "The first row needs Name and Email columns" }] };

  const rows: ImportedStaff[] = [];
  const errors: ImportError[] = [];
  const seen = new Set<string>();
  for (const { line, cells } of records.slice(1)) {
    const get = (i: number) => (i >= 0 ? (cells[i] ?? "").trim() : "");
    const name = get(at.name);
    const email = get(at.email).toLowerCase();
    const fteText = get(at.fte);
    const fte = fteText === "" ? 1 : Number(fteText);
    const fail = (message: string) => errors.push({ line, message });
    if (!name) { fail("Name is missing"); continue; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { fail(`Email "${get(at.email)}" doesn't look like an email address`); continue; }
    if (!(fte > 0 && fte <= 1)) { fail("FTE must be above 0 and at most 1"); continue; }
    if (seen.has(email)) { fail(`${email} appears more than once`); continue; }
    const tags: string[] = [];
    const tagExpiry: Record<string, LocalDate> = {};
    let bad = "";
    for (const raw of get(at.tags).split(";").map((t) => t.trim()).filter(Boolean)) {
      const [tagPart, date] = raw.split(":").map((x) => x.trim());
      const tag = tagPart.toLowerCase();
      if (date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(date)) { bad = `Tag expiry "${date}" must be a date like 2027-03-31`; break; }
      if (!tags.includes(tag)) tags.push(tag);
      if (date) tagExpiry[tag] = date;
    }
    if (bad) { fail(bad); continue; }
    seen.add(email);
    rows.push({ line, name, email, clinicalRole: get(at.role) || "physician", fte, tags, tagExpiry });
  }
  return { rows, errors };
}

/** RFC 4180-style CSV: quoted fields may hold commas, quotes ("") and newlines. Records keep their starting line. */
function parseCsv(text: string): { line: number; cells: string[] }[] {
  const out: { line: number; cells: string[] }[] = [];
  let cells: string[] = [], cell = "", quoted = false, line = 1, start = 1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else { if (ch === "\n") line++; cell += ch; }
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { cells.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      cells.push(cell); out.push({ line: start, cells }); cells = []; cell = ""; line++; start = line;
    } else cell += ch;
  }
  if (cell || cells.length) { cells.push(cell); out.push({ line: start, cells }); }
  return out;
}
