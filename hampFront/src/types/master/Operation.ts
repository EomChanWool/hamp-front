import type { ApiResponse, ApiResponsePage, PageResponse } from '@/types/Common';

/** 공정 등록 요청 */
export interface OperationCreateRequest {
  operCode: string;
  depCode: string;
  operNm?: string | null;
  stdTime?: string | null;
}

/** 공정 정보 수정 요청 */
export interface OperationUpdateRequest {
  depCode?: string | null;
  operNm?: string | null;
  stdTime?: string | null;
}

/** 공정 정보 응답 Data */
export interface OperationResponse {
  operCode: string;
  depCode: string;
  operNm: string;
  useYn: string;
  stdTime: string;
  createdAt: string;
  updatedAt: string;
}

/** 공정 옵션 조회 응답 Data */
export interface OperationOptionResponse {
  operCode: string;
  operNm: string;
}

// ── API 최종 응답 타입 ────────────────────────────────────────────────────────

/** 공정 단건 조회/등록/수정 API 최종 응답 타입 */
export type ApiResponseOperationResponse = ApiResponse<OperationResponse>;

/** 공정 목록 페이징 데이터 타입 */
export type PageOperationResponse = PageResponse<OperationResponse>;

/** 공정 목록 페이징 API 최종 응답 타입 */
export type ApiResponsePageOperationResponse = ApiResponsePage<OperationResponse>;

/** 공정 옵션 목록 API 최종 응답 타입 */
export type ApiResponseListOperationOptionResponse = ApiResponse<OperationOptionResponse[]>;