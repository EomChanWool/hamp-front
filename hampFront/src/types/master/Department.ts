import type { ApiResponse, ApiResponsePage, PageResponse } from '@/types/Common';

/** 부서 등록 요청 */
export interface DepartmentCreateRequest {
  depCode: string;
  taskDesc?: string | null;
  head?: string | null;
  headPhone?: string | null;
}

/** 부서 정보 수정 요청 */
export interface DepartmentUpdateRequest {
  taskDesc?: string | null;
  head?: string | null;
  headPhone?: string | null;
}

/** 부서 정보 응답 Data */
export interface DepartmentResponse {
  depCode: string;
  taskDesc: string;
  head: string;
  headPhone: string;
  createdAt: string;
  updatedAt: string;
}

/** 부서 옵션 조회 응답 Data */
export interface DepartmentOptionResponse {
  depCode: string;
  taskDesc: string;
}

// ── API 최종 응답 타입 ────────────────────────────────────────────────────────

/** 부서 단건 조회/등록/수정 API 최종 응답 타입 */
export type ApiResponseDepartmentResponse = ApiResponse<DepartmentResponse>;

/** 부서 목록 페이징 데이터 타입 */
export type PageDepartmentResponse = PageResponse<DepartmentResponse>;

/** 부서 목록 페이징 API 최종 응답 타입 */
export type ApiResponsePageDepartmentResponse = ApiResponsePage<DepartmentResponse>;

/** 부서 옵션 목록 API 최종 응답 타입 */
export type ApiResponseListDepartmentOptionResponse = ApiResponse<DepartmentOptionResponse[]>;