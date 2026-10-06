/**
 * 씨드 신고반납 "출력용 데이터" 변환 레이어
 *
 * 업체 양식이 HTML(브라우저 인쇄) / 엑셀 / 워드 중 무엇으로 올지 아직 모름
 * 어떤 형식이 오더라도 "어떤 데이터를 뿌릴지" 는 동일하므로,
 * API 응답 -> 출력용 데이터 변환을 이 파일 한 곳에 모아둔다.
 *
 *   [API 응답]  -->  buildSeedReturnPrintData()  -->  [출력용 데이터]
 *                                                        |-- SeedReturnPrintModal (HTML 인쇄 / PDF 저장)  <- 현재 구현
 *                                                        |-- flattenForTemplate()  (엑셀/워드 템플릿 치환용)   <- 양식 오면 연결
 */
import type { SeedGoodsReceiptReturnItemResponse } from '@/api/seed/SeedGoodsReceiptReturn';

/** 처리상태 코드 -> 출력용 문구 (페이지의 PROCESS_STATUS_MAP 과 동일하게 유지) */
const PROCESS_STATUS_TEXT: Record<number, string> = {
  0: '신고대기',
  1: '신고완료',
};

/** 표의 한 행 */
export interface SeedReturnPrintRow {
  no: number; // 순번 (1부터)
  returnId: number; // 신고ID
  itemCode: string; // 품목코드
  itemNm: string; // 품목명
  returnQty: number; // 수량
  reportDate: string; // 신고일자
  returnDueDate: string; // 처리예정일
  statusText: string; // 처리상태 문구
}

/** 문서 전체 */
export interface SeedReturnPrintData {
  docNo: string; // 문서번호 (예: RTN-12 / RTN-12 외 2건)
  printedAt: string; // 출력일시 (yyyy-MM-dd HH:mm)
  rows: SeedReturnPrintRow[];
  totalQty: number; // 수량 합계
  barcodeValue: string | null; // 단건일 때만 바코드 값, 여러 건이면 null
}

const pad = (n: number) => String(n).padStart(2, '0');

/** 출력일시 포맷 */
export const formatPrintDateTime = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;

/**
 * API 응답 목록 -> 출력용 데이터
 *
 * 주의: "신고완료(processStatus === 1)" 건만 출력 대상이라는 판단은
 *       호출하는 쪽(페이지의 인쇄 버튼)에서 한다. 여기서는 받은 그대로 변환만 한다.
 */
export function buildSeedReturnPrintData(
  items: SeedGoodsReceiptReturnItemResponse[],
  now: Date = new Date()
): SeedReturnPrintData {
  const rows: SeedReturnPrintRow[] = items.map((it, idx) => ({
    no: idx + 1,
    returnId: it.returnId,
    itemCode: it.itemCode ?? '-',
    itemNm: it.itemNm ?? '-',
    returnQty: it.returnQty ?? 0,
    reportDate: it.reportDate || '-',
    returnDueDate: it.returnDueDate || '-',
    statusText: PROCESS_STATUS_TEXT[it.processStatus] ?? String(it.processStatus),
  }));

  const first = items[0];
  const docNo = first
    ? `RTN-${first.returnId}${items.length > 1 ? ` 외 ${items.length - 1}건` : ''}`
    : '-';

  return {
    docNo,
    printedAt: formatPrintDateTime(now),
    rows,
    totalQty: rows.reduce((sum, r) => sum + r.returnQty, 0),
    barcodeValue: items.length === 1 && first ? `RTN-${first.returnId}` : null,
  };
}

/**
 * [엑셀/워드 양식 대비용 - 현재는 화면에서 사용하지 않음]
 *
 * 업체가 엑셀/워드 양식(.xlsx / .docx)을 주면 보통 "양식 파일의 자리표시자({{docNo}} 등)를
 * 실제 값으로 치환" 하는 방식으로 만든다. 그때 필요한 키-값 형태로 펼쳐주는 함수.
 *
 *   예) { docNo: 'RTN-12', printedAt: '...', totalQty: '30', 'rows.0.itemNm': '...', ... }
 *
 * 실제 파일 생성은 서버(Java POI / poi-tl 등)에서 하고,
 * 프론트는 "다운로드 API 호출 -> blob 저장" 만 담당하는 구성을 권장.
 */
export function flattenForTemplate(data: SeedReturnPrintData): Record<string, string> {
  const flat: Record<string, string> = {
    docNo: data.docNo,
    printedAt: data.printedAt,
    totalQty: String(data.totalQty),
  };

  data.rows.forEach((row, i) => {
    Object.entries(row).forEach(([key, value]) => {
      flat[`rows.${i}.${key}`] = String(value);
    });
  });

  return flat;
}
