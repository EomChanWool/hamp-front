import { useNavigate } from 'react-router-dom';
import './NotFound.css';

export function NotFound() {
  const navigate = useNavigate();

  return (
    <main className="notFoundPage">
      <section className="notFoundPanel">
        <div className="notFoundContent">
          <span className="notFoundCode">404</span>

          <h1>페이지를 찾을 수 없습니다.</h1>

          <p>
            요청하신 페이지가 존재하지 않거나
            <br />
            주소가 변경되었을 수 있습니다.
          </p>

          <button
            type="button"
            className="primaryButton"
            onClick={() => navigate('/')}
          >
            홈으로 이동
          </button>
        </div>
      </section>
    </main>
  );
}
