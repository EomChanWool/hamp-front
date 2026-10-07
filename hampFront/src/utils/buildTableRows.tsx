import type { ReactNode } from "react";
import { Badge } from "@components/common/Badge";
import { getStatusTone } from "@/data/mesScreens";
import type { MesRow } from "@/data/mesScreens";
import type { StatusTone } from "@/types";

const BADGE_COLUMNS = new Set([
  "사용여부",
  "승인상태",
  "상태",
  "현재상태",
  "알림등급",
  "완료상태",
  "출고여부",
  "판정기준",
  "처리상태",
]);

const ACTION_VALUES = new Set(["수정/삭제", "상세", "처리", "등록/수정"]);

/** 컬럼별 값 → 톤. 지정하지 않은 값은 일반 본문색으로 출력 */
const VALUE_TONE_MAP: Record<string, Record<string, StatusTone>> = {
  출입목적: {
    정기점검: "info",
  },
  불량유형: {
    파손: "danger",
    중량미달: "warn",
    이물: "warn",
  },
  처리구분: {
    입고: "good",
    출고: "info",
  },
  조치내용: {
    "센서 교체 완료": "good",
    "현장 확인 중": "warn",
  },
};

export function buildTableRows(
  rows: MesRow[],
  columnCount: number,
  onDetail: (row: MesRow) => void,
  onDelete: (row: MesRow) => void,
  columns?: string[],
): Array<Array<ReactNode>> {
  return rows.map((row) => {
    const lastValue = row[`c${columnCount - 1}`] ?? "";
    const dataCount = ACTION_VALUES.has(lastValue) ? columnCount - 1 : columnCount;

    return [
      ...Array.from({ length: dataCount }, (_, i) => {
        const value = row[`c${i}`] ?? "";
        const colName = columns?.[i] ?? "";

        // 뱃지 컬럼
        if (BADGE_COLUMNS.has(colName)) {
          return <Badge tone={getStatusTone(value)}>{value}</Badge>;
        }

        // 값별 톤 텍스트 (매핑된 값만 색, 나머지는 본문색)
        const mappedTone = VALUE_TONE_MAP[colName]?.[value];
        if (mappedTone) {
          return <span className={`valueText ${mappedTone}`}>{value}</span>;
        }

        // 고장내용 — tone 기반 텍스트 컬러
        if (colName === "고장내용") {
          const tone = getStatusTone(value);
          if (tone !== "muted") {
            return <span className={`valueText ${tone}`}>{value}</span>;
          }
        }

        return value;
      }),
      <div className="rowActions">
        <button
          type="button"
          className="miniButton"
          onClick={(e) => {
            e.stopPropagation();
            onDetail(row);
          }}
        >
          상세
        </button>
        <button
          type="button"
          className="miniButton danger"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(row);
          }}
        >
          삭제
        </button>
      </div>,
    ];
  });
}

export function buildOrderTableRows(
  rows: any[],
  columnCount: number,
): Array<Array<React.ReactNode>> {
  return rows.map((row) => {
    return Array.from({ length: columnCount }, (_, i) => row[`c${i}`] ?? "");
  });
}

//DeliveryTableRows
export function buildDeliveryTableRows(rows: any[], columnCount: number, _columns: string[]) {
  return rows.map((row) => {
    return Array.from({ length: columnCount }, (_, i) => row[`c${i}`] ?? "");
  });
}