import type { ReactNode } from "react";
import type { MesRow } from "../data/mesScreens";


export function buildDeliveryTableRows(
  rows: MesRow[],
  columns: string[],
): Array<Array<ReactNode>> {
  return rows.map((row) => {
    return Array.from({ length: columns.length }, (_, i) => row[`c${i}`] ?? "");
  });
}

// export function buildDeliveryTableRows(
//   rows: MesRow[],
//   columnCount: number,
//   onDetail: (row: MesRow) => void,
//   onDelete: (row: MesRow) => void,
// ): Array<Array<ReactNode>> {
//   return rows.map((row) => {
//     const cells = Array.from({ length: columnCount }, (_, i) => row[`c${i}`] ?? "");

//     return [
//       ...cells,
//       <div className="rowActions" key="actions">
//         <button type="button" className="miniButton" onClick={(e) => { e.stopPropagation(); onDetail(row); }}>상세</button>
//         <button type="button" className="miniButton danger" onClick={(e) => { e.stopPropagation(); onDelete(row); }}>삭제</button>
//       </div>,
//     ];
//   });
// }