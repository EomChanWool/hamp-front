import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Panel } from "@components/card/Panel";
import { Badge } from "@components/common/Badge";
import { formatDateTime } from "@/utils/common";
import { apiClient } from "@/api/apiClient";
import axios from "axios";
import type { 
  UserDetailResponse, 
  ApiResponseUserDetailResponse, 
  UserUpdateRequest 
} from "@/types/User";
import type { AuthGroupResponse, ApiResponseListAuthGroupResponse } from "@/types/auth/Auth";
import Spinner from "@/components/common/Spinner";

export function SystemUserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [user, setUser] = useState<UserDetailResponse | null>(null);
  const [authGroups, setAuthGroups] = useState<AuthGroupResponse[]>([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  
  const [form, setForm] = useState<{
    userNm: string;
    phone: string;
    position: string;
    authIds: string[];
  }>({
    userNm: "",
    phone: "",
    position: "",
    authIds: [],
  });

  const isBusy = isUpdating || isDeactivating || isLoadingGroups;

  // 1. 전체 권한 그룹 목록 조회 (수정 모드 체크박스용)
  useEffect(() => {
    let isMounted = true;
    const loadAuthGroups = async () => {
      setIsLoadingGroups(true);
      try {
        const response = await apiClient.get<ApiResponseListAuthGroupResponse>("/auth-groups");
        if (isMounted) {
          setAuthGroups(response.data.data ?? []);
        }
      } catch (error) {
        console.error("권한 그룹 목록 조회 실패:", error);
      } finally {
        if (isMounted) setIsLoadingGroups(false);
      }
    };
    loadAuthGroups();
    return () => { isMounted = false; };
  }, []);

  // 2. 사용자 상세 데이터 조회 (ApiResponseUserDetailResponse 사용)
  useEffect(() => {
    let isMounted = true;

    const fetchUserDetail = async () => {
      if (!userId) return;
      setIsLoading(true);

      try {
        const encodedUserId = encodeURIComponent(userId);
        const response = await apiClient.get<ApiResponseUserDetailResponse>(`/users/${encodedUserId}`);
        const userData = response.data.data;

        if (userData && isMounted) {
          setUser(userData);
          // 서버에서 온 authGroups 객체 배열에서 authId들만 추출하여 폼에 세팅
          const initialAuthIds = userData.authGroups?.map((g) => g.authId) || [];
          
          setForm({
            userNm: userData.userNm || "",
            phone: userData.phone || "",
            position: userData.position || "",
            authIds: initialAuthIds,
          });
        }
      } catch (error) {
        console.error("사용자 상세 조회 실패:", error);
        if (isMounted) {
          alert("상세 정보를 불러오는 중 오류가 발생했습니다.");
          navigate({ pathname: "/system/users", search: location.search });
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchUserDetail();
    return () => { isMounted = false; };
  }, [userId, navigate, location.search]);

  // 수정 모드 취소 시 롤백
  useEffect(() => {
    if (user && !isEditing) {
      setForm({
        userNm: user.userNm || "",
        phone: user.phone || "",
        position: user.position || "",
        authIds: user.authGroups?.map((g) => g.authId) || [],
      });
    }
  }, [isEditing, user]);

  const handleChange = (key: "userNm" | "phone" | "position", value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // 권한 체크박스 토글 핸들러
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

  // 저장 처리 핸들러
  const handleSave = async () => {
    if (!user || isUpdating) return;

    if (!form.userNm?.trim()) {
      alert("이름을 입력해주세요.");
      return;
    }
    if (!form.authIds || form.authIds.length === 0) {
      alert("최소 하나 이상의 권한 그룹을 선택해주세요.");
      return;
    }

    setIsUpdating(true);
    try {
      const updatePayload: UserUpdateRequest = {
        userNm: form.userNm.trim(),
        phone: form.phone?.trim() ? form.phone.trim() : null,
        position: form.position?.trim() ? form.position.trim() : null,
        authIds: form.authIds,
      };

      const encodedUserId = encodeURIComponent(user.userId);
      await apiClient.put(`/users/${encodedUserId}`, updatePayload);

      alert("수정되었습니다.");
      
      // 수정한 권한 목록을 기반으로 user state 내부의 authGroups도 즉시 갱신
      const updatedAuthGroups = form.authIds.map((id) => {
        const found = authGroups.find((g) => g.authId === id);
        return { authId: id, authNm: found ? found.authNm : id };
      });

      setUser((prev) => prev ? { 
        ...prev, 
        userNm: updatePayload.userNm,
        phone: updatePayload.phone ?? "",
        position: updatePayload.position ?? "",
        authGroups: updatedAuthGroups,
      } : null);
      
      setIsEditing(false);
    } catch (err) {
      console.error("저장 실패:", err);
      const errorMessage = axios.isAxiosError(err) ? err.response?.data?.message : null;
      alert(errorMessage || "수정에 실패했습니다.");
    } finally {
      setIsUpdating(false);
    }
  };
  
  // 회원 비활성화 처리
  const handleDeactivate = async () => {
    if (!user || !user.use || isDeactivating) return;

    const confirmed = window.confirm(
      `${user.userNm}(${user.userId}) 회원을 비활성화하시겠습니까?\n비활성화 후에는 로그인할 수 없습니다.`
    );
    if (!confirmed) return;

    setIsDeactivating(true);
    try {
      const encodedUserId = encodeURIComponent(user.userId);
      await apiClient.delete(`/users/${encodedUserId}`);
      alert("회원이 비활성화되었습니다.");
      navigate({ pathname: "/system/users", search: location.search });
    } catch (error) {
      console.error("회원 비활성화 실패:", error);
      const message = axios.isAxiosError(error) ? error.response?.data?.message : null;
      alert(message || "회원 비활성화에 실패했습니다.");
    } finally {
      setIsDeactivating(false);
    }
  };

  if (isLoading) {
    return (
      <section className="screenStack">
        <Panel title="사용자 상세 정보">
          <div> <Spinner/> </div>
        </Panel>
      </section>
    );
  }

  if (!user) return null;

  return (
    <section className="screenStack">
      <Panel title={isEditing ? "사용자 정보 수정" : "사용자 상세 정보"}>
        <form className="pageForm" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
          
          {/* 사용자 ID */}
          <div className="detailField">
            <label>사용자ID</label>
            <div className="detailValue">{user.userId}</div>
          </div>

          {/* 이름 */}
          <div className="detailField">
            <label className={isEditing ? "requiredLabel" : ""}>
              이름 {isEditing && <span className="required">*</span>}
            </label>
            {isEditing ? (
              <input
                className="tableInput"
                value={form.userNm}
                disabled={isBusy}
                onChange={(e) => handleChange("userNm", e.target.value)}
                placeholder="이름 입력"
              />
            ) : (
              <div className="detailValue">{user.userNm || "-"}</div>
            )}
          </div>

          {/* 전화번호 */}
          <div className="detailField">
            <label>전화번호</label>
            {isEditing ? (
              <input
                className="tableInput"
                value={form.phone}
                disabled={isBusy}
                onChange={(e) => handleChange("phone", e.target.value)}
                placeholder="010-0000-0000"
              />
            ) : (
              <div className="detailValue">{user.phone || "-"}</div>
            )}
          </div>

          {/* 부서 */}
          <div className="detailField">
            <label>부서</label>
            {isEditing ? (
              <input
                className="tableInput"
                value={form.position}
                disabled={isBusy}
                onChange={(e) => handleChange("position", e.target.value)}
                placeholder="부서 입력"
              />
            ) : (
              <div className="detailValue">{user.position || "-"}</div>
            )}
          </div>

          {/* 사용여부 */}
          <div className="detailField">
            <label>사용여부</label>
            <div className="detailValue">
              <Badge tone={user.use ? "good" : "muted"}>
                {user.use ? "사용" : "미사용"}
              </Badge>
            </div>
          </div>

          {/* 생성일시 */}
          <div className="detailField">
            <label>생성일시</label>
            <div className="detailValue">{formatDateTime(user.createdAt)}</div>
          </div>

          {/* 권한 그룹 섹션 */}
          <div className="detailField authGroupField">
            <label className={isEditing ? "requiredLabel" : ""}>
              권한 그룹 {isEditing && <span className="required">*</span>}
            </label>

            {isEditing ? (
              isLoadingGroups ? (
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
                          disabled={isBusy}
                          onChange={(e) => handleAuthCheck(auth.authId, e.target.checked)}
                        />
                        <span>{auth.authNm}</span>
                      </label>
                    );
                  })}
                </div>
              )
            ) : (
              /* 조회 모드: 서버가 준 authGroups의 authNm들을 바로 나열 */
              <div className="detailValue">
                {user.authGroups && user.authGroups.length > 0
                  ? user.authGroups.map((g) => g.authNm).join(", ")
                  : "-"}
              </div>
            )}
          </div>

          {/* 하단 푸터 버튼 */}
          <div className="pageFormFooterSpaceBetween">
            <div>
              {isEditing && user.use && (
                <button
                  type="button"
                  className="dangerButton text-sm text-red-500 hover:underline px-2 py-1"
                  onClick={handleDeactivate}
                  disabled={isBusy}
                >
                  {isDeactivating ? "비활성화 처리 중..." : "회원 비활성화"}
                </button>
              )}
            </div>

            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              {isEditing ? (
                <>
                  <button
                    type="button"
                    className="ghostButton"
                    onClick={() => setIsEditing(false)}
                    disabled={isBusy}
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    className="primaryButton"
                    onClick={handleSave}
                    disabled={isBusy}
                  >
                    {isUpdating ? "저장 중..." : "저장"}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="ghostButton"
                    onClick={() => navigate({ pathname: "/system/users", search: location.search })}
                    disabled={isBusy}
                  >
                    목록
                  </button>
                  <button
                    type="button"
                    className="primaryButton"
                    onClick={() => setIsEditing(true)}
                    disabled={isBusy}
                  >
                    수정
                  </button>
                </>
              )}
            </div>
          </div>
        </form>
      </Panel>
    </section>
  );
}