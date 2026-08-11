import { LockClosedIcon, KeyIcon } from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";
import { useState, type SyntheticEvent } from "react";
import { useAuth } from "@/context/AuthContext";
import './LoginPage.css';

export function ChangePasswordPage() {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const navigate = useNavigate();
    const { changePassword, logout } = useAuth();

    // 1차: 프론트엔드 유효성 검증
    const validateForm = (): boolean => {
        if (!currentPassword.trim()) {
            alert('현재 비밀번호를 입력해주세요.');
            return false;
        }
        if (!newPassword.trim()) {
            alert('새 비밀번호를 입력해주세요.');
            return false;
        }
        if (!confirmPassword.trim()) {
            alert('새 비밀번호 확인을 입력해주세요.');
            return false;
        }
        if (currentPassword === newPassword) {
            alert('현재 비밀번호와 다른 새 비밀번호를 입력해주세요.');
            return false;
        }
        if (newPassword !== confirmPassword) {
            alert('새 비밀번호와 비밀번호 확인이 일치하지 않습니다.');
            return false;
        }
        return true;
    };

    const handleChangePassword = async (e: SyntheticEvent) => {
        e.preventDefault();

        // [1차 검증] 프론트엔드 유효성 체크
        if (!validateForm()) {
            return; // 조건을 만족하지 못하면 API 요청 차단
        }

        try {
            setIsSubmitting(true);

            // changePassword 호출 및 백엔드 응답 수신
            const res: any = await changePassword({ currentPassword, newPassword });
            alert(res?.message || '비밀번호가 성공적으로 변경되었습니다.');

            // 변경 완료 후 메인 화면 이동
            navigate('/', { replace: true });
        } catch (error: any) {
            // [2차 검증] 백엔드 응답 에러 메시지 노출 (Axios/Fetch 응답 구조 대응)
            const apiErrorMessage =
                error.response?.data?.message || error.message || '비밀번호 변경 중 오류가 발생했습니다.';

            alert(apiErrorMessage);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleLogout = async () => {
        await logout();
        navigate('/login', { replace: true });
    };

    return (
        <main className="loginPage">
            <section className="loginPanel">
                <form className="loginForm" onSubmit={handleChangePassword}>
                    <div className="loginLogo">
                        <div className="brandMark">H</div>
                        <h2>HEMP-MES</h2>
                    </div>

                    <p>
                        안전한 서비스 이용을 위해 초기 비밀번호를 변경해 주세요.
                    </p>

                    <div className="inputGroup">
                        {/* 현재 비밀번호 */}
                        <label htmlFor="currentPassword">
                            <input
                                id="currentPassword"
                                type="password"
                                placeholder="현재 비밀번호 (초기: 0000)"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                            />
                            <KeyIcon className="inputIcon" />
                        </label>

                        {/* 새 비밀번호 */}
                        <label htmlFor="newPassword">
                            <input
                                id="newPassword"
                                type="password"
                                placeholder="새 비밀번호"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                            />
                            <LockClosedIcon className="inputIcon" />
                        </label>

                        {/* 새 비밀번호 확인 */}
                        <label htmlFor="confirmPassword">
                            <input
                                id="confirmPassword"
                                type="password"
                                placeholder="새 비밀번호 확인"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                            />
                            <LockClosedIcon className="inputIcon" />
                        </label>
                    </div>

                    <button type="submit" className="primaryButton" disabled={isSubmitting}>
                        {isSubmitting ? '변경 중...' : '비밀번호 변경완료'}
                    </button>

                    <button
                        type="button"
                        className="ghostButton"
                        style={{ marginTop: '8px', width: '100%' }}
                        onClick={handleLogout}
                    >
                        로그아웃하고 나가기
                    </button>
                </form>
            </section>
        </main>
    );
}