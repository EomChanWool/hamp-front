import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import '@/pages/work/WorkTabletHome.css'; // 파일명 오타(Table -> Tablet)도 확인해 주세요!

export function WorkTabletHome() {
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

          <div className="workTabletTopBar">
            <div className="workTabletUserInfo">
              <span className="workTabletUserName">{user?.userNm ?? '사용자'}</span>
              {user?.position && <span className="workTabletUserPosition">{user.position}</span>}
            </div>
            <button type="button" className="workTabletLogoutBtn" onClick={handleLogout}>
              로그아웃
            </button>
          </div>

          <div className="workTabletHeader">
            <h1>현장 태블릿 메뉴</h1>
            <p>원하시는 업무를 선택해 주세요.</p>
          </div>
          
          <div className="workTabletMenuButtons">
            {/* 작업지시 버튼 -> 식품생산관리: 작업지시관리 경로 연결 */}
            <button 
              type="button"
              className="workTabletBtn"
              onClick={() => navigate('/food/work-orders')}
            >
              작업지시
            </button>

            {/* 신고처리 버튼 -> 태블릿 신고처리 스캔 화면 연결 */}
            <button
              type="button"
              className="workTabletBtn"
              onClick={() => navigate('/work/seed-report-scan')}
            >
              신고처리
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}