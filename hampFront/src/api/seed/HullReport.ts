import { apiClient } from '@/api/apiClient';
import type { ApiResponse } from '@/api/Common';

/** 껍질 신고 상태 */
export type HullReportStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

/** 껍질 신고 포함 배치 라인 응답 */
export interface HullReportLineResponse {
  workId: string;
  bpCode: string;
  bpNm: string;
  hullQty: number;
}

/** 껍질 신고 응답 */
export interface HullReportResponse {
  reportId: number;
  reportDate: string;
  status: HullReportStatus;
  totalQty: number;
  note: string | null;
  decisionNote: string | null;
  lines: HullReportLineResponse[];
}

export type ApiResponseListHullReportResponse = ApiResponse<HullReportResponse[]>;

const BASE = '/hull-reports';

export const HullReportApi = {
  /** 껍질 신고 목록 조회 */
  getList: async (params?: {
    status?: HullReportStatus;
  }): Promise<ApiResponseListHullReportResponse> => {
    const res = await apiClient.get<ApiResponseListHullReportResponse>(BASE, { params });
    return res.data;
  },
};
