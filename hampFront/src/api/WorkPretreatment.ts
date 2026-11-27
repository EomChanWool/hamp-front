import { apiClient } from '@/api/apiClient';
import type { ApiResponse } from '@/api/Common';
import type { SeedGoodsReceiptResponse } from '@/api/ioSeed/SeedGoodsReceipt';

/** 백엔드 연결 전까지 true. 연결 후 false 로 바꾸면 realApi 를 탄다. */
export const PRETREATMENT_USE_MOCK = false;

/** 기존 스캔 응답의 receiptId 타입을 그대로 따라간다 (number/string 어느 쪽이든 맞춰짐) */
export type ReceiptId = SeedGoodsReceiptResponse['receiptId'];

/* ============================================================================
 * 1) DTO 타입
 * ========================================================================== */

/** 전처리신고 등록 요청의 라인 */
export interface PretreatmentReportLineRequest {
  /** 투입할 입고건 ID */
  receiptId: number;
  /** 이번 배치에 투입하는 수량 (≥ 0) */
  inputQty: number;
}

/** 전처리신고 등록 요청 */
export interface PretreatmentReportCreateRequest {
  /** 이번 배치에 투입할 입고건 목록 (1건 이상) */
  lines: PretreatmentReportLineRequest[];
}

/** 탈피완료 요청 */
export interface PretreatmentReportHullingDoneRequest {
  /** 껍질 측정수량 (≥ 0) */
  hullQty: number;
  /** 탈피후씨드 체크포인트 측정수량 (≥ 0) — 검증용이며 재고에는 반영되지 않는다 (Swagger 설명) */
  semiSeedCheckpointQty: number;
}

/** 전처리신고 라인 응답 */
export interface PretreatmentReportLineResponse {
  lineId: number;
  receiptId: number;
  inputQty: number;
}

/**
 * 전처리신고 응답
 * [확인필요] Swagger 는 수량 필드를 전부 number 로 표기했지만, 완료 전에는 값이 없을 것이므로
 *            null 가능으로 잡았다. 실제로 0 으로 내려오는지 null 인지 백엔드 확인 필요.
 *            → 0 으로 내려와도 깨지지 않도록 toBatch 에서 status 기준으로 한 번 더 null 처리한다.
 */
export interface PretreatmentReportResponse {
  /** 전처리신고 ID */
  reportId: number;
  /** 진행상태 — [확인필요] 가능한 값 목록(코드값)을 백엔드와 확정. 현재는 STATUS_MAP 으로 추정 변환 */
  status: string;
  /** 껍질 측정수량(탈피완료 시점) */
  hullQty: number | null;
  /** 껍질 품목코드(처리 시점 스냅샷) */
  hullItemCode: string | null;
  /** 탈피후씨드 체크포인트 측정수량 */
  semiSeedCheckpointQty: number | null;
  /** 전처리후씨드 최종 측정수량(완료 시점) */
  finalSemiSeedQty: number | null;
  /** 전처리후씨드 품목코드(처리 시점 스냅샷) */
  semiSeedItemCode: string | null;
  /** 취소 사유 */
  cancelReason: string | null;
  /** 투입 입고건 목록 */
  lines: PretreatmentReportLineResponse[];
  createdAt: string;
  updatedAt: string;
}

/**
 * 입고 라벨 QR 스캔 조회 응답 (GET /pretreatment-reports/scan?code=)
 * 기존 SeedGoodsReceiptResponse 와 달리 barcode / returnedQty / reportStatus 등이 없고,
 * remainingQty 는 "전처리 투입 가능 잔여수량" 이다.
 * ※ barcode 필드가 없으므로, 화면에 라벨 번호를 보여주려면 "스캔할 때 보낸 code 문자열"을 따로 들고 있어야 한다.
 *   (화면의 DraftLine.code / 아래 receiptMeta 캐시가 그 역할)
 */
export interface PretreatmentScanReceipt {
  receiptId: number;
  itemCode: string;
  itemNm: string;
  unit: string;
  receiptQty: number;
  defectQty: number;
  goodQty: number;
  receivedAt: string;
  /** 투입 가능 잔여수량 (설계안 2-3: goodQty - Σ진행중/탈피완료/완료 배치의 N) */
  remainingQty: number;
}

/** 공통 응답 래퍼 { status, code, message, data } 를 씌운 최종 응답 타입 */
export type ApiResponsePretreatmentReportResponse = ApiResponse<PretreatmentReportResponse>;
export type ApiResponseListPretreatmentReportResponse = ApiResponse<PretreatmentReportResponse[]>;
export type ApiResponsePretreatmentScanReceipt = ApiResponse<PretreatmentScanReceipt>;

/* ============================================================================
 * 2) 화면에서 쓰는 모델
 * ========================================================================== */

export type PretreatmentStatus = 'PROGRESS' | 'DEHULLED' | 'DONE';

/** 라인: 헤더에 속한 입고건별 투입 기록 (설계안: receiptId, N) */
export interface PretreatmentLine {
  receiptId: ReceiptId;
  /** 서버 라인 응답에는 없음 → 스캔 때 받아둔 값으로 보완 (없으면 빈 문자열) */
  barcode: string;
  /** 서버 라인 응답에는 없음 → 스캔 때 받아둔 값으로 보완 */
  itemNm: string;
  /** 투입량 N */
  inputQty: number;
}

export interface PretreatmentBatch {
  /** = 서버 reportId */
  batchId: number;
  /** 화면에 보여줄 배치 번호 (서버 응답에 없어서 reportId 로 "B-001" 형태 생성) */
  batchNo: string;
  status: PretreatmentStatus;
  /** [확인필요] 서버 응답에 단위가 없다. 스캔 응답의 unit 을 받아 쓰고, 없으면 kg 로 가정 */
  unit: string;
  lines: PretreatmentLine[];
  /** 껍질 H — 탈피완료 이후에만 값 있음 */
  hullQty: number | null;
  /** 탈피후씨드 D — 탈피완료 이후에만 값 있음 (= 서버 semiSeedCheckpointQty, 검증용·재고 미반영) */
  dehulledQty: number | null;
  /** 전처리후씨드 M — 완료 이후에만 값 있음 (= 서버 finalSemiSeedQty) */
  finalQty: number | null;
}

/**
 * 홈 상단 재고 패널 (전처리전씨드 / 전처리후씨드 / 껍질)
 * [확인필요] 목업에는 있지만 백엔드에 "재고 조회 API"가 아직 없다(Swagger 확인).
 *            → 화면에서는 재고 조회 실패가 목록 조회를 막지 않도록 분리했다 (WorkSeedReportScanPage.refresh 참고).
 *            재고 패널이 필요 없으면 홈 화면의 workPtStock 블록과 getStock 만 지우면 된다.
 */
export interface PretreatmentStock {
  beforeQty: number;
  afterQty: number;
  hullQty: number;
}

export interface StartBatchRequest {
  /**
   * 백엔드 등록 요청(PretreatmentReportCreateRequest)에는 zone 이 없다.
   * 화면 호환을 위해 필드는 남기되 optional 로 바꾸고, realApi 에서는 서버로 보내지 않는다.
   * (화면은 이제 zone 을 넘기지 않는다. 다른 곳에서 안 쓰면 이 필드는 삭제해도 됨)
   */
  zone?: string;
  lines: { receiptId: ReceiptId; inputQty: number }[];
}
export interface DehullCompleteRequest {
  hullQty: number; // H
  dehulledQty: number; // D → 서버 semiSeedCheckpointQty
}
export interface FinalCompleteRequest {
  finalQty: number; // M
}

export interface PretreatmentApiShape {
  /**
   * 입고 라벨 QR 스캔 조회. (기존: SSE 로 스캔 결과를 받던 방식 → GET 조회)
   * code 는 QR 에 담긴 문자열 그대로. zone 파라미터는 더 이상 받지 않는다.
   * 실패(없는 라벨 등)는 axios 에러로 throw 된다 → 화면에서 err.response.data.message 로 표시.
   */
  scanReceipt(code: string): Promise<PretreatmentScanReceipt>;
  /**
   * - 전처리신고 목록 조회. (기존 listBatches(zone) → statuses 필터)
   * - statuses 를 생략하면 전체 조회 (홈 화면은 진행중 + 완료를 모두 보여주므로 생략하고 호출)
   * - 서버 코드값(문자열)을 그대로 넘긴다. [확인필요] 코드값 확정 전까지는 생략 권장
   * - 취소 상태 건은 화면 모델에 없어서 결과에서 제외한다
   */
  listBatches(statuses?: string[]): Promise<PretreatmentBatch[]>;
  /**  전처리신고 상세 조회 (GET /pretreatment-reports/{reportId}) */
  getBatch(batchId: number): Promise<PretreatmentBatch>;
  /**  서버에 재고 조회 API 없음 */
  getStock(zone: string): Promise<PretreatmentStock>;
  startBatch(req: StartBatchRequest): Promise<PretreatmentBatch>;
  completeDehull(batchId: number, req: DehullCompleteRequest): Promise<PretreatmentBatch>;
  completeFinal(batchId: number, req: FinalCompleteRequest): Promise<PretreatmentBatch>;
  cancelBatch(batchId: number, reason?: string): Promise<void>;
  /** sourceId 배치를 targetId 배치로 합친다 (같은 상태끼리만). 합쳐진 뒤의 targetId 배치를 돌려준다 */
  mergeBatches(sourceId: number, targetId: number): Promise<PretreatmentBatch>;
}

/* ============================================================================
 * 3) 서버 응답 → 화면 모델 어댑터
 * ========================================================================== */

/** 스캔 때 받아둔 입고건 부가정보. 서버 라인 응답에 barcode/itemNm/unit 이 없어서 여기서 보완한다. */
const receiptMeta = new Map<number, { barcode: string; itemNm: string; unit: string }>();

/** 스캔 응답을 받을 때마다 호출해서 캐시에 쌓는다 */
const rememberReceipt = (code: string, r: PretreatmentScanReceipt) => {
  receiptMeta.set(Number(r.receiptId), { barcode: code, itemNm: r.itemNm, unit: r.unit });
};

/**
 * 서버 status 문자열 → 화면 상태.
 * [확인필요] 실제 코드값을 모른다(Swagger 도 string 으로만 표기). 흔히 쓰는 표기를 몇 개 받아주고,
 *            모르는 값이면 에러로 드러낸다.
 */
const STATUS_MAP: Record<string, PretreatmentStatus> = {
  PROGRESS: 'PROGRESS',
  IN_PROGRESS: 'PROGRESS',
  DEHULLED: 'DEHULLED',
  DEHULL_DONE: 'DEHULLED',
  HULLING_DONE: 'DEHULLED', // 엔드포인트명(hulling-done)에 맞춘 추정값
  DONE: 'DONE',
  COMPLETED: 'DONE',
};

/**
 * 취소 상태 코드(추정). 취소 건은 화면 모델(PretreatmentStatus)에 없으므로 목록에서 걸러낸다.
 * 이렇게 안 하면 취소 건이 하나만 있어도 toStatus 가 throw 해서 목록 전체가 로드 실패한다.
 * [확인필요] 취소 코드값 확정 + 취소 건을 화면에 보여줄지 결정 (보여준다면 PretreatmentStatus 에 'CANCELED' 추가)
 */
const CANCELED_STATUSES = ['CANCELED', 'CANCELLED', 'CANCEL'];
const isCanceled = (s: string) => CANCELED_STATUSES.includes(s?.toUpperCase?.() ?? '');

const toStatus = (s: string): PretreatmentStatus => {
  const mapped = STATUS_MAP[s?.toUpperCase?.() ?? ''];
  if (!mapped) throw new Error(`알 수 없는 전처리신고 상태값입니다: ${s}`);
  return mapped;
};

/** 서버 PretreatmentReportResponse → 화면 PretreatmentBatch */
const toBatch = (r: PretreatmentReportResponse): PretreatmentBatch => {
  const status = toStatus(r.status);
  const lines: PretreatmentLine[] = r.lines.map((l) => {
    const meta = receiptMeta.get(Number(l.receiptId));
    return {
      receiptId: l.receiptId as unknown as ReceiptId,
      barcode: meta?.barcode ?? '',
      itemNm: meta?.itemNm ?? '전처리전씨드',
      inputQty: l.inputQty,
    };
  });
  const firstMeta = receiptMeta.get(Number(r.lines[0]?.receiptId));
  return {
    batchId: r.reportId,
    batchNo: `B-${String(r.reportId).padStart(3, '0')}`,
    status,
    unit: firstMeta?.unit ?? 'kg',
    lines,
    //  서버가 완료 전 값을 0 으로 내려줘도 "값 있음"으로 오인하지 않도록 status 기준으로 null 처리.
    //     (화면은 hullQty !== null 이면 "탈피완료 계량 결과"를, finalQty !== null 이면 "최종완료 계량 결과"를 보여준다)
    hullQty: status === 'PROGRESS' ? null : (r.hullQty ?? null),
    dehulledQty: status === 'PROGRESS' ? null : (r.semiSeedCheckpointQty ?? null),
    finalQty: status === 'DONE' ? (r.finalSemiSeedQty ?? null) : null,
  };
};

/* ============================================================================
 * 4) 실제 API
 * ========================================================================== */
const BASE = '/pretreatment-reports';

const realApi: PretreatmentApiShape = {
  /** 입고 라벨 QR 스캔 조회: GET /pretreatment-reports/scan?code= */
  scanReceipt: async (code) => {
    // QR/키보드 입력 끝에 공백·개행이 섞여 들어오는 경우가 있어 trim
    const trimmed = code.trim();
    const res = await apiClient.get<ApiResponsePretreatmentScanReceipt>(`${BASE}/scan`, {
      params: { code: trimmed },
    });
    const data = res.data.data;
    rememberReceipt(trimmed, data); // 라인/상세 화면에서 라벨 번호를 보여주기 위해 캐시
    return data;
  },

  /**
   * 목록: GET /pretreatment-reports?statuses=A&statuses=B  (statuses 는 선택)
   * - axios 기본 직렬화는 statuses[]=A&statuses[]=B 라서 스프링 @RequestParam List 와 안 맞을 수 있다.
   *   → paramsSerializer.indexes = null 로 statuses=A&statuses=B 형태로 보낸다. (axios 1.x 기준)
   *   (axios 0.x 라면 qs 로 직렬화: qs.stringify(params, { arrayFormat: 'repeat' }) 를 paramsSerializer 로 지정)
   * - zone 은 더 이상 보내지 않는다.
   */
  listBatches: async (statuses) => {
    const res = await apiClient.get<ApiResponseListPretreatmentReportResponse>(BASE, {
      params: statuses && statuses.length > 0 ? { statuses } : undefined,
      paramsSerializer: { indexes: null },
    });
    return res.data.data.filter((r) => !isCanceled(r.status)).map(toBatch);
  },

  /** 상세: GET /pretreatment-reports/{reportId} */
  getBatch: async (batchId) => {
    const res = await apiClient.get<ApiResponsePretreatmentReportResponse>(`${BASE}/${batchId}`);
    return toBatch(res.data.data);
  },

  /** 재고 — [미확정] 백엔드에 API 없음 (호출하면 404 가능 → 화면에서 실패를 무시하도록 처리해 둠) */
  getStock: async (zone) => {
    const res = await apiClient.get<ApiResponse<PretreatmentStock>>(`${BASE}/stock`, { params: { zone } });
    return res.data.data;
  },

  /** 전처리신고 등록(태블릿): POST /pretreatment-reports  (zone 은 서버로 보내지 않음) */
  startBatch: async (req) => {
    const body: PretreatmentReportCreateRequest = {
      lines: req.lines.map((l) => ({ receiptId: Number(l.receiptId), inputQty: l.inputQty })),
    };
    const res = await apiClient.post<ApiResponsePretreatmentReportResponse>(BASE, body);
    return toBatch(res.data.data);
  },

  /**
   * 탈피 완료(태블릿): POST /pretreatment-reports/{reportId}/hulling-done
   * 화면의 H(hullQty) → hullQty, 화면의 D(dehulledQty) → semiSeedCheckpointQty
   */
  completeDehull: async (batchId, req) => {
    const body: PretreatmentReportHullingDoneRequest = {
      hullQty: req.hullQty,
      semiSeedCheckpointQty: req.dehulledQty,
    };
    const res = await apiClient.post<ApiResponsePretreatmentReportResponse>(`${BASE}/${batchId}/hulling-done`, body);
    return toBatch(res.data.data);
  },

  /** 최종 완료 — [미확정] Swagger 에 없음. 경로는 추정. 화면의 M(finalQty) = 서버의 finalSemiSeedQty */
  completeFinal: async (batchId, req) => {
    const res = await apiClient.post<ApiResponsePretreatmentReportResponse>(`${BASE}/${batchId}/final-complete`, {
      finalSemiSeedQty: req.finalQty,
    });
    return toBatch(res.data.data);
  },

  /** 취소 — [미확정] Swagger 에 없음. 경로는 추정. 응답에 cancelReason 필드가 있으므로 reason 을 그대로 전달 */
  cancelBatch: async (batchId, reason) => {
    await apiClient.post(`${BASE}/${batchId}/cancel`, { cancelReason: reason });
  },

  /** 병합 — [미확정] Swagger 에 병합 API 자체가 없음 */
  mergeBatches: async (sourceId, targetId) => {
    const res = await apiClient.post<ApiResponsePretreatmentReportResponse>(`${BASE}/${sourceId}/merge`, {
      targetBatchId: targetId,
    });
    return toBatch(res.data.data);
  },
};

/* ============================================================================
 * 5) 목업 어댑터 — 화면 흐름 확인용. 서버가 해줘야 할 검증(가드)도 최소한 흉내만 낸다.
 * (실제로는 가드/재고반영/잔여수량 예약 차감 전부 "서버가" 해야 한다 — 설계안 2-3)
 * ========================================================================== */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const round1 = (n: number) => Math.round(n * 10) / 10;
const EPS = 0.001;
/** number → ReceiptId (기존 타입이 string 이든 number 든 목업에서 컴파일 에러 안 나게) */
const rid = (n: number) => n as unknown as ReceiptId;

interface MockReceipt {
  receiptId: number;
  barcode: string;
  goodQty: number;
  receivedAt: string;
}

const MOCK_RECEIPTS: MockReceipt[] = [
  { receiptId: 101, barcode: 'HEMP-SEED-1029-01', goodQty: 500, receivedAt: '2026-10-28' },
  { receiptId: 102, barcode: 'HEMP-SEED-1029-02', goodQty: 300, receivedAt: '2026-10-28' },
  { receiptId: 103, barcode: 'HEMP-SEED-1028-05', goodQty: 420, receivedAt: '2026-10-27' },
  { receiptId: 104, barcode: 'HEMP-SEED-1027-03', goodQty: 260, receivedAt: '2026-10-26' },
  // 아래는 목업 시드 배치가 이미 쓰고 있는 입고건
  { receiptId: 105, barcode: 'HEMP-SEED-1026-02', goodQty: 300, receivedAt: '2026-10-25' },
  { receiptId: 106, barcode: 'HEMP-SEED-1025-01', goodQty: 350, receivedAt: '2026-10-24' },
  { receiptId: 107, barcode: 'HEMP-SEED-1025-04', goodQty: 200, receivedAt: '2026-10-24' },
  { receiptId: 108, barcode: 'HEMP-SEED-1020-01', goodQty: 450, receivedAt: '2026-10-20' },
];

const seedLine = (receiptId: number, inputQty: number): PretreatmentLine => ({
  receiptId: rid(receiptId),
  barcode: MOCK_RECEIPTS.find((r) => r.receiptId === receiptId)!.barcode,
  itemNm: '전처리전씨드',
  inputQty,
});

let mockBatches: PretreatmentBatch[] = [
  {
    batchId: 3, batchNo: 'B-003', status: 'PROGRESS', unit: 'kg',
    lines: [seedLine(105, 220)], hullQty: null, dehulledQty: null, finalQty: null,
  },
  {
    batchId: 2, batchNo: 'B-002', status: 'DEHULLED', unit: 'kg',
    lines: [seedLine(106, 300), seedLine(107, 150)], hullQty: 68, dehulledQty: 362, finalQty: null,
  },
  {
    batchId: 1, batchNo: 'B-001', status: 'DONE', unit: 'kg',
    lines: [seedLine(108, 400)], hullQty: 92, dehulledQty: 308, finalQty: 268,
  },
];
let mockSeq = 3;
let mockStock: PretreatmentStock = { beforeQty: 1480, afterQty: 2310, hullQty: 640 };
let mockScanIdx = 0;

const sumN = (b: PretreatmentBatch) => b.lines.reduce((s, l) => s + l.inputQty, 0);

/** 잔여수량 = goodQty - Σ(진행중+탈피완료+완료 헤더의 N)  (설계안 2-3) — 취소된(삭제된) 배치는 자동 제외됨 */
const mockRemaining = (receiptId: number) => {
  const r = MOCK_RECEIPTS.find((x) => x.receiptId === receiptId)!;
  const used = mockBatches
    .flatMap((b) => b.lines)
    .filter((l) => Number(l.receiptId) === receiptId)
    .reduce((s, l) => s + l.inputQty, 0);
  return round1(r.goodQty - used);
};

/** 목업 입고건 → 실제 스캔 응답(PretreatmentScanReceipt)과 같은 모양으로 변환 */
const toMockScan = (r: MockReceipt): PretreatmentScanReceipt => ({
  receiptId: r.receiptId,
  itemCode: 'HEMP-SEED',
  itemNm: '전처리전씨드',
  unit: 'kg',
  receiptQty: r.goodQty,
  defectQty: 0,
  goodQty: r.goodQty,
  receivedAt: `${r.receivedAt}T09:00:00`,
  remainingQty: mockRemaining(r.receiptId),
});

/**
 * 목업 전용: "가상 스캔" 버튼이 호출하는 함수. (입고건을 순서대로 돌려가며 스캔한 것처럼 돌려준다)
 * 화면은 여기서 받은 barcode 를 code 로 삼아 Api.scanReceipt(code) 를 다시 호출한다
 * → 실서버 모드와 동일한 경로(코드 → 조회)를 타게 하려는 의도.
 */
export function mockScanReceipt(): PretreatmentScanReceipt & { barcode: string } {
  const r = MOCK_RECEIPTS[mockScanIdx % MOCK_RECEIPTS.length];
  mockScanIdx += 1;
  const scan = toMockScan(r);
  rememberReceipt(r.barcode, scan);
  return { ...scan, barcode: r.barcode };
}

const mockApi: PretreatmentApiShape = {
  async scanReceipt(code) {
    await sleep(80);
    const trimmed = code.trim();
    const r = MOCK_RECEIPTS.find((x) => x.barcode === trimmed);
    if (!r) throw new Error('입고 라벨을 찾을 수 없습니다.');
    const scan = toMockScan(r);
    rememberReceipt(trimmed, scan);
    return scan;
  },

  /** zone 대신 statuses 필터 (화면 상태값 PROGRESS/DEHULLED/DONE 기준으로 흉내) */
  async listBatches(statuses) {
    await sleep(120);
    const list =
      statuses && statuses.length > 0
        ? mockBatches.filter((b) => statuses.map((s) => s.toUpperCase()).includes(b.status))
        : mockBatches;
    return clone(list);
  },

  /** 상세 조회 */
  async getBatch(batchId) {
    await sleep(60);
    const b = mockBatches.find((x) => x.batchId === batchId);
    if (!b) throw new Error('배치를 찾을 수 없습니다.');
    return clone(b);
  },

  async getStock() {
    await sleep(60);
    return { ...mockStock };
  },

  async startBatch(req) {
    await sleep(150);
    // 서버 요청 스펙: lines ≥ 1건, inputQty ≥ 0 (0 은 스펙상 허용이지만 목업에서는 0 초과만 허용)
    if (req.lines.length === 0) throw new Error('입고건이 없습니다.');
    const lines: PretreatmentLine[] = req.lines.map((l) => {
      const id = Number(l.receiptId);
      if (l.inputQty <= 0) throw new Error('투입량은 0보다 커야 합니다.');
      if (l.inputQty > mockRemaining(id) + EPS) throw new Error('투입량이 잔여수량을 초과했습니다.');
      return seedLine(id, l.inputQty);
    });
    mockSeq += 1;
    const batch: PretreatmentBatch = {
      batchId: mockSeq, batchNo: `B-${String(mockSeq).padStart(3, '0')}`, status: 'PROGRESS', unit: 'kg',
      lines, hullQty: null, dehulledQty: null, finalQty: null,
    };
    mockBatches = [batch, ...mockBatches]; // 재고 변화 없음, 잔여수량만 예약(= mockRemaining 이 자동 반영)
    return clone(batch);
  },

  async completeDehull(batchId, req) {
    await sleep(150);
    const b = mockBatches.find((x) => x.batchId === batchId);
    if (!b) throw new Error('배치를 찾을 수 없습니다.');
    if (b.status !== 'PROGRESS') throw new Error('진행중 배치만 탈피 완료 처리할 수 있습니다.');
    const n = sumN(b);
    // 목업 서버 가드: H + D ≤ ΣN  ([확인필요] 설계안은 "≈" — 허용오차 기준을 백엔드와 확정해야 함)
    if (req.hullQty + req.dehulledQty > n + EPS) throw new Error('껍질 + 탈피후씨드가 투입량을 초과했습니다.');
    b.hullQty = req.hullQty;
    b.dehulledQty = req.dehulledQty;
    b.status = 'DEHULLED';
    mockStock = { ...mockStock, beforeQty: round1(mockStock.beforeQty - n), hullQty: round1(mockStock.hullQty + req.hullQty) };
    return clone(b);
  },

  async completeFinal(batchId, req) {
    await sleep(150);
    const b = mockBatches.find((x) => x.batchId === batchId);
    if (!b) throw new Error('배치를 찾을 수 없습니다.');
    if (b.status !== 'DEHULLED') throw new Error('탈피완료 배치만 최종 완료 처리할 수 있습니다.');
    if (req.finalQty > (b.dehulledQty ?? 0) + EPS) throw new Error('전처리후씨드가 탈피후씨드보다 많을 수 없습니다.');
    b.finalQty = req.finalQty;
    b.status = 'DONE';
    mockStock = { ...mockStock, afterQty: round1(mockStock.afterQty + req.finalQty) };
    return clone(b);
  },

  async cancelBatch(batchId) {
    await sleep(120);
    const b = mockBatches.find((x) => x.batchId === batchId);
    if (!b) throw new Error('배치를 찾을 수 없습니다.');
    if (b.status !== 'PROGRESS') throw new Error('진행중 배치만 취소할 수 있습니다.');
    // 실서버는 삭제가 아니라 status 변경 + cancelReason 저장일 가능성이 높다. 목업은 단순화를 위해 제거.
    mockBatches = mockBatches.filter((x) => x.batchId !== batchId); // 재고 영향 없음, 잔여수량 자동 복구
  },

  async mergeBatches(sourceId, targetId) {
    await sleep(150);
    const src = mockBatches.find((x) => x.batchId === sourceId);
    const tgt = mockBatches.find((x) => x.batchId === targetId);
    if (!src || !tgt || src.batchId === tgt.batchId) throw new Error('병합할 배치를 찾을 수 없습니다.');
    if (src.status !== tgt.status || src.status === 'DONE') throw new Error('같은 상태(진행중/탈피완료)의 배치끼리만 병합할 수 있습니다.');

    // [확인필요]
    //  - 진행중 + 진행중: 라인(N)을 한쪽으로 재배치. 같은 입고건이 양쪽에 있으면 N 을 합산(가정)
    //  - 탈피완료 + 탈피완료: 이미 반영된 재고는 그대로, D 만 합침. 이력용으로 라인/H 도 합산(가정)
    for (const l of src.lines) {
      const same = tgt.lines.find((x) => Number(x.receiptId) === Number(l.receiptId));
      if (same) same.inputQty = round1(same.inputQty + l.inputQty);
      else tgt.lines.push({ ...l });
    }
    if (src.status === 'DEHULLED') {
      tgt.hullQty = round1((tgt.hullQty ?? 0) + (src.hullQty ?? 0));
      tgt.dehulledQty = round1((tgt.dehulledQty ?? 0) + (src.dehulledQty ?? 0));
    }
    mockBatches = mockBatches.filter((x) => x.batchId !== sourceId);
    return clone(tgt);
  },
};

/** 화면에서는 이것만 import 해서 쓴다 */
export const PretreatmentBatchApi: PretreatmentApiShape = PRETREATMENT_USE_MOCK ? mockApi : realApi;

/** 배치의 투입량 합계 ΣN */
export const sumInputQty = (b: Pick<PretreatmentBatch, 'lines'>) =>
  b.lines.reduce((s, l) => s + l.inputQty, 0);

/* ############################################################################
 * 아래부터: 작업지시 단위 전처리 API (WorkPretreatment, 작업지시 목록 → 탈각씨드 라인에서 사용)
 * 위쪽 PretreatmentBatchApi(전처리 신고 화면)와 별개로 동작한다.
 * ########################################################################## */
/* ============================================================================
 * WorkPretreatment — 작업지시 단위 전처리 작업 API
 * (Swagger: /api/work-performances/{workId}/pretreatment/...)
 * apiClient baseURL 에 /api 가 붙어 있다고 보고 /work-performances 부터 적는다.
 * ========================================================================== */

/** 진행상태 (Swagger 설명: WAITING / PROGRESS / DONE) */
export type WorkPretreatmentStatus = 'WAITING' | 'PROGRESS' | 'DONE';

/** 스캔된 입고건 */
export interface WorkPretreatmentReceiptResponse {
  /** 입고건 ID */
  receiptId: number;
  /** 품목코드 */
  itemCode: string;
  /** 스캔 당시 입고건 수량 스냅샷 */
  inputQty: number;
  /** 스캔 일시 */
  scannedAt: string;
}

/** 전처리 대기중/작업중 작업지시 목록 한 건 */
export interface WorkPretreatmentListItemResponse {
  workId: string;
  workDate: string;
  orderCode: string | null;
  bpCode: string | null;
  bpNm: string | null;
  /** RAW 그룹 라인 지시수량 합계(목표) */
  instructQtySum: number;
  /** 입고라벨 누적 스캔 수량 */
  inputQty: number;
  status: WorkPretreatmentStatus | string;
  /** 작업 시작 일시 (시작 전이면 null) */
  startAt: string | null;
}

/** 전처리 작업지시 단건 (스캔된 입고건 목록 포함) */
export interface WorkPretreatmentDetailResponse extends WorkPretreatmentListItemResponse {
  receipts: WorkPretreatmentReceiptResponse[];
}

export interface WorkPretreatmentScanReceiptRequest {
  /** 입고라벨 QR 문자열 (1자 이상) */
  code: string;
}

export interface WorkPretreatmentScanReceiptResponse {
  /** 입고라벨 누적 스캔 수량 */
  inputQty: number;
  /** RAW 그룹 라인 지시수량 합계(목표) */
  instructQtySum: number;
  /** 목표 수량과 정확히 일치해 작업시작이 가능한지 여부 */
  canStart: boolean;
}

/** 전처리 작업완료 (계량 결과) */
export interface WorkPretreatmentCompleteRequest {
  /** 껍질 수량 (≥ 0) */
  hullQty: number;
  /** 탈각씨드 수량 (≥ 0) */
  semiSeedQty: number;
}

const WORK_PT_BASE = '/work-performances';
const enc = encodeURIComponent;

export const WorkPretreatmentApi = {
  /** 전처리 대기중/작업중 작업지시 목록: GET /work-performances/pretreatment?status= */
  getList: async (status: string) => {
    const res = await apiClient.get<ApiResponse<WorkPretreatmentListItemResponse[]>>(`${WORK_PT_BASE}/pretreatment`, {
      params: { status },
    });
    return res.data;
  },

  /** 전처리 작업지시 단건 조회: GET /work-performances/pretreatment/{workId} */
  getDetail: async (workId: string) => {
    const res = await apiClient.get<ApiResponse<WorkPretreatmentDetailResponse>>(
      `${WORK_PT_BASE}/pretreatment/${enc(workId)}`,
    );
    return res.data;
  },

  /** 입고라벨 스캔: POST /work-performances/{workId}/pretreatment/scan-receipt */
  scanReceipt: async (workId: string, code: string) => {
    // QR/키보드 입력 끝에 공백·개행이 섞여 들어오는 경우가 있어 trim
    const body: WorkPretreatmentScanReceiptRequest = { code: code.trim() };
    const res = await apiClient.post<ApiResponse<WorkPretreatmentScanReceiptResponse>>(
      `${WORK_PT_BASE}/${enc(workId)}/pretreatment/scan-receipt`,
      body,
    );
    return res.data;
  },

  /** 전처리 작업시작: POST /work-performances/{workId}/pretreatment/start */
  start: async (workId: string) => {
    const res = await apiClient.post<ApiResponse<string>>(`${WORK_PT_BASE}/${enc(workId)}/pretreatment/start`);
    return res.data;
  },

  /** 전처리 작업완료 (계량 결과 입력): POST /work-performances/{workId}/pretreatment/complete */
  complete: async (workId: string, req: WorkPretreatmentCompleteRequest) => {
    const res = await apiClient.post<ApiResponse<string>>(`${WORK_PT_BASE}/${enc(workId)}/pretreatment/complete`, req);
    return res.data;
  },
};
