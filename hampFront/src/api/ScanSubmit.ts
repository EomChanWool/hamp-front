import { WorkOrderApi, type ZoneType } from '@/api/WorkOrder';
import { SeedGoodsReceiptApi } from '@/api/ioSeed/SeedGoodsReceipt';

/**
 * 앱 카메라로 읽은 바코드 값을 서버로 보내는 함수.
 *
 * 기존 핸드 스캐너와 "똑같은 스캔 API"를 호출한다.
 *   - 작업지시: GET /work-orders/scan?code=...&zone=...
 *   - 신고처리: GET /seed-goods-receipts/scan?code=...&zone=...  (code, zone 모두 필수)
 *
 * 화면 갱신은 서버가 해당 zone 구독자에게 흘려주는 SSE 'scan' 이벤트가 담당하므로
 * 여기서는 호출만 한다. zone 이 빠지거나 SSE 구독 zone 과 다르면 화면이 갱신되지 않는다.
 */
export type ScanKind = 'seed-report' | 'work-order';

export async function submitScannedBarcode(kind: ScanKind, zone: string, barcode: string) {
  const zoneNo = Number(zone);

  if (kind === 'work-order') {
    await WorkOrderApi.scan(barcode, zoneNo as ZoneType);
    return;
  }

  await SeedGoodsReceiptApi.scan(barcode, zoneNo);
}