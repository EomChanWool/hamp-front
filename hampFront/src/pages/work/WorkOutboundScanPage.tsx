import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { MapPinIcon, TruckIcon } from '@heroicons/react/24/outline';
import { isValidWorkZone } from '@/utils/common';
import '@/pages/work/WorkTabletHome.css';
import '@/pages/work/WorkSeedReportScanPage.css';

// TODO: 출고처리 - 아직 백엔드 스캔 API(/scan, /scan/stream)가 없어 실시간 연결 없이
// 대기 화면만 먼저 만들어둔 상태. API가 생기면 WorkOrderScanPage/WorkSeedReportScanPage처럼
// EventSource로 SSE 구독해서 스캔 결과를 받아오도록 채우면 된다.
export function WorkOutboundScanPage() {
  const navigate = useNavigate();

  const [searchParams] = useSearchParams();
  const zone = searchParams.get('zone') ?? '';

  if (!isValidWorkZone(zone)) {
    return <Navigate to="/work" replace />;
  }

  const isFoodZone = zone === '1';
  const zoneLabel = isFoodZone ? '식품동' : '작물동';
  const zoneVariant = isFoodZone ? 'food' : 'crop';

  return (
    <div className="workTabletPage">
      <div className="workScanPanel">
        <div className={`workScanContainer workScanContainer--${zoneVariant}`}>
          <div className="workScanTopBar">
            <button
              type="button"
              className="workScanHomeBtn"
              onClick={() => navigate(`/work/home?zone=${encodeURIComponent(zone)}`)}
            >
              ← 돌아가기
            </button>
          </div>

          <div className="workScanMain">
            <div className="workTabletScanHeader">
              <span className="workTabletZone">
                <MapPinIcon aria-hidden="true" />
                {zoneLabel}
              </span>
            </div>
            <div className="workScanWaiting">
              <div className={`workScanTarget workScanTarget--${zoneVariant}`}>
                <span className="workScanTargetCorner workScanTargetCorner--tl" />
                <span className="workScanTargetCorner workScanTargetCorner--tr" />
                <span className="workScanTargetCorner workScanTargetCorner--bl" />
                <span className="workScanTargetCorner workScanTargetCorner--br" />
                <span className="workScanTargetLine" />
                <div className="workScanTargetLabel">
                  <strong>출고처리</strong>
                  <TruckIcon className="workScanWaitingIconSvg" />
                </div>
              </div>
              <h1>스캔 대기 중</h1>
              <p>출고 라벨을 스캐너로 찍으면 이 화면에 자동으로 표시됩니다.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
