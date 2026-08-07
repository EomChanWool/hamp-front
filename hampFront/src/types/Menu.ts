import type { ApiResponse } from '@/types/Common';

/** 메뉴 권한 요청 타입 */
export interface MenuPermissionRequest {
  menuId: number;
  create: boolean;
  read: boolean;
  update: boolean;
  delete: boolean;
  approve: boolean;
}

/** 메뉴 권한 응답 타입 */
export interface MenuPermissionResponse {
  menuId: number;
  menuNm: string;
  create: boolean;
  read: boolean;
  update: boolean;
  delete: boolean;
  approve: boolean;
}

/** 메뉴 응답 데이터 타입 */
export interface MenuResponse {
  menuId: number;
  parentId?: number | null;
  menuNm: string;
  depth: number;
  urlPath?: string | null;
  sortOrder: number;
  children?: MenuResponse[];
}

// ── API 최종 응답 타입 ────────────────────────────────────────────────────────

/** 메뉴 목록 조회 API 최종 응답 타입 */
export type ApiResponseListMenuResponse = ApiResponse<MenuResponse[]>;