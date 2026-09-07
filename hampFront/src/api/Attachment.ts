/** 파일업로드 공통 응답 구조 */
export interface AttachmentResponse {
  attachmentId: number;
  originalName: string;
  contentType: string;
  fileSize: number;
  createdAt: string;
}
