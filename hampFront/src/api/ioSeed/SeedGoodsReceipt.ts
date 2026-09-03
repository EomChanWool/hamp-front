import { apiClient } from '@/api/apiClient';
import type { ApiResponse, ApiResponsePage, PageResponse } from '@/api/Common';

/** 씨드 등록 요청 */
export interface SeedGoodsReceiptCreateRequest {
  itemCode: string;          
  receiptQty: number;  
  defectQty: number;     
  goodQty: number;   
  receivedAt: string; 
}

/** 씨드 정보 수정 요청 */
export interface SeedGoodsReceiptUpdateRequest {
  itemCode: string;          
  receiptQty: number;  
  defectQty: number;     
  goodQty: number;   
  receivedAt: string; 
}

/** 씨드 목록 조회 아이템 응답 */
export interface SeedGoodsReceiptResponse {
  receiptId: number;
  itemCode: string;
  itemNm: string;
  receiptQty: number;  
  defectQty: number;     
  goodQty: number;   
  returnedQty: number;
  remainingQty: number; // 신고 가능 잔여수량 (양품수량 - 누적 신고수량)
  reportStatus: string; // 신고 진행상태 (미신고 / 부분신고 / 신고완료)
  receivedAt: string; 
  createdAt: string;
  updatedAt: string; 
}

// ── 씨드 입고 신고처리 관련 타입 ──────────────────────────────────────────────────

/** 씨드 입고 신고처리 등록 요청 */
export interface SeedGoodsReceiptReturnCreateRequest {
  returnQty: number;
  reportDate: string;
  returnDueDate: string;
  processStatus: string;
}

/** 씨드 입고 신고처리 수정 요청 */
export interface SeedGoodsReceiptReturnUpdateRequest {
  returnQty: number;
  reportDate: string;
  returnDueDate: string;
  processStatus: string;
}

/** 씨드 입고 신고처리 응답 아이템 */
export interface SeedGoodsReceiptReturnResponse {
  returnId: number;
  receiptId: number;
  returnQty: number;
  reportDate: string;
  returnDueDate: string;
  processStatus: string;
  createdAt: string;
  updatedAt: string;
}

// ── API 최종 응답 타입 ────────────────────────────────────────────────────────

/** 씨드 단건/기본 응답 API 최종 응답 타입 */
export type ApiResponseSeedGoodsReceiptResponse = ApiResponse<SeedGoodsReceiptResponse>;

/** 씨드 목록 페이징 데이터 타입 */
export type PageSeedGoodsReceiptResponse = PageResponse<SeedGoodsReceiptResponse>;

/** 씨드 목록 페이징 API 최종 응답 타입 */
export type ApiResponsePageSeedGoodsReceiptResponse = ApiResponsePage<SeedGoodsReceiptResponse>;

/** 씨드 입고 신고처리 단건 응답 API 최종 응답 타입 */
export type ApiResponseSeedGoodsReceiptReturnResponse = ApiResponse<SeedGoodsReceiptReturnResponse>;

/** 씨드 입고 신고처리 목록/이력 응답 API 최종 응답 타입 */
export type ApiResponseListSeedGoodsReceiptReturnResponse = ApiResponse<SeedGoodsReceiptReturnResponse[]>;

// ── 씨드 관리 API 함수 ────────────────────────────────────────────────────────

export const SeedGoodsReceiptApi = {
  /** 씨드 입고 목록 조회 */
  getList: async (params?: {
    itemCode?: string;
    [key: string]: any;
  }): Promise<ApiResponsePageSeedGoodsReceiptResponse> => {
    const res = await apiClient.get<ApiResponsePageSeedGoodsReceiptResponse>('/seed-goods-receipts', { params });
    return res.data;
  },
  
  /** 씨드 입고 단건 조회 */
  getDetail: async (receiptId: number): Promise<ApiResponseSeedGoodsReceiptResponse> => {
    const res = await apiClient.get<ApiResponseSeedGoodsReceiptResponse>(`/seed-goods-receipts/${receiptId}`);
    return res.data;
  },

  /** 씨드 입고 등록 */
  create: async (data: SeedGoodsReceiptCreateRequest): Promise<ApiResponseSeedGoodsReceiptResponse> => {
    const res = await apiClient.post('/seed-goods-receipts', data);
    return res.data;
  },

  /** 씨드 입고 수정 */
  update: async (receiptId: number, data: SeedGoodsReceiptUpdateRequest): Promise<ApiResponseSeedGoodsReceiptResponse> => {
    const res = await apiClient.put(`/seed-goods-receipts/${receiptId}`, data);
    return res.data;
  },

  /** 씨드 입고 삭제 */
  delete: async (receiptId: number): Promise<ApiResponse<string>> => {
    const res = await apiClient.delete(`/seed-goods-receipts/${receiptId}`);
    return res.data;
  }
};

// ── 씨드 입고 신고처리 API 함수 ──────────────────────────────────────────────

export const SeedGoodsReceiptReturnApi = {
  /** 씨드 입고 신고처리 이력 조회 */
  getList: async (receiptId: number): Promise<ApiResponseListSeedGoodsReceiptReturnResponse> => {
    const res = await apiClient.get<ApiResponseListSeedGoodsReceiptReturnResponse>(`/seed-goods-receipts/${receiptId}/returns`);
    return res.data;
  },

  /** 씨드 입고 신고처리 등록 */
  create: async (receiptId: number, data: SeedGoodsReceiptReturnCreateRequest): Promise<ApiResponseSeedGoodsReceiptReturnResponse> => {
    const res = await apiClient.post(`/seed-goods-receipts/${receiptId}/returns`, data);
    return res.data;
  },

  /** 씨드 입고 신고처리 수정 */
  update: async (receiptId: number, returnId: number, data: SeedGoodsReceiptReturnUpdateRequest): Promise<ApiResponseSeedGoodsReceiptReturnResponse> => {
    const res = await apiClient.put(`/seed-goods-receipts/${receiptId}/returns/${returnId}`, data);
    return res.data;
  },

  /** 씨드 입고 신고처리 삭제 */
  delete: async (receiptId: number, returnId: number): Promise<ApiResponse<string>> => {
    const res = await apiClient.delete(`/seed-goods-receipts/${receiptId}/returns/${returnId}`);
    return res.data;
  }
};
