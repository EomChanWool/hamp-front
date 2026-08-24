import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Badge } from "@components/common/Badge";
import { formatDateTime } from "@/utils/common";
import axios from "axios";
import type { UserDetailResponse, UserUpdateRequest } from "@/api/User";
import type { AuthGroupResponse } from "@/api/auth/Auth";
import Spinner from "@/components/common/Spinner";
import { UserApi } from "@/api/User";
import { AuthGroupApi } from "@/api/auth/Auth";
import { DetailLayout, type DetailSection } from "@/pages/layout/DetailLayout";
import "./SystemUser.css";

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

  // 기본 정보 필드는 DetailLayout이 다루고, 권한 그룹(체크박스 다중선택)은 별도 상태로 관리
  const [form, setForm] = useState<Record<string, string>>({
    userId: "",
    userNm: "",
    phone: "",
    position: "",
    use: "",
    createdAt: "",
  });
  const [authIds, setAuthIds] = useState<string[]>([]);

  const isBusy = isUpdating || isDeactivating || isLoadingGroups;

  // 섹션 정의: 기본 정보로 그룹핑
  const sections: DetailSection<UserDetailResponse>[] = [
    {
      title: "기본 정보",
      fields: [
        { label: "이름", key: "userNm", editable: true, required: true },
        { label: "전화번호", key: "phone", editable: true },
        { label: "부서", key: "position", editable: true },
      ],
    },
  ];

  // 1. 전체 권한 그룹 목록 조회 (수정 모드 체크박스용)
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
        if (isMounted) setIsLoadingGroups(false);
      }
    };
    loadAuthGroups();
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. 사용자 상세 데이터 조회
  useEffect(() => {
    let isMounted = true;

    const fetchUserDetail = async () => {
      if (!userId) return;
      setIsLoading(true);

      try {
        const encodedUserId = encodeURIComponent(userId);
        const response = await UserApi.getDetail(encodedUserId);
        const userData = response.data;

        if (userData && isMounted) {
          setUser(userData);
          const initialAuthIds = userData.authGroups?.map((g) => g.authId) || [];

          setForm({
            userId: userData.userId,
            userNm: userData.userNm || "",
            phone: userData.phone || "",
            position: userData.position || "",
            use: userData.use ? "Y" : "N",
            createdAt: formatDateTime(userData.createdAt),
          });
          setAuthIds(initialAuthIds);
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
        use: user.use ? "Y" : "N",
        createdAt: formatDateTime(user.createdAt),
      });
      setAuthIds(user.authGroups?.map((g) => g.authId) || []);
    }
  }, [isEditing, user]);

  // 권한 체크박스 토글 핸들러
  const handleAuthCheck = (authId: string, checked: boolean) => {
    setAuthIds((prev) =>
      checked ? [...prev, authId] : prev.filter((id) => id !== authId)
    );
  };

  // 저장 처리 핸들러
  const handleSave = async () => {
    if (!user || isUpdating) return;

    if (!form.userNm?.trim()) {
      alert("이름을 입력해주세요.");
      return;
    }
    if (!authIds || authIds.length === 0) {
      alert("최소 하나 이상의 권한 그룹을 선택해주세요.");
      return;
    }

    setIsUpdating(true);
    try {
      const updatePayload: UserUpdateRequest = {
        userNm: form.userNm.trim(),
        phone: form.phone?.trim() ? form.phone.trim() : null,
        position: form.position?.trim() ? form.position.trim() : null,
        authIds,
      };

      const encodedUserId = encodeURIComponent(user.userId);
      await UserApi.update(encodedUserId, updatePayload);

      alert("수정되었습니다.");

      // 수정한 권한 목록을 기반으로 user state 내부의 authGroups도 즉시 갱신
      const updatedAuthGroups = authIds.map((id) => {
        const found = authGroups.find((g) => g.authId === id);
        return { authId: id, authNm: found ? found.authNm : id };
      });

      setUser((prev) =>
        prev
          ? {
            ...prev,
            userNm: updatePayload.userNm ?? "",
            phone: updatePayload.phone ?? "",
            position: updatePayload.position ?? "",
            authGroups: updatedAuthGroups,
          }
          : null
      );

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
      await UserApi.delete(encodedUserId);
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
        <div className="detailCard">
          <div className="flex justify-center p-10">
            <Spinner />
          </div>
        </div>
      </section>
    );
  }

  if (!user) return null;

  return (
    <section className="screenStack">
      <DetailLayout
        title={form.userNm}
        subtitle={
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span>{form.userId}</span>
            <Badge tone={form.use === "Y" ? "good" : "muted"}>
              {form.use === "Y" ? "사용" : "미사용"}
            </Badge>
          </div>
        }
        meta={`등록일자 ${form.createdAt}`}
        sections={sections}
        form={form}
        isEditing={isEditing}
        isBusy={isBusy}
        onChangeField={(key, val) => setForm((prev) => ({ ...prev, [key]: val }))}
        onSubmit={(e) => {
          e.preventDefault();
          handleSave();
        }}
        footerLeft={
          isEditing &&
          user.use && (
            <button
              type="button"
              className="btnDanger"
              onClick={handleDeactivate}
              disabled={isBusy}
            >
              {isDeactivating ? "비활성화 처리 중..." : "회원 비활성화"}
            </button>
          )
        }
        footerRight={
          isEditing ? (
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
                onClick={() =>
                  navigate({ pathname: "/system/users", search: location.search })
                }
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
          )
        }
      >
        {/* 권한 그룹 영역: 체크박스 다중선택이라 섹션 grid 대신 children으로 렌더링 */}
        <div className="detailSection detailSection--full">
          <label className={isEditing ? "requiredLabel" : undefined}>
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
                  const isChecked = authIds?.includes(auth.authId) ?? false;
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
            <div className="detailValue">
              {user.authGroups && user.authGroups.length > 0
                ? user.authGroups.map((g) => g.authNm).join(", ")
                : "-"}
            </div>
          )}
        </div>
      </DetailLayout>
    </section>
  );
}
