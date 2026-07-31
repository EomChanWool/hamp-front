import { LockClosedIcon, KeyIcon } from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";
import { useState, type SyntheticEvent } from "react";
import { useAuth } from "@/context/AuthContext";

export function ChangePasswordPage() {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const navigate = useNavigate();
    const { changePassword, logout } = useAuth();

    const handleChangePassword = async (e: SyntheticEvent) => {
        e.preventDefault();

        // 프론트엔드 1차 체크: 두 비밀번호가 일치하는지 확인
        if (newPassword !== confirmPassword) {
            alert('새 비밀번호와 비밀번호 확인이 일치하지 않습니다.');
            return;
        }

        try {
            setIsSubmitting(true);

            // changePassword의 리턴값(res)을 받아옵니다.
            const res: any = await changePassword({ currentPassword, newPassword });
            alert(res?.message || '비밀번호가 변경되었습니다.');

            // 변경 완료 후 메인 화면 이동
            navigate('/', { replace: true });
        } catch (error: any) {
            // 백엔드 실패 예외 메시지 출력
            alert(error.message || '비밀번호 변경 중 오류가 발생했습니다.');
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