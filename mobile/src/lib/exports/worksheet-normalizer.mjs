export function normalizeWorksheetRows(rows) {
  return rows.map((row, rowIndex) =>
    row.map((cell, cellIndex) => {
      if (typeof cell === 'number') {
        if (cellIndex === 0 && Number.isInteger(cell)) {
          return String(cell);
        }
        if (row[0] === 'Dia de vencimento' && cellIndex === 1 && Number.isInteger(cell)) {
          return String(cell);
        }
        return cell.toFixed(2).replace('.', ',');
      }
      if (cellIndex === 1 && /^[0-9]+\.[0-9]+%$/.test(cell)) {
        return cell.replace('.', ',');
      }
      return String(cell);
    }),
  );
}
