/**
 * Parse a YYYY-MM-DD date string as local time (not UTC).
 * Returns null if the string doesn't match the expected format.
 */
export function parseLocalDate(text: string): Date | null {
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, yearStr, monthStr, dayStr] = match;
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1; // JS months are 0-indexed
  const day = parseInt(dayStr, 10);
  return new Date(year, month, day);
}

/**
 * Parse a currency string (Brazilian format) to a number.
 * Handles formats like "300000", "300.000,00", "R$ 300.000,00"
 */
export function parseCurrencyInput(value: string): number {
  if (!value.trim()) return 0;
  const cleaned = value
    .replace(/\s/g, '')
    .replace(/R\$/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const parsed = Number.parseFloat(cleaned);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Parse a number string with Brazilian decimal format (comma as decimal separator).
 */
export function parseNumberInput(value: string): number {
  const parsed = Number.parseFloat(value.replace(',', '.'));
  return Number.isNaN(parsed) ? 0 : parsed;
}
