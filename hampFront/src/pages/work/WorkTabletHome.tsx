import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ClipboardDocumentListIcon, ArchiveBoxIcon, TruckIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/context/AuthContext';
import { FoodIcon, PlantIcon } from '@/components/icons/CustomIcons';
import { isValidWorkZone } from '@/utils/common';
import '@/pages/work/WorkTabletHome.css';

export function WorkTabletHome() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const { user, logout, isAuthenticated } = useAuth();
  const zone = searchParams.get('zone');

  const handleLogout = async () => {
    if (!window.confirm('로그아웃하시겠습니까?')) return;
    await logout();
  };

  if (!isValidWorkZone(zone)) {
    return <Navigate to="/work" replace />;
  }

  const isFoodZone = zone === '1';
  const zoneLabel = isFoodZone ? '식품동' : '섬유동';
  const zoneVariant = isFoodZone ? 'food' : 'crop';
  const ZoneIcon = isFoodZone ? FoodIcon : PlantIcon;

  return (
    <div className="workTabletPage">
      <div className="workTabletPanel">
        <div className={`workTabletContainer workTabletContainer--${zoneVariant}`}>

          {/* 신고처리는 로그인 없이도 쓸 수 있어 이 홈 화면 자체는 비로그인 상태로도 들어올 수 있음 -
              그럴 땐 사용자 정보/로그아웃 대신 로그인 버튼을 보여준다 (작업지시를 쓰려면 로그인이 필요) */}
          <div className="workTabletTopBar">
            {/* TODO: 헴프 로고 자리 - 지금은 자리만 잡아둔 임시 표시 */}
            <button type="button" className="workScanHomeBtn" onClick={() => navigate('/work')}>
              ← 홈으로
            </button>
            <div className="workTabletLogoPlaceholder">로고</div>
            {isAuthenticated ? (
              <div className="workTabletUserInfo">
                <span className="workTabletUserAvatar" aria-hidden="true">
                  {(user?.userNm ?? '?').charAt(0)}
                </span>
                <div className="workTabletUserText">
                  <span className="workTabletUserName">{user?.userNm ?? '사용자'}</span>
                  {user?.position && <span className="workTabletUserPosition">{user.position}</span>}
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="workTabletLogoutBtn"
                onClick={() => navigate('/work/login')}
              >
                <span aria-hidden="true">🔑</span>
                <span>로그인</span>
              </button>
            )}
          </div>

          <div className="workTabletMain">
            <div className="workTabletHeader">
              <span className={`workTabletZoneBadge workTabletZoneBadge--${zoneVariant}`}>
                <ZoneIcon aria-hidden="true" />
                {zoneLabel}
              </span>
              <h1>
                HEMP 현장 스캔 메뉴
              </h1>
              <p>원하시는 업무를 선택해 주세요.</p>
            </div>

            <div className="workTabletMenuSection">
              <div className={
                zone === '1'
                  ? 'workTabletMenuButtons'
                  : 'workTabletTypeButtons'
              }>
                {/* 작업지시 버튼 -> 태블릿 작업지시 스캔 화면 연결 */}
                <button
                  type="button"
                  className={`workTabletBtn workTabletBtn--${zoneVariant}`}
                  onClick={() => navigate(`/work/work-order-scan?zone=${zone}`)}
                >
                  <ClipboardDocumentListIcon className="workTabletBtnIcon" aria-hidden="true" />
                  <span className="workTabletBtnText">
                    <span className="workTabletBtnTitle">작업지시</span>
                    <span className="workTabletBtnDesc">
                      작업지시 라벨을 스캔해
                      <br />
                      공정 진행과 투입 실적을 기록합니다
                    </span>
                  </span>
                </button>

                {/* 신고처리 버튼 -> 태블릿 신고처리 스캔 화면 연결 */}
                {zone === '1' && (
                  <button
                    type="button"
                    className={`workTabletBtn workTabletBtn--${zoneVariant}`}
                    onClick={() => navigate(`/work/seed-report-scan?zone=${zone}`)}
                  >
                    <ArchiveBoxIcon className="workTabletBtnIcon" aria-hidden="true" />
                    <span className="workTabletBtnText">
                      <span className="workTabletBtnTitle">신고처리</span>
                      <span className="workTabletBtnDesc">
                        입고 라벨을 스캔해
                        <br />
                        신고수량을 등록합니다
                      </span>
                    </span>
                  </button>
                )}

                {/* 출고처리 버튼 -> 태블릿 출고 스캔 화면 연결 (로그인 필요, 작업지시와 동일) */}
                <button
                  type="button"
                  className={`workTabletBtn workTabletBtn--${zoneVariant}`}
                  onClick={() => navigate(`/work/outbound-scan?zone=${zone}`)}
                >
                  <TruckIcon className="workTabletBtnIcon" aria-hidden="true" />
                  <span className="workTabletBtnText">
                    <span className="workTabletBtnTitle">출고처리</span>
                    <span className="workTabletBtnDesc">
                      출고 라벨을 스캔해
                      <br />
                      출고 처리를 진행합니다
                    </span>
                  </span>
                </button>
              </div>
            </div>
          </div>

          {isAuthenticated && (
            <button type="button" className="workTabletLogoutLink" onClick={handleLogout}>
              로그아웃
            </button>
          )}

        </div>
      </div>
    </div>
  );
}