import type { ApiResponse, ApiResponsePage, PageResponse } from '@/types/Common';

// ==========================================
// 1. Request DTOs
// ==========================================

/** 불량 등록 요청 (DefectCreateRequest) */
export interface DefectCreateRequest {
  defCode: string;           // 불량 코드 (필수, 최대 30자)
  operCode?: string | null;  // 공정 코드 (선택, 최대 30자)
  defNm?: string | null;     // 불량명 (선택, 최대 100자)
  defType?: string | null;   // 불량 유형 (선택, 최대 30자)
  severity?: string | null;  // 심각도 (선택, 최대 30자)
}

/** 불량 정보 수정 요청 (DefectUpdateRequest) */
export interface DefectUpdateRequest {
  operCode?: string | null;  // 공정 코드 (최대 30자)
  defNm?: string | null;     // 불량명 (최대 100자)
  defType?: string | null;   // 불량 유형 (최대 30자)
  severity?: string | null;  // 심각도 (최대 30자)
}

// ==========================================
// 2. Response DTOs
// ==========================================

/** 불량 목록 조회 아이템 응답 (DefectResponse) */
export interface DefectResponse {
  defCode: string;
  operCode: string;
  defNm: string;
  defType: string;
  severity: string;
  useYn: string;
  createdAt: string; // ISO date-time string
  updatedAt: string; // ISO date-time string
}

/** 불량 상세 조회 응답 (DefectDetailResponse) */
export interface DefectDetailResponse {
  defCode: string;
  operCode: string;
  operNm: string;
  depCode: string;
  taskDesc: string;
  head: string;
  defNm: string;
  defType: string;
  severity: string;
  useYn: string;
  createdAt: string; // ISO date-time string
  updatedAt: string; // ISO date-time string
}

// ==========================================
// 3. Final API Response Types
// ==========================================

/** 불량 단건/기본 응답 API 최종 응답 타입 */
export type ApiResponseDefectResponse = ApiResponse<DefectResponse>;

/** 불량 상세 조회 API 최종 응답 타입 */
export type ApiResponseDefectDetailResponse = ApiResponse<DefectDetailResponse>;

/** 불량 목록 페이징 데이터 타입 */
export type PageDefectResponse = PageResponse<DefectResponse>;

/** 불량 목록 페이징 API 최종 응답 타입 */
export type ApiResponsePageDefectResponse = ApiResponsePage<DefectResponse>;