import type {
  SalesOrderAllocationGroup,
  SalesOrderLineRequest,
  SalesOrderLineResponse,
} from "@/api/sales/SalesOrder";

/** 배분 분기별 산출 품목 코드 (서버 시뮬레이션 API의 고정 분기와 동일) */
export const ALLOCATION_ITEM = {
  oil: "HEMP_OIL",
  seed: "HEMP_SEED_PRODUCT",
  powder: "HEMP_POWDER",
  conc: "HEMP_PARK_CONC",
} as const;

/** 수주 투입원료 품목 코드 - 원물 시뮬레이션이 이 품목으로 고정돼 있어 수주 투입원료도 고정 */
export const RAW_ITEM_CODE = "HEMP_SEED";

/** 시뮬레이션 응답에서 헴프박(재투입 대상 부산물) 품목 코드 */
export const PARK_ITEM_CODE = "HEMP_PARK";

/** 화면 설계(목업) 기본값 */
export const DEFAULT_OIL_PERCENT = 60;
export const DEFAULT_POWDER_PERCENT = 70;

export type AllocationPercents = {
  oilPercent: number;
  powderPercent: number;
};

const ALLOCATION_LINE_DEFS: {
  itemCode: string;
  group: SalesOrderAllocationGroup;
  percent: (p: AllocationPercents) => number;
}[] = [
  { itemCode: ALLOCATION_ITEM.oil, group: "RAW", percent: (p) => p.oilPercent },
  { itemCode: ALLOCATION_ITEM.seed, group: "RAW", percent: (p) => 100 - p.oilPercent },
  { itemCode: ALLOCATION_ITEM.powder, group: "PARK", percent: (p) => p.powderPercent },
  { itemCode: ALLOCATION_ITEM.conc, group: "PARK", percent: (p) => 100 - p.powderPercent },
];

/** 입력값을 0~100 정수 비율로 보정 (숫자가 아닌 문자는 제거) */
export function clampPercent(raw: string | number): number {
  const digits = String(raw).replace(/[^0-9]/g, "");
  if (digits === "") return 0;
  return Math.min(100, Math.max(0, Number(digits)));
}

/**
 * 비율 직접 입력값 해석 - 숫자 외 문자는 제거, 빈 값은 0.
 * 100을 넘거나 소수·음수면 null(반영하지 않음) - 점·부호만 지워 1.5 → 15, -5 → 5로 바뀌는 것을 막는다
 */
export function parsePercentInput(raw: string): number | null {
  if (/[.-]/.test(raw)) return null;
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits === "") return 0;
  const value = Number(digits);
  return value > 100 ? null : value;
}

/**
 * 배분 비율로 저장용 수주 라인 4개(RAW 2 + PARK 2)를 만든다.
 * existingLines가 있으면 같은 품목의 salesOrderLineId를 이어받아 기존 라인을 갱신한다.
 */
export function buildAllocationLines(
  percents: AllocationPercents,
  existingLines: Pick<SalesOrderLineResponse, "salesOrderLineId" | "itemCode">[] = [],
): SalesOrderLineRequest[] {
  return ALLOCATION_LINE_DEFS.map((def) => {
    const existing = existingLines.find((line) => line.itemCode === def.itemCode);
    return {
      ...(existing?.salesOrderLineId != null ? { salesOrderLineId: existing.salesOrderLineId } : {}),
      itemCode: def.itemCode,
      allocationGroup: def.group,
      allocationPercent: def.percent(percents),
    };
  });
}

/** 저장된 라인에서 배분 비율을 읽는다. 해당 라인이 없으면 기본값을 쓴다. */
export function readAllocationPercents(
  lines: Pick<SalesOrderLineResponse, "itemCode" | "allocationGroup" | "allocationPercent">[],
): AllocationPercents {
  const percentOf = (itemCode: string, group: SalesOrderAllocationGroup) => {
    const line = lines.find((l) => l.itemCode === itemCode && l.allocationGroup === group);
    return line?.allocationPercent != null ? clampPercent(Math.round(line.allocationPercent)) : null;
  };
  const oil = percentOf(ALLOCATION_ITEM.oil, "RAW");
  const seed = percentOf(ALLOCATION_ITEM.seed, "RAW");
  const powder = percentOf(ALLOCATION_ITEM.powder, "PARK");
  const conc = percentOf(ALLOCATION_ITEM.conc, "PARK");
  return {
    oilPercent: oil ?? (seed != null ? 100 - seed : DEFAULT_OIL_PERCENT),
    powderPercent: powder ?? (conc != null ? 100 - conc : DEFAULT_POWDER_PERCENT),
  };
}

/** 배분 그룹이 없는(구 방식) 라인이 있는지 */
export function hasLegacyLines(lines: Pick<SalesOrderLineResponse, "allocationGroup">[]): boolean {
  return lines.some((line) => line.allocationGroup == null);
}

export function formatQty(qty: number | null | undefined, unit?: string | null): string {
  if (qty == null) return "-";
  return `${qty.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}${unit ? ` ${unit}` : ""}`;
}
