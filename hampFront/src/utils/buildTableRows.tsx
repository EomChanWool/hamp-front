import type { ReactNode } from "react";
import { Badge } from "../components/Badge";
import { getStatusTone } from "../data/mesScreens";
import type { MesRow } from "../data/mesScreens";
import type { StatusTone } from "../types";

const BADGE_COLUMNS = new Set([
  "사용여부",
  "승인상태",
  "상태",
  "현재상태",
  "알림등급",
  "완료상태",
  "출고여부",
  "판정기준",
]);

const toneColorMap: Record<StatusTone, string> = {
  good: "#10b981",
  warn: "#f59e0b",
  danger: "#f87171",
  info: "#60a5fa",
  muted: "#94a3b8",
  limits: "#a78bfa",
};

const DEFECT_TYPE_COLORS: Record<string, string> = {
  이물: "#10b981",
  중량미달: "#ef4444",
  파손: "#ff8c3a",
  색상불량: "#8b5cf6",
  포장불량: "#eab308",
  기타: "#64748b",
};

const 처리구분_COLORS: Record<string, string> = {
  입고: "#34d399",
  출고: "#fb7185",
  조정: "#94a3b8",
};

const 처리상태_COLORS: Record<string, string> = {
  접수: "#818cf8",
  신고접수: "#818cf8",
  원인분석중: "#e879f9",
  미처리: "#e879f9",
  처리중: "#e879f9",
  반납대기: "#e879f9",
  조치완료: "#22d3ee", 
  반납완료: "#22d3ee",
  폐기: "#94a3b8",
  취소: "#94a3b8",
};

const 조치내용_COLORS: Record<string, string> = {
  "센서 교체 완료": "#34d399",
  "현장 확인 중": "#fbbf24",
  부품교체: "#38bdf8",
  캘리브레이션: "#c084fc",
  윤활작업: "#fb923c",
};

const 출입목적_COLORS: Record<string, string> = {
  정기점검: "#38bdf8",
  원료납품: "#34d399",
  품질확인: "#c084fc",
  출하: "#fb923c",
};

const VALUE_COLOR_MAP: Record<string, Record<string, string>> = {
  불량유형: DEFECT_TYPE_COLORS,
  처리구분: 처리구분_COLORS,
  처리상태: 처리상태_COLORS,
  조치내용: 조치내용_COLORS,
  출입목적: 출입목적_COLORS,
};

const ACTION_VALUES = new Set(["수정/삭제", "상세", "처리", "등록/수정"]);

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

        // 값 → 색상 직접 매핑 컬럼 (불량유형, 처리구분, 처리상태, 조치내용, 출입목적)
        const colorMap = VALUE_COLOR_MAP[colName];
        if (colorMap) {
          const color = colorMap[value];
          if (color) {
            return <span style={{ color, fontWeight: 600 }}>{value}</span>;
          }
        }

        // 고장내용 — tone 기반 텍스트 컬러
        if (colName === "고장내용") {
          const tone = getStatusTone(value);
          if (tone !== "muted") {
            return <span style={{ color: toneColorMap[tone], fontWeight: 600 }}>{value}</span>;
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
