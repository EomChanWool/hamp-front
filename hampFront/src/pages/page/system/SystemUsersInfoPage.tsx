import { useEffect, useState } from "react";
import axios from "axios";
import { Badge } from "@components/common/Badge";
import { formatDateTime } from "@/utils/common";
import { apiClient } from "@/api/apiClient";
import { useAuth } from "@/context/AuthContext";
import { AuthApi } from "@/api/auth/Auth";
import type { UserDetailResponse, ApiResponseUserDetailResponse, UserUpdateRequest } from "@/api/User";
import Spinner from "@/components/common/Spinner";
import { isValidPhone } from "@/utils/common";
import "./SystemUser.css";
import { useNavigate } from "react-router-dom";

const EMPTY_PASSWORD = { current: "", new: "", confirm: "" };

/* 라벨-값 한 줄 (점선 구분) */
function Row({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="profileRow">
      <div className="profileRowLabel">
        {label}
        {required && <span className="profileRequired">*</span>}
      </div>
      <div className="profileRowValue">{children}</div>
    </div>
  );
}

export function SystemUsersInfoPage() {
  const { user: authUser } = useAuth();
  const navigate = useNavigate();

  const [user, setUser] = useState<UserDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [form, setForm] = useState({
    userNm: "",
    phone: "",
    position: "",
    authIds: [] as string[],
  });
  const [passwordForm, setPasswordForm] = useState(EMPTY_PASSWORD);

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      if (!authUser?.userId) return;
      setIsLoading(true);
      try {
        const userRes = await apiClient.get<ApiResponseUserDetailResponse>(
          `/users/${encodeURIComponent(authUser.userId)}`,
        );
        if (isMounted && userRes.data.data) setUser(userRes.data.data);
      } catch (e) {
        console.error(e);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    loadData();
    return () => {
      isMounted = false;
    };
  }, [authUser?.userId]);

  // 수정 모드 진입/취소 시 폼을 서버 값으로 초기화
  useEffect(() => {
    if (user && !isEditing) {
      setForm({
        userNm: user.userNm || "",
        phone: user.phone || "",
        position: user.position || "",
        authIds: user.authGroups?.map((g) => g.authId) || [],
      });
      setPasswordForm(EMPTY_PASSWORD);
    }
  }, [isEditing, user]);

  const handleSave = async () => {

    if (!user || isUpdating) return;
    if (!form.userNm.trim()) {
      alert("이름을 입력해주세요.");
      return;
    }
    if (passwordForm.new) {
      if (!passwordForm.current) {
        alert("현재 비밀번호를 입력해주세요.");
        return;
      }
      if (passwordForm.new !== passwordForm.confirm) {
        alert("새 비밀번호가 일치하지 않습니다.");
        return;
      }
    }
    // 전화번호: 선택 입력, 값이 있으면 형식 검사
    if (!isValidPhone(form.phone)) {
      alert("전화번호 형식이 올바르지 않습니다.\n예: 02-1234-5678, 010-1234-5678");
      return false;
    }

    setIsUpdating(true);
    try {
      const userNm = form.userNm.trim();
      const phone = form.phone.trim();
      const position = form.position.trim();

      const updatePayload: UserUpdateRequest = {
        userNm,
        phone: phone || null,
        position: position || null,
        authIds: form.authIds,
      };
      await apiClient.put(`/users/${encodeURIComponent(user.userId)}`, updatePayload);

      if (passwordForm.new) {
        const passwordRes = await AuthApi.changePassword({
          currentPassword: passwordForm.current,
          newPassword: passwordForm.new,
        });

        if (passwordRes.status !== "OK") {
          throw new Error(passwordRes.message || "비밀번호 변경에 실패했습니다.");
        }
      }

      setUser({ ...user, userNm, phone, position });

      alert("정보가 수정되었습니다.");
      setIsEditing(false);
    } catch (e) {
      console.error(e);
      const message = axios.isAxiosError(e) ? e.response?.data?.message : null;
      alert(message || "저장에 실패했습니다.");
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading)
    return (
      <div className="screenStack">
        <Spinner />
      </div>
    );
  if (!user) return <div className="screenStack">사용자 정보를 불러올 수 없습니다.</div>;

  const initial = (user.userNm || user.userId || "?").trim().charAt(0).toUpperCase();

  return (
    <section className="screenStack">
      <div className="profilePage">
        <nav className="profileCrumb" aria-label="breadcrumb">
          <span>내 계정</span>
          <span className="profileCrumbSep">/</span>
          <strong>{isEditing ? "내 정보 수정" : "내 정보"}</strong>
        </nav>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            console.trace("form onSubmit 실행됨");
            handleSave();
          }}
        >
          {/* ── Hero: 헤더 전체가 패턴 배경 ── */}
          <header className="profileHero">
            <div className="profileHeroBody">
              <div className="profileIdentity">
                <div className="profileAvatar" aria-hidden="true">
                  {initial}
                </div>
                <h1 className="profileName">
                  {user.userNm}
                </h1>
                <p className="profileSub">{user.userId}</p>
              </div>

              <div className="profileActions">
                {isEditing ? (
                  <>
                    <button
                      type="button"
                      className="ghostButton"
                      onClick={() => setIsEditing(false)}
                      disabled={isUpdating}
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      className="primaryButton"
                      disabled={isUpdating}
                      onClick={handleSave}
                    >
                      {isUpdating ? "저장 중..." : "저장"}
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" className="ghostButton" onClick={() => navigate(-1)}>
                      이전
                    </button>
                    <button
                      type="button"
                      className="primaryButton"
                      onClick={() => {
                        setIsEditing(true);
                      }}
                    >
                      수정
                    </button>
                  </>
                )}
              </div>
            </div>
          </header>

          {/* ── 기본 정보 ── */}
          <section className="profileCard">
            <h2 className="profileCardTitle">기본 정보</h2>

            <Row label="사용자 ID">{user.userId}</Row>

            <Row label="이름" required={isEditing}>
              {isEditing ? (
                <input
                  className="profileInput"
                  disabled={isUpdating}
                  value={form.userNm}
                  onChange={(e) => setForm({ ...form, userNm: e.target.value })}
                />
              ) : (
                user.userNm
              )}
            </Row>

            <Row label="전화번호">
              {isEditing ? (
                <input
                  className="profileInput"
                  type="tel"
                  disabled={isUpdating}
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              ) : (
                user.phone || "-"
              )}
            </Row>

            <Row label="직책">
              {isEditing ? (
                <input
                  className="profileInput"
                  disabled={isUpdating}
                  value={form.position}
                  onChange={(e) => setForm({ ...form, position: e.target.value })}
                />
              ) : (
                user.position || "-"
              )}
            </Row>

            <Row label="사용 여부">
              <Badge tone={user.use ? "good" : "muted"}>{user.use ? "사용" : "미사용"}</Badge>
            </Row>

            <Row label="생성일시">{formatDateTime(user.createdAt)}</Row>
          </section>

          {/* ── 보안 ── */}
          <section className="profileCard">
            <h2 className="profileCardTitle">보안</h2>

            {isEditing ? (
              <>
                <Row label="현재 비밀번호">
                  <input
                    type="password"
                    autoComplete="current-password"
                    placeholder="변경 시에만 입력"
                    className="profileInput"
                    disabled={isUpdating}
                    value={passwordForm.current}
                    onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                  />
                </Row>
                <Row label="새 비밀번호">
                  <input
                    type="password"
                    autoComplete="new-password"
                    className="profileInput"
                    disabled={isUpdating}
                    value={passwordForm.new}
                    onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })}
                  />
                </Row>
                <Row label="새 비밀번호 확인">
                  <input
                    type="password"
                    autoComplete="new-password"
                    className="profileInput"
                    disabled={isUpdating}
                    value={passwordForm.confirm}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                  />
                </Row>
              </>
            ) : (
              <Row label="비밀번호">
                <span className="profileMask">••••••••</span>
                <span className="profileHint">수정 화면에서 변경할 수 있습니다.</span>
              </Row>
            )}
          </section>
        </form>
      </div>
    </section>
  );
}