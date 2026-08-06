import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Panel } from "@components/card/Panel";
import { Badge } from "@components/common/Badge";
import { formatDateTime } from "@/utils/common";
import { apiClient } from "@/api/apiClient";
import axios from "axios";
import type { 
  UserResponse, 
  ApiResponseUserResponse, 
  UserUpdateRequest 
} from "@/types/User";

type Field = {
  label: string;
  key: string;
  editable?: boolean;
};

export function SystemUserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [user, setUser] = useState<UserResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const isBusy = isUpdating || isDeactivating;

  const fields: Field[] = [
    { label: "사용자ID", key: "userId", editable: false },
    { label: "이름", key: "userNm" },
    { label: "전화번호", key: "phone" },
    { label: "부서", key: "position" },
    { label: "사용여부", key: "use", editable: false },
    { label: "생성일시", key: "createdAt", editable: false },
  ];

  // 상세 데이터 조회
  useEffect(() => {
    let isMounted = true;

    const fetchUserDetail = async () => {
      if (!userId) return;
      setIsLoading(true);

      try {
        const encodedUserId = encodeURIComponent(userId);
        const response = await apiClient.get<ApiResponseUserResponse>(`/users/${encodedUserId}`);
        const userData = response.data.data;

        if (userData && isMounted) {
          setUser(userData);
          setForm({
            userId: userData.userId,
            userNm: userData.userNm || "",
            phone: userData.phone || "",
            position: userData.position || "",
            use: userData.use ? "사용" : "미사용",
            createdAt: formatDateTime(userData.createdAt),
          });
        }
      } catch (error) {
        console.error("사용자 상세 조회 실패:", error);
        if (isMounted) {
          alert("상세 정보를 불러오는 중 오류가 발생했습니다.");
          navigate({ pathname: "/system/users", search: location.search });
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchUserDetail();

    return () => {
      isMounted = false;
    };
  }, [userId, navigate, location.search]);

  // 수정 모드 취소 시 롤백
  useEffect(() => {
    if (user && !isEditing) {
      setForm({
        userId: user.userId,
        userNm: user.userNm || "",
        phone: user.phone || "",
        position: user.position || "",
        use: user.use ? "사용" : "미사용",
        createdAt: formatDateTime(user.createdAt),
      });
    }
  }, [isEditing, user]);

  // 저장 처리 핸들러
  const handleSave = async () => {
    if (!user || isUpdating) return;

    if (!form.userNm?.trim()) {
      alert("이름을 입력해주세요.");
      return;
    }

    setIsUpdating(true);
    try {
      const updatePayload: UserUpdateRequest = {
        userNm: form.userNm.trim(),
        phone: form.phone?.trim() ? form.phone.trim() : null,
        position: form.position?.trim() ? form.position.trim() : null,
      };

      const encodedUserId = encodeURIComponent(user.userId);
      const response = await apiClient.put<ApiResponseUserResponse>(
        `/users/${encodedUserId}`,
        updatePayload
      );

      alert(response.data?.message || "수정되었습니다.");
      
      setUser((prev) => prev ? { 
        ...prev, 
        userNm: updatePayload.userNm,
        phone: updatePayload.phone ?? "",
        position: updatePayload.position ?? "",
      } : null);
      
      setIsEditing(false); // 정상 저장 완료 후 조회 모드로 복귀
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
          <div className="p-8 text-center">데이터를 불러오는 중입니다...</div>
        </Panel>
      </section>
    );
  }

  if (!user) return null;

  return (
    <section className="screenStack">
      <Panel title={isEditing ? "사용자 정보 수정" : "사용자 상세 정보"}>
        <form className="pageForm" onSubmit={handleSave}>
          {fields.map(({ label, key, editable }) => (
            <div key={key} className="detailField">
              <label>{label}</label>

              {isEditing && editable !== false ? (
                <input
                  className="tableInput"
                  value={form[key] ?? ""}
                  disabled={isBusy}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      [key]: e.target.value,
                    }))
                  }
                />
              ) : (
                <div className="detailValue">
                  {key === "use" ? (
                    <Badge tone={user.use ? "good" : "muted"}>
                      {user.use ? "사용" : "미사용"}
                    </Badge>
                  ) : (
                    form[key] || "-"
                  )}
                </div>
              )}
            </div>
          ))}

          {/* 상세 페이지용 푸터 (좌우 분리) */}
          <div className="pageFormFooterSpaceBetween">
            {/* 좌측: 수정 모드일 때만 나오는 비활성화 버튼 */}
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

            {/* 우측: 버튼 그룹 (인라인 스타일로 간격 8px 강제 적용) */}
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
                    취소
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