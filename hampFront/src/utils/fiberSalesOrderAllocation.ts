import type {
    FiberSalesOrderLineRequest,
    FiberSalesOrderLineResponse,
    FiberSalesOrderStatus,
} from '@/api/sales/FiberSalesOrder';
import type { ItemCategory } from '@/api/master/Item';

/** 섬유 수주 - 제품별 원물 배분 공통 유틸 */

// ── 상수 ──────────────────────────────────────────────────────────────────────

/**
 * 품목 옵션 조회 시 사용할 카테고리
 * - 투입원료(인피)는 씨드 수주와 동일하게 [0] (원물)
 * - TODO: 가공 요청 제품(솜/슬라이버 등)의 카테고리 값은 프로젝트 품목 분류에 맞게 조정
 */
export const FIBER_RAW_ITEM_CATEGORY: ItemCategory[] = [0];
export const FIBER_PRODUCT_ITEM_CATEGORY: ItemCategory[] = [2];

/** 투입원료/배분 수량 단위 (API 스펙상 kg 고정) */
export const FIBER_QTY_UNIT = 'kg';

/** 수주 상태 라벨 */
export const FIBER_STATUS_LABEL: Record<string, string> = {
    RECEIVED: '접수',
    IN_PROGRESS: '진행 중',
    COMPLETED: '완료',
    CANCELLED: '취소',
};

/** 수주 상태 셀렉트 옵션 (상세 수정/목록 검색 공용) */
export const FIBER_STATUS_OPTIONS: { value: FiberSalesOrderStatus; label: string }[] = [
    { value: 'RECEIVED', label: FIBER_STATUS_LABEL.RECEIVED },
    { value: 'IN_PROGRESS', label: FIBER_STATUS_LABEL.IN_PROGRESS },
    { value: 'COMPLETED', label: FIBER_STATUS_LABEL.COMPLETED },
    { value: 'CANCELLED', label: FIBER_STATUS_LABEL.CANCELLED },
];


// ── 배분 라인 (화면용 상태) ───────────────────────────────────────────────────

/**
 * 화면에서 편집하는 배분 라인
 * - key : React 렌더링용 임시 키 (서버로는 전송하지 않는다)
 * - fiberSalesOrderLineId : 기존 라인이면 서버 ID, 신규 라인이면 null
 */
export interface FiberAllocationLine {
    key: string;
    fiberSalesOrderLineId: number | null;
    productItemCode: string;
    allocatedInputQty: number | null;
}

let lineKeySeq = 0;
const nextLineKey = () => `fso-line-${++lineKeySeq}`;

/** 빈 배분 라인 생성 (제품 추가 버튼 / 등록 초기값) */
export const createEmptyLine = (): FiberAllocationLine => ({
    key: nextLineKey(),
    fiberSalesOrderLineId: null,
    productItemCode: '',
    allocatedInputQty: null,
});

/** 상세 응답의 라인 → 편집용 라인 (라인이 없으면 빈 라인 1개) */
export const toAllocationLines = (
    lines: FiberSalesOrderLineResponse[] | null | undefined,
): FiberAllocationLine[] =>
    lines && lines.length > 0
        ? lines.map((line) => ({
            key: nextLineKey(),
            fiberSalesOrderLineId: line.fiberSalesOrderLineId,
            productItemCode: line.productItemCode,
            allocatedInputQty: line.allocatedInputQty,
        }))
        : [createEmptyLine()];

/**
 * 편집용 라인 → 서버 요청 라인
 * - 기존 라인은 fiberSalesOrderLineId 를 그대로 보내 수정, 신규 라인은 ID를 생략한다.
 */
export const buildLineRequests = (lines: FiberAllocationLine[]): FiberSalesOrderLineRequest[] =>
    lines.map((line) => ({
        ...(line.fiberSalesOrderLineId != null ? { fiberSalesOrderLineId: line.fiberSalesOrderLineId } : {}),
        productItemCode: line.productItemCode,
        allocatedInputQty: Number(line.allocatedInputQty),
    }));


// ── 계산 / 포맷 ───────────────────────────────────────────────────────────────

/** 소수 둘째 자리 반올림 (부동소수점 오차 방지) */
export const r2 = (n: number) => Math.round(n * 100) / 100;

/** 배분량 합계 */
export const sumAllocated = (lines: FiberAllocationLine[]) =>
    r2(lines.reduce((acc, line) => acc + (line.allocatedInputQty ?? 0), 0));

/** 투입원료 총량 대비 배분 비율(%) - 총량이 없으면 0 */
export const calcPercent = (qty: number, total: number) => (total > 0 ? r2((qty / total) * 100) : 0);

/** 수량 표시 (천단위 구분, 소수 최대 2자리) */
export const formatKg = (n: number | null | undefined) =>
    n == null ? '-' : n.toLocaleString('ko-KR', { maximumFractionDigits: 2 });

/** 금액 표시 */
export const formatWon = (n: number | null | undefined) =>
    n == null ? '-' : `${n.toLocaleString('ko-KR')} 원`;

/** 오늘 날짜(yyyy-MM-dd, 로컬 기준) - 수주일 기본값 */
export const todayString = () => {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};


// ── 검증 ──────────────────────────────────────────────────────────────────────

export type FiberOrderValidationField =
    | 'bpCode'
    | 'rawItemCode'
    | 'requestInputQty'
    | 'lines'
    | 'orderDate'
    | 'dueDate';

export interface FiberOrderValidationInput {
    bpCode: string;
    rawItemCode: string;
    requestInputQty: number | null;
    lines: FiberAllocationLine[];
    orderDate: string;
    dueDate: string;
}

export interface FiberOrderValidationError {
    /** 포커스를 줄 입력 영역 */
    field: FiberOrderValidationField;
    message: string;
}

/**
 * 등록/수정 공통 검증 - 첫 번째 오류만 반환한다. (오류가 없으면 null)
 * - 서버 검증과 같은 흐름: 필수값 → 라인 → 중복 제품 → 합계 일치 → 날짜 순서
 */
export const validateFiberOrder = (input: FiberOrderValidationInput): FiberOrderValidationError | null => {
    const { bpCode, rawItemCode, requestInputQty, lines, orderDate, dueDate } = input;
    const total = requestInputQty ?? 0;

    if (!bpCode) return { field: 'bpCode', message: '거래처를 선택해주세요.' };
    if (!rawItemCode) return { field: 'rawItemCode', message: '투입원료를 선택해주세요.' };
    if (requestInputQty == null) return { field: 'requestInputQty', message: '투입원료 수량을 입력해주세요.' };
    if (!(total > 0)) return { field: 'requestInputQty', message: '투입원료 수량은 0보다 커야 합니다.' };
    if (!orderDate) return { field: 'orderDate', message: '수주일을 입력해주세요.' };

    if (lines.length === 0) return { field: 'lines', message: '제품별 원물 배분을 1건 이상 입력해주세요.' };
    if (lines.some((l) => !l.productItemCode)) return { field: 'lines', message: '배분할 제품을 선택해주세요.' };
    if (lines.some((l) => l.allocatedInputQty == null)) {
        return { field: 'lines', message: '제품별 원물 배분량을 입력해주세요.' };
    }
    if (lines.some((l) => !((l.allocatedInputQty ?? 0) > 0))) {
        return { field: 'lines', message: '제품별 원물 배분량은 0보다 커야 합니다.' };
    }
    if (new Set(lines.map((l) => l.productItemCode)).size !== lines.length) {
        return { field: 'lines', message: '같은 제품을 두 번 배분할 수 없습니다.' };
    }

    const sum = sumAllocated(lines);
    if (sum !== r2(total)) {
        return {
            field: 'lines',
            message: `제품별 배분량 합계(${formatKg(sum)} kg)가 투입원료 수량(${formatKg(total)} kg)과 일치하지 않습니다.`,
        };
    }

    if (dueDate && dueDate < orderDate) {
        return { field: 'dueDate', message: '납기일은 수주일보다 빠를 수 없습니다.' };
    }
    return null;
};
