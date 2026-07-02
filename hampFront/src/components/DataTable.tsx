import type { ReactNode } from "react";

type DataTableProps = {
  headers: string[];
  rows: Array<Array<ReactNode>>;
  onRowClick?: (rowIndex: number) => void;
};

export function DataTable({ headers, rows, onRowClick }: DataTableProps) {
  if (import.meta.env.DEV) {
    rows.forEach((row, i) => {
      if (row.length !== headers.length) {
        console.warn(`DataTable: row[${i}] has ${row.length} cells, expected ${headers.length}`);
      }
    });
  }

  return (
    <div className="tableWrap">
      <table>
        // DataTable.tsx
        <colgroup>
          {headers.map((_h, i) => {
            const isLast = i === headers.length - 1;
            return <col key={i} style={{ width: isLast ? '150px' : 'auto' }} />;
           })}
         </colgroup>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} onClick={() => onRowClick?.(ri)} style={{ cursor: onRowClick ? "pointer" : "default" }}>
              {row.map((cell, ci) => (
                <td key={ci}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
