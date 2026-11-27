import { apiClient } from '@/api/apiClient';
import type { ApiResponse } from '@/api/Common';

/* ============================================================================
 * WorkPretreatment — 작업지시 단위 전처리 작업 API
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

const BASE = '/work-performances';
const enc = encodeURIComponent;

export const WorkPretreatmentApi = {
  /** 전처리 대기중/작업중 작업지시 목록: GET /work-performances/pretreatment?status= */
  getList: async (status: string) => {
    const res = await apiClient.get<ApiResponse<WorkPretreatmentListItemResponse[]>>(`${BASE}/pretreatment`, {
      params: { status },
    });
    return res.data;
  },

  /** 전처리 작업지시 단건 조회: GET /work-performances/pretreatment/{workId} */
  getDetail: async (workId: string) => {
    const res = await apiClient.get<ApiResponse<WorkPretreatmentDetailResponse>>(
      `${BASE}/pretreatment/${enc(workId)}`,
    );
    return res.data;
  },

  /** 입고라벨 스캔: POST /work-performances/{workId}/pretreatment/scan-receipt */
  scanReceipt: async (workId: string, code: string) => {
    // QR/키보드 입력 끝에 공백·개행이 섞여 들어오는 경우가 있어 trim
    const body: WorkPretreatmentScanReceiptRequest = { code: code.trim() };
    const res = await apiClient.post<ApiResponse<WorkPretreatmentScanReceiptResponse>>(
      `${BASE}/${enc(workId)}/pretreatment/scan-receipt`,
      body,
    );
    return res.data;
  },

  /** 전처리 작업시작: POST /work-performances/{workId}/pretreatment/start */
  start: async (workId: string) => {
    const res = await apiClient.post<ApiResponse<string>>(`${BASE}/${enc(workId)}/pretreatment/start`);
    return res.data;
  },

  /** 전처리 작업완료 (계량 결과 입력): POST /work-performances/{workId}/pretreatment/complete */
  complete: async (workId: string, req: WorkPretreatmentCompleteRequest) => {
    const res = await apiClient.post<ApiResponse<string>>(`${BASE}/${enc(workId)}/pretreatment/complete`, req);
    return res.data;
  },
};
