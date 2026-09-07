import { apiClient } from '@/api/apiClient';
import type { ApiResponse } from '@/api/Common';


/** 파일업로드 공통 응답 구조 */
export interface AttachmentResponse {
  attachmentId: number;
  category?: string | null;
  originalName: string;
  contentType: string;
  fileSize: number;
  createdAt: string;
}

// ── API 최종 응답 타입 ────────────────────────────────────────────────────────

/** 파일업로드 API 최종 응답 타입 */
export type ApiResponseAttachmentResponse = ApiResponse<AttachmentResponse>;

// ── 공용 첨부파일 API ────────────────────────────────────────────────────────

export const AttachmentApi = {
  /**
   * 첨부파일 다운로드
   * @param attachmentId 다운로드할 파일 ID
   * @returns Blob 형태의 파일 데이터
   */
  download: async (attachmentId: number): Promise<Blob> => {
    const response = await apiClient.get(`/attachments/${attachmentId}/download`, {
      responseType: 'blob',
    });
    return response.data;
  },
};