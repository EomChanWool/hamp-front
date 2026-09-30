import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { FoodIcon, PlantIcon } from "@/components/icons/CustomIcons";
import '@/pages/work/WorkTabletHome.css';

export function WorkTabletType() {
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useAuth();

  const handleLogout = async () => {
    if (!window.confirm('로그아웃하시겠습니까?')) return;
    await logout();
  };

  return (
    <div className="workTabletPage">
      <div className="workTabletPanel">
        <div className="workTabletContainer">

          {/* 신고처리는 로그인 없이도 쓸 수 있어 이 홈 화면 자체는 비로그인 상태로도 들어올 수 있음 -
              그럴 땐 사용자 정보/로그아웃 대신 로그인 버튼을 보여준다 (작업지시를 쓰려면 로그인이 필요) */}
          <div className="workTabletTopBar">
            {/* TODO: 헴프 로고 자리 - 지금은 자리만 잡아둔 임시 표시 */}
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
            <h1>HEMP 현장 생산동</h1>
            <p>원하시는 생산동을 선택해 주세요.</p>
          </div>

          <div className="workTabletMenuSection">
            <div className="workTabletTypeButtons">
              {/* 식품동 버튼 -> 태블릿 식품동 업무 화면 연결 */}
              <button
                type="button"
                className="workTabletBtn"
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

              {/* 작물동 버튼 -> 태블릿 작물동 업무 화면 연결 */}
              <button
                type="button"
                className="workTabletBtn"
                onClick={() => navigate('/work/home?zone=2')}
              >
                <PlantIcon aria-hidden="true" />
                <span className="workTabletBtnText">
                  <span className="workTabletBtnTitle">작물동</span>
                  <span className="workTabletBtnDesc">
                    작물동 업무 화면으로 넘어가
                    <br />
                    작업지시/출고처리를 진행합니다.
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