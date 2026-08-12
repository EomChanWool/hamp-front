import type { ApiResponse, ApiResponsePage, PageResponse } from '@/types/Common';

/** 불량 등록 요청 */
export interface DefectCreateRequest {
  defCode: string;          
  operCode?: string | null;  
  defNm?: string | null;     
  defType?: string | null;   
  severity?: string | null; 
}

/** 불량 정보 수정 요청 */
export interface DefectUpdateRequest {
  operCode?: string | null;  
  defNm?: string | null;     
  defType?: string | null;   
  severity?: string | null;  
}

/** 불량 목록 조회 아이템 응답 */
export interface DefectResponse {
  defCode: string;
  operCode: string;
  defNm: string;
  defType: string;
  severity: string;
  useYn: string;
  createdAt: string;
  updatedAt: string; 
}

/** 불량 상세 조회 응답 */
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
  createdAt: string; 
  updatedAt: string;
}

// ── API 최종 응답 타입 ────────────────────────────────────────────────────────

/** 불량 단건/기본 응답 API 최종 응답 타입 */
export type ApiResponseDefectResponse = ApiResponse<DefectResponse>;

/** 불량 상세 조회 API 최종 응답 타입 */
export type ApiResponseDefectDetailResponse = ApiResponse<DefectDetailResponse>;

/** 불량 목록 페이징 데이터 타입 */
export type PageDefectResponse = PageResponse<DefectResponse>;

/** 불량 목록 페이징 API 최종 응답 타입 */
export type ApiResponsePageDefectResponse = ApiResponsePage<DefectResponse>;