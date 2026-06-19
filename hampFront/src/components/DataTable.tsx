import type { ReactNode } from "react";

type DataTableProps = {
  headers: string[];
  rows: Array<Array<ReactNode>>;
  onRowClick?: (rowIndex: number) => void;
};

export function DataTable({ headers, rows, onRowClick }: DataTableProps) {
  return (
    <div className="tableWrap">
      <table>
        <colgroup>
          <col style={{ width: "5%" }} />
          <col style={{ width: "10%" }} />
          <col style={{ width: "22%" }} />
          <col style={{ width: "12%" }} />
          <col style={{ width: "12%" }} />
          <col style={{ width: "14%" }} />
          <col style={{ width: "15%" }} />
          <col style={{ width: "10%" }} />
        </colgroup>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              onClick={() => onRowClick?.(rowIndex)}
              style={{ cursor: onRowClick ? "pointer" : "default" }}
            >
              {row.map((cell, cellIndex) => (
                <td key={`${rowIndex}-${cellIndex}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}