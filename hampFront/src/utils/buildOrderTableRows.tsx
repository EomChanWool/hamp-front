import type { ReactNode } from "react";
import { Badge } from "../components/Badge";
import { getStatusTone } from "../data/mesScreens";
import type { MesRow } from "../data/mesScreens";

export function buildOrderTableRows(
  rows: MesRow[],
  columns: string[],
): Array<Array<ReactNode>> {
  return rows.map((row) => {
    return Array.from({ length: columns.length }, (_, i) => {
      const value = row[`c${i}`] ?? "";
      const colName = columns[i] ?? "";
      if (colName === "상태") {
        return <Badge tone={getStatusTone(value)}>{value}</Badge>;
      }
      return value;
    });
  });
}
//     return [
//       ...cells,
//       <div className="rowActions" key="actions">
//         <button
//           type="button"
//           className="miniButton"
//           onClick={(e) => {
//             e.stopPropagation();
//             onDetail(row);
//           }}
//         >
//           상세
//         </button>
//         <button
//           type="button"
//           className="miniButton danger"
//           onClick={(e) => {
//             e.stopPropagation();
//             onDelete(row);
//           }}
//         >
//           삭제
//         </button>
//       </div>,
//     ];
//   });
// }