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
  const cleaned = value.replace(/\s/g, '').replace(/R\$/g, '').replace(/\./g, '').replace(',', '.');
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

/**
 * Format currency input as user types (live masking).
 * User-friendly: just adds thousands separators, no forced decimals.
 * Example: typing "300000" displays "R$ 300.000"
 */
export function maskCurrencyInput(text: string): { display: string; value: number } {
  // Remove everything except digits and comma (decimal separator)
  let cleaned = text.replace(/[^\d,]/g, '');

  if (!cleaned) {
    return { display: '', value: 0 };
  }

  // Handle decimal part: only allow one comma, max 2 decimal places
  const parts = cleaned.split(',');
  let integerPart = parts[0];
  let decimalPart = parts.length > 1 ? parts[1].slice(0, 2) : null;

  // Remove leading zeros from integer part (but keep at least one digit)
  integerPart = integerPart.replace(/^0+/, '') || '0';

  // Add thousands separators to integer part
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  // Build display string with R$ prefix
  let display = `R$ ${formattedInteger}`;
  if (decimalPart !== null) {
    display += `,${decimalPart}`;
  }

  // Calculate numeric value
  const numericString = decimalPart !== null ? `${integerPart}.${decimalPart}` : integerPart;
  const value = parseFloat(numericString) || 0;

  return { display, value };
}
