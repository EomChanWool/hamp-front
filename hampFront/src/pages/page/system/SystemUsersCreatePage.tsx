import { useEffect, useState, type SyntheticEvent } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import type { UserCreateRequest } from "@/api/User";
import type { AuthGroupResponse } from "@/api/auth/Auth";
import { AuthGroupApi } from "@/api/auth/Auth";
import { UserApi } from "@/api/User";
import { isValidPhone } from "@/utils/common";
import "@/pages/layout/Layout.css";
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
    // 전화번호: 선택 입력, 값이 있으면 형식 검사
    if (!isValidPhone(form.phone)) {
      alert("전화번호 형식이 올바르지 않습니다.\n예: 02-1234-5678, 010-1234-5678");
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

  const selectedCount = form.authIds?.length ?? 0;

  // ---- 요약 패널용 파생 값 ----
  const selectedAuthNames = authGroups
    .filter((auth) => form.authIds?.includes(auth.authId))
    .map((auth) => auth.authNm)
    .join(", ");

  const summaryRows: { label: string; value: string }[] = [
    { label: "사용자ID", value: form.userId.trim() },
    { label: "이름", value: form.userNm.trim() },
    { label: "전화번호", value: form.phone?.trim() ?? "" },
    { label: "직책", value: form.position?.trim() ?? "" },
    { label: "권한 그룹", value: selectedAuthNames },
  ];

  return (
    <section className="screenStack">
      <form className="formPage" onSubmit={handleSubmit}>
        <div className="formPageHead">
          <h1 className="formPageTitle">신규 사용자 등록</h1>
          <span className="formPageMeta">
            <span className="required" aria-hidden="true">*</span> 표시는 필수 입력 항목입니다
          </span>
        </div>

        <div className="formLayout">
          <div className="formMain">
            {/* 1. 기본정보 */}
            <section className="formCard" aria-labelledby="user-sec-basic">
              <div className="formCardHead">
                <div>
                  <h2 className="formCardTitle" id="user-sec-basic">기본정보</h2>
                  <p className="formCardDesc">사용자를 구분하는 ID와 이름, 연락처, 직책을 입력합니다.</p>
                </div>
              </div>

              <div className="formGrid">
                <div className="formField col3">
                  <label className="formLabel" htmlFor="user-id">
                    사용자ID <span className="required" aria-hidden="true">*</span>
                  </label>
                  <input
                    id="user-id"
                    className="formInput"
                    value={form.userId}
                    disabled={isSubmitting}
                    aria-required="true"
                    autoComplete="off"
                    onChange={(e) => handleChange("userId", e.target.value)}
                    placeholder="아이디 입력"
                  />
                </div>

                <div className="formField col3">
                  <label className="formLabel" htmlFor="user-name">
                    이름 <span className="required" aria-hidden="true">*</span>
                  </label>
                  <input
                    id="user-name"
                    className="formInput"
                    value={form.userNm}
                    disabled={isSubmitting}
                    aria-required="true"
                    autoComplete="off"
                    onChange={(e) => handleChange("userNm", e.target.value)}
                    placeholder="이름 입력"
                  />
                </div>

                <div className="formField col3">
                  <label className="formLabel" htmlFor="user-phone">전화번호</label>
                  <input
                    id="user-phone"
                    className="formInput"
                    type="tel"
                    value={form.phone ?? ""}
                    disabled={isSubmitting}
                    autoComplete="off"
                    onChange={(e) => handleChange("phone", e.target.value)}
                    placeholder="010-0000-0000"
                  />
                </div>

                <div className="formField col3">
                  <label className="formLabel" htmlFor="user-position">직책</label>
                  <input
                    id="user-position"
                    className="formInput"
                    value={form.position ?? ""}
                    disabled={isSubmitting}
                    autoComplete="off"
                    onChange={(e) => handleChange("position", e.target.value)}
                    placeholder="직책 입력"
                  />
                </div>
              </div>
            </section>

            {/* 2. 권한정보 */}
            <section className="formCard" aria-labelledby="user-sec-auth">
              <div className="formCardHead">
                <div>
                  <h2 className="formCardTitle" id="user-sec-auth">
                    권한정보 <span className="required" aria-hidden="true">*</span>
                  </h2>
                  <p className="formCardDesc">사용자에게 부여할 권한 그룹을 선택합니다. 여러 개를 선택할 수 있습니다.</p>
                </div>
                <span className="formCardMeta">
                  총 {authGroups.length}개 중 {selectedCount}개 선택
                </span>
              </div>

              {isLoadingGroups ? (
                <div className="formEmpty">
                  <div className="formEmptyTitle">권한 그룹 목록을 불러오는 중입니다</div>
                </div>
              ) : authGroups.length === 0 ? (
                <div className="formEmpty">
                  <div className="formEmptyTitle">선택 가능한 권한 그룹이 없습니다</div>
                  <p className="formEmptyDesc">권한 그룹을 먼저 등록한 뒤 사용자를 등록해주세요.</p>
                </div>
              ) : (
                <div
                  className="cardButtonGroup"
                  style={{ flexWrap: "wrap" }}
                  role="group"
                  aria-labelledby="user-sec-auth"
                >
                  {authGroups.map((auth) => {
                    const isChecked = form.authIds?.includes(auth.authId) ?? false;
                    return (
                      <button
                        key={auth.authId}
                        type="button"
                        className={`typeCardButton ${isChecked ? "active" : ""}`}
                        aria-pressed={isChecked}
                        disabled={isSubmitting}
                        onClick={() => handleAuthCheck(auth.authId, !isChecked)}
                      >
                        <span className="cardText main">{auth.authNm}</span>
                        {auth.authDesc && <span className="cardText sub">{auth.authDesc}</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
          {/* ===== 우측: 요약 + 액션 ===== */}
          <aside className="formCard formAside" aria-label="사용자 요약">
            <section className="formAsideSection" aria-labelledby="user-summary-title">
              <h2 className="formCardTitle" id="user-summary-title">사용자 요약</h2>
              <dl className="formSummaryList">
                {summaryRows.map((row) => (
                  <div className="formSummaryRow" key={row.label}>
                    <dt>{row.label}</dt>
                    <dd className={row.value ? undefined : "isEmpty"}>{row.value || "미입력"}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <p className="formHint" role="note">
              <strong className="formHintTitle">초기 비밀번호 안내</strong>
              등록 화면에서는 비밀번호를 입력하지 않습니다. 초기 비밀번호는 '0000'으로 설정되며,
              첫 로그인 시 새로운 비밀번호로 변경해야 합니다.
            </p>

            <div className="formActions">
              <button type="submit" className="primaryButton" disabled={isSubmitting}>
                {isSubmitting ? "등록 중..." : "등록"}
              </button>
              <button type="button" className="ghostButton" onClick={handleCancel} disabled={isSubmitting}>
                취소
              </button>
            </div>
          </aside>
        </div>
      </form>
    </section>
  );
}
