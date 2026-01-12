/**
 * Format a date to Brazilian format DD/MM/YYYY.
 */
export function formatDateBR(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Parse a date string in either YYYY-MM-DD or DD/MM/YYYY format as local time.
 * Returns null if the string doesn't match any expected format.
 */
export function parseLocalDate(text: string): Date | null {
  // Try YYYY-MM-DD format first
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, yearStr, monthStr, dayStr] = isoMatch;
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10) - 1;
    const day = parseInt(dayStr, 10);
    return new Date(year, month, day);
  }

  // Try DD/MM/YYYY format
  const brMatch = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) {
    const [, dayStr, monthStr, yearStr] = brMatch;
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10) - 1;
    const day = parseInt(dayStr, 10);
    return new Date(year, month, day);
  }

  return null;
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
