/** 공통 API 응답 래퍼 인터페이스 */
export interface ApiResponse<T = unknown> {
  status: string;
  code: string;
  message: string;
  data: T;
}

/** 데이터가 없는 공통 API 응답 타입 */
export type ApiResponseVoid = ApiResponse<void>;

/** 정렬 정보 객체 */
export interface SortObject {
  empty: boolean;
  sorted: boolean;
  unsorted: boolean;
}

/** 페이지 요청 정보 객체 */
export interface PageableObject {
  offset: number;
  sort: SortObject;
  paged: boolean;
  pageNumber: number;
  pageSize: number;
  unpaged: boolean;
}

/** Spring Page<T> 공통 응답 구조 */
export interface PageResponse<T> {
  totalElements: number;
  totalPages: number;
  size: number;
  content: T[];
  number: number;
  sort: SortObject;
  first: boolean;
  last: boolean;
  numberOfElements: number;
  pageable: PageableObject;
  empty: boolean;
}

/** 공통 페이지네이션 API 최종 응답 타입 */
export type ApiResponsePage<T> = ApiResponse<PageResponse<T>>;