// CSV serialisation with protection against spreadsheet formula injection.
// Cells starting with = + - @ tab or CR can be executed as formulas by Excel/Sheets,
// so they are prefixed with an apostrophe. Plain phone numbers (+ and digits only)
// cannot form a formula and are left intact.

const SAFE_PHONE = /^\+\d{7,15}$/;

export function sanitizeCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  if (SAFE_PHONE.test(text)) return text;
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

function escapeCell(value: unknown): string {
  const text = sanitizeCell(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  const lines = [header, ...rows].map((row) => row.map(escapeCell).join(","));
  // BOM so Excel detects UTF-8; CRLF per RFC 4180.
  return `﻿${lines.join("\r\n")}\r\n`;
}
