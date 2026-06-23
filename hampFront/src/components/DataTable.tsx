import type { ReactNode } from "react";

type DataTableProps = {
  headers: string[];
  rows: Array<Array<ReactNode>>;
  onRowClick?: (rowIndex: number) => void;
};

export function DataTable({ headers, rows, onRowClick }: DataTableProps) {

   if (process.env.NODE_ENV === 'development') {
    rows.forEach((row, i) => {
      if (row.length !== headers.length) {
        console.warn(`DataTable: row[${i}] has ${row.length} cells, expected ${headers.length}`)
      }
    })
  }

  return (
    <div className="tableWrap">
      <table>
        <colgroup>
          {headers.map((_, i) => <col key={i} />)}
        </colgroup>
        <thead>
          <tr>{headers.map(h => <th key={h}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} onClick={() => onRowClick?.(ri)} style={{ cursor: onRowClick ? 'pointer' : 'default' }}>
              {row.map((cell, ci) => <td key={ci}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}