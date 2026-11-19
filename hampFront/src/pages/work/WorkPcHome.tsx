import { useNavigate, useSearchParams } from 'react-router-dom';
import { TruckIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/context/AuthContext';
import { FoodIcon, PlantIcon } from '@/components/icons/CustomIcons';
import { isValidWorkZone } from '@/utils/common';
import '@/pages/work/WorkTabletHome.css';

// 태블릿과 분리된 PC 전용 출고처리 메뉴
export function WorkPcHome() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, logout } = useAuth();
  const zone = searchParams.get('zone');

  const handleLogout = async () => {
    if (!window.confirm('로그아웃하시겠습니까?')) return;
    await logout();
  };

  const hasZone = isValidWorkZone(zone);
  const isFoodZone = zone === '1';
  const zoneLabel = isFoodZone ? '식품동' : '섬유동';
  const zoneVariant = isFoodZone ? 'food' : 'crop';
  const ZoneIcon = isFoodZone ? FoodIcon : PlantIcon;

  return (
    <div className="workTabletPage">
      <div className="workTabletPanel">
        <div className={`workTabletContainer ${hasZone ? `workTabletContainer--${zoneVariant}` : ''}`}>

          <div className="workTabletTopBar">
            {hasZone ? (
              <button type="button" className="workScanHomeBtn" onClick={() => navigate('/work-pc')}>
                ← 생산동 변경
              </button>
            ) : (
              // TODO: 헴프 로고 자리 - 지금은 자리만 잡아둔 임시 표시
              <div className="workTabletLogoPlaceholder">로고</div>
            )}
            <div className="workTabletUserInfo">
              <span className="workTabletUserAvatar" aria-hidden="true">
                {(user?.userNm ?? '?').charAt(0)}
              </span>
              <div className="workTabletUserText">
                <span className="workTabletUserName">{user?.userNm ?? '사용자'}</span>
                {user?.position && <span className="workTabletUserPosition">{user.position}</span>}
              </div>
            </div>
          </div>

          {hasZone ? (
            <div className="workTabletMain">
              <div className="workTabletHeader">
                <span className={`workTabletZoneBadge workTabletZoneBadge--${zoneVariant}`}>
                  <ZoneIcon aria-hidden="true" />
                  {zoneLabel}
                </span>
                <h1>HEMP 출고 스캔 메뉴</h1>
                <p>원하시는 업무를 선택해 주세요.</p>
              </div>

              <div className="workTabletMenuSection">
                <div className="workTabletButtons">
                  <button
                    type="button"
                    className={`workTabletBtn workTabletBtn--${zoneVariant}`}
                    onClick={() => navigate(`/work-pc/outbound-scan?zone=${encodeURIComponent(zone)}`)}
                  >
                    <TruckIcon className="workTabletBtnIcon" aria-hidden="true" />
                    <span className="workTabletBtnText">
                      <span className="workTabletBtnTitle">출고처리</span>
                      <span className="workTabletBtnDesc">
                        출고지시서와 LOT 라벨을 스캔해
                        <br />
                        출고를 등록합니다
                      </span>
                    </span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="workTabletMain">
              <div className="workTabletHeader">
                <h1>HEMP 출고 생산동</h1>
                <p>원하시는 생산동을 선택해 주세요.</p>
              </div>

              <div className="workTabletMenuSection">
                <div className="workTabletTypeButtons">
                  <button
                    type="button"
                    className="workTabletBtn workTabletBtn--food"
                    onClick={() => navigate('/work-pc?zone=1')}
                  >
                    <FoodIcon aria-hidden="true" />
                    <span className="workTabletBtnText">
                      <span className="workTabletBtnTitle">식품동</span>
                      <span className="workTabletBtnDesc">식품동 출고처리를 진행합니다.</span>
                    </span>
                  </button>

                  <button
                    type="button"
                    className="workTabletBtn workTabletBtn--crop"
                    onClick={() => navigate('/work-pc?zone=2')}
                  >
                    <PlantIcon aria-hidden="true" />
                    <span className="workTabletBtnText">
                      <span className="workTabletBtnTitle">섬유동</span>
                      <span className="workTabletBtnDesc">섬유동 출고처리를 진행합니다.</span>
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}

          <button type="button" className="workTabletLogoutLink" onClick={handleLogout}>
            로그아웃
          </button>

        </div>
      </div>
    </div>
  );
}
