import { useEffect, useState, type SyntheticEvent } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import type { UserCreateRequest } from "@/api/User";
import type { AuthGroupResponse } from "@/api/auth/Auth";
import { AuthGroupApi } from "@/api/auth/Auth";
import { UserApi } from "@/api/User";
import './SystemUser.css';

export function SystemUsersCreatePage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [authGroups, setAuthGroups] = useState<AuthGroupResponse[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState<UserCreateRequest>({
    userId: "",
    userNm: "",
    phone: "",
    position: "",
    authIds: [],
  });

  // 권한 그룹 목록 조회 (페이지 진입 시)
  useEffect(() => {
    let isMounted = true;
    const loadAuthGroups = async () => {
      setIsLoadingGroups(true);
      try {
        const response = await AuthGroupApi.getList();
        if (isMounted) {
          setAuthGroups(response.data ?? []);
        }
      } catch (error) {
        console.error("권한 그룹 목록 조회 실패:", error);
      } finally {
        if (isMounted) {
          setIsLoadingGroups(false);
        }
      }
    };
    loadAuthGroups();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleChange = (key: keyof UserCreateRequest, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // 체크박스 토글 핸들러
  const handleAuthCheck = (authId: string, checked: boolean) => {
    setForm((prev) => {
      const currentAuthIds = prev.authIds || [];
      return {
        ...prev,
        authIds: checked
          ? [...currentAuthIds, authId]
          : currentAuthIds.filter((id) => id !== authId),
      };
    });
  };

  // 이전 검색 조건을 유지하면서 목록으로 이동 (취소 버튼용)
  const handleCancel = () => {
    navigate({
      pathname: "/system/users",
      search: location.search,
    });
  };

  // 프론트엔드 유효성 체크
  const validateForm = (): boolean => {
    if (!form.userId.trim()) {
      alert("사용자 ID를 입력해주세요.");
      return false;
    }
    if (!form.userNm.trim()) {
      alert("이름을 입력해주세요.");
      return false;
    }
    if (!form.authIds || form.authIds.length === 0) {
      alert("최소 하나 이상의 권한 그룹을 선택해주세요.");
      return false;
    }
    return true;
  };

  // 등록 제출 핸들러
  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    const payload: UserCreateRequest = {
      userId: form.userId.trim(),
      userNm: form.userNm.trim(),
      phone: form.phone?.trim() ? form.phone.trim() : null,
      position: form.position?.trim() ? form.position.trim() : null,
      authIds: form.authIds ?? [],
    };

    setIsSubmitting(true);
    try {
      await UserApi.create(payload);
      alert("성공적으로 등록되었습니다.");

      // [등록 완료 시] 검색 조건을 초기화하고 목록으로 이동
      navigate({
        pathname: "/system/users",
        search: "",
      });
    } catch (error) {
      console.error("회원 등록 실패:", error);
      const message = axios.isAxiosError(error)
        ? error.response?.data?.message
        : null;
      alert(message || "회원 등록 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="screenStack">
      <div className="createCard">
        <div className="createHeader">
          <h1 className="createTitle">신규 사용자 등록</h1>
          <span className="createMeta">* 표시는 필수 입력 항목입니다</span>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="createBody">
            {/* 1. 기본 정보 섹션 */}
            <div className="createSection">
              <h2 className="createSectionTitle">기본정보</h2>
              <div className="createGrid2Cols">
                <div className="createField">
                  <label className="requiredLabel">
                    사용자ID <span className="required">*</span>
                  </label>
                  <input
                    className="tableInput"
                    value={form.userId}
                    disabled={isSubmitting}
                    onChange={(e) => handleChange("userId", e.target.value)}
                    placeholder="아이디 입력"
                  />
                </div>

                <div className="createField">
                  <label className="requiredLabel">
                    이름 <span className="required">*</span>
                  </label>
                  <input
                    className="tableInput"
                    value={form.userNm}
                    disabled={isSubmitting}
                    onChange={(e) => handleChange("userNm", e.target.value)}
                    placeholder="이름 입력"
                  />
                </div>

                <div className="createField">
                  <label>전화번호</label>
                  <input
                    className="tableInput"
                    value={form.phone ?? ""}
                    disabled={isSubmitting}
                    onChange={(e) => handleChange("phone", e.target.value)}
                    placeholder="010-0000-0000"
                  />
                </div>

                <div className="createField">
                  <label>부서</label>
                  <input
                    className="tableInput"
                    value={form.position ?? ""}
                    disabled={isSubmitting}
                    onChange={(e) => handleChange("position", e.target.value)}
                    placeholder="부서 입력"
                  />
                </div>
              </div>
            </div>

            {/* 2. 권한 정보 섹션 */}
            <div className="createSection">
              <h2 className="createSectionTitle">권한정보</h2>
              <div className="createField authGroupField">
                <label className="requiredLabel">
                  권한 그룹 <span className="required">*</span>
                </label>

                {isLoadingGroups ? (
                  <div className="authGroupEmpty">권한 그룹 목록을 불러오는 중...</div>
                ) : authGroups.length === 0 ? (
                  <div className="authGroupEmpty">선택 가능한 권한 그룹이 없습니다.</div>
                ) : (
                  <div className="authGroupList">
                    {authGroups.map((auth) => {
                      const isChecked = form.authIds?.includes(auth.authId) ?? false;
                      return (
                        <label
                          key={auth.authId}
                          className={`authGroupItem ${isChecked ? "checked" : ""}`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={isSubmitting}
                            onChange={(e) => handleAuthCheck(auth.authId, e.target.checked)}
                          />
                          <span>{auth.authNm}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="createFooter">
            <button type="button" className="ghostButton" onClick={handleCancel} disabled={isSubmitting}>
              취소
            </button>
            <button type="submit" className="primaryButton" disabled={isSubmitting}>
              {isSubmitting ? "등록 중..." : "등록"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
