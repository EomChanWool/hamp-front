import { apiClient } from '@/api/apiClient';
import type { ApiResponse, ApiResponsePage, PageResponse } from '@/api/Common';
import type { FiberWorkOrderStatus } from '@/api/FiberWorkOrder';

/** 원물 LOT별 투입 요청 */
export interface FiberWorkPerformanceInputRequest {
  receiptId: number;
  inputQty: number;
}

/** 원물 LOT별 투입 응답 */
export interface FiberWorkPerformanceInputResponse {
  receiptId: number;
  receiptLotCode: string;
  rawItemCode: string;
  rawItemNm: string | null;
  inputQty: number;
}

/** 섬유 작업실적 등록 요청 */
export interface FiberWorkPerformanceCreateRequest {
  workId: string;
  productItemCode: string;
  /** 작업일 (yyyy-MM-dd, 생략 시 오늘) */
  workDate?: string | null;
  inputs: FiberWorkPerformanceInputRequest[];
  outputQty: number;
  residueQty?: number | null;
  note?: string | null;
}

/** 섬유 작업실적 수정 요청 */
export interface FiberWorkPerformanceUpdateRequest {
  productItemCode: string;
  /** 작업일 (yyyy-MM-dd) */
  workDate: string;
  inputs: FiberWorkPerformanceInputRequest[];
  outputQty: number;
  residueQty?: number | null;
  note?: string | null;
}

/** 섬유 작업실적 응답 */
export interface FiberWorkPerformanceResponse {
  perfId: number;
  workId: string;
  workStatus: FiberWorkOrderStatus | string;
  orderCode: string;
  bpNm: string | null;
  productItemCode: string;
  productItemNm: string | null;
  workDate: string;
  inputQty: number;
  outputQty: number;
  residueQty: number | null;
  outputRate: number | null;
  productLotCode: string;
  inputs: FiberWorkPerformanceInputResponse[];
  registeredBy: string | null;
  registeredByNm: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 섬유 작업실적 목록 조회 파라미터 */
export interface FiberWorkPerformanceListParams {
  workId?: string;
  orderCode?: string;
  productItemCode?: string;
  productLotCode?: string;
  workDateFrom?: string;
  workDateTo?: string;
  page?: number;
  size?: number;
  sort?: string | string[];
}

export type PageFiberWorkPerformanceResponse = PageResponse<FiberWorkPerformanceResponse>;
export type ApiResponsePageFiberWorkPerformanceResponse = ApiResponsePage<FiberWorkPerformanceResponse>;
export type ApiResponseFiberWorkPerformanceResponse = ApiResponse<FiberWorkPerformanceResponse>;

export const FiberWorkPerformanceApi = {
  /** 섬유 작업실적 목록 조회 */
  getList: async (params?: FiberWorkPerformanceListParams): Promise<ApiResponsePageFiberWorkPerformanceResponse> => {
    const res = await apiClient.get<ApiResponsePageFiberWorkPerformanceResponse>('/fiber-work-performances', {
      params,
    });
    return res.data;
  },

  /** 섬유 작업실적 단건 조회 */
  getDetail: async (perfId: number): Promise<ApiResponseFiberWorkPerformanceResponse> => {
    const res = await apiClient.get<ApiResponseFiberWorkPerformanceResponse>(`/fiber-work-performances/${perfId}`);
    return res.data;
  },

  /** 섬유 작업실적 등록 (실적 한 줄 추가) */
  create: async (data: FiberWorkPerformanceCreateRequest): Promise<ApiResponseFiberWorkPerformanceResponse> => {
    const res = await apiClient.post<ApiResponseFiberWorkPerformanceResponse>('/fiber-work-performances', data);
    return res.data;
  },

  /** 섬유 작업실적 수정 (재고 재반영) */
  update: async (
    perfId: number,
    data: FiberWorkPerformanceUpdateRequest,
  ): Promise<ApiResponseFiberWorkPerformanceResponse> => {
    const res = await apiClient.put<ApiResponseFiberWorkPerformanceResponse>(
      `/fiber-work-performances/${perfId}`,
      data,
    );
    return res.data;
  },

  /** 섬유 작업실적 삭제 (재고 되돌림) */
  delete: async (perfId: number): Promise<ApiResponse<void>> => {
    const res = await apiClient.delete<ApiResponse<void>>(`/fiber-work-performances/${perfId}`);
    return res.data;
  },
};
