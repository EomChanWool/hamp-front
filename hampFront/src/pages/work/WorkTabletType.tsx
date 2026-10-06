import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { FoodIcon, PlantIcon } from '@/components/icons/CustomIcons';
import '@/pages/work/WorkTabletHome.css';

export function WorkTabletType() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    if (!window.confirm('로그아웃하시겠습니까?')) return;
    await logout();
  };

  return (
    <div className="workTabletPage">
      <div className="workTabletPanel">
        <div className="workTabletContainer">

          {/* 모든 태블릿 화면은 WorkTabletGuard를 거쳐 로그인 후에만 들어오므로 항상 사용자 정보를 보여준다 */}
          <div className="workTabletTopBar">
            {/* TODO: 헴프 로고 자리 - 지금은 자리만 잡아둔 임시 표시 */}
            <div className="workTabletLogoPlaceholder">로고</div>
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

          <div className="workTabletMain">
            <div className="workTabletHeader">
              <h1>HEMP 현장 생산동</h1>
              <p>원하시는 생산동을 선택해 주세요.</p>
            </div>

            <div className="workTabletMenuSection">
              <div className="workTabletTypeButtons">
                {/* 식품동 버튼 -> 태블릿 식품동 업무 화면 연결 */}
                <button
                  type="button"
                  className="workTabletBtn workTabletBtn--food"
                  onClick={() => navigate('/work/home?zone=1')}
                >
                  <FoodIcon aria-hidden="true" />
                  <span className="workTabletBtnText">
                    <span className="workTabletBtnTitle">식품동</span>
                    <span className="workTabletBtnDesc">
                      식품동 업무 화면으로 넘어가
                      <br />
                      작업지시/신고처리/출고처리를 진행합니다.
                    </span>
                  </span>
                </button>

                {/* 섬유동 버튼 -> 태블릿 섬유동 업무 화면 연결 */}
                <button
                  type="button"
                  className="workTabletBtn workTabletBtn--crop"
                  onClick={() => navigate('/work/home?zone=2')}
                >
                  <PlantIcon aria-hidden="true" />
                  <span className="workTabletBtnText">
                    <span className="workTabletBtnTitle">섬유동</span>
                    <span className="workTabletBtnDesc">
                      섬유동 업무 화면으로 넘어가
                      <br />
                      작업지시/출고처리를 진행합니다.
                    </span>
                  </span>
                </button>
              </div>
            </div>
          </div>

          <button type="button" className="workTabletLogoutLink" onClick={handleLogout}>
            로그아웃
          </button>

        </div>
      </div>
    </div>
  );
}
