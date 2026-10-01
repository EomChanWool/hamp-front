import { useNavigate } from 'react-router-dom';
import { TruckIcon } from '@heroicons/react/24/outline';
import '@/pages/work/WorkTabletHome.css';
import '@/pages/work/WorkSeedReportScanPage.css';

// TODO: 출고처리 - 아직 백엔드 스캔 API(/scan, /scan/stream)가 없어 실시간 연결 없이
// 대기 화면만 먼저 만들어둔 상태. API가 생기면 WorkOrderScanPage/WorkSeedReportScanPage처럼
// EventSource로 SSE 구독해서 스캔 결과를 받아오도록 채우면 된다.
export function WorkOutboundScanPage() {
  const navigate = useNavigate();

  return (
    <div className="workTabletPage">
      <div className="workScanPanel">
        <div className="workScanContainer">
          <div className="workScanTopBar">
            <button type="button" className="workScanHomeBtn" onClick={() => navigate('/work')}>
              ← 돌아가기
            </button>
          </div>

          <div className="workScanMain">
            <div className="workTabletScanHeader">
              {/* <span className={`workTabletZoneBadge workTabletZoneBadge--${zoneVariant}`}>
                <ZoneIcon aria-hidden="true" />
                {zoneLabel}
              </span> */}
              <h1>
                출고처리
              </h1>
            </div>
            <div className="workScanWaiting">
              <div className="workScanTarget">
                <span className="workScanTargetCorner workScanTargetCorner--tl" />
                <span className="workScanTargetCorner workScanTargetCorner--tr" />
                <span className="workScanTargetCorner workScanTargetCorner--bl" />
                <span className="workScanTargetCorner workScanTargetCorner--br" />
                <span className="workScanTargetLine" />
                <TruckIcon className="workScanWaitingIconSvg" />
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
