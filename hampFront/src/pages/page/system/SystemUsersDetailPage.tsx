import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Badge } from "@components/common/Badge";
import { formatDateTime } from "@/utils/common";
import axios from "axios";
import type { UserDetailResponse, UserUpdateRequest } from "@/api/User";
import type { AuthGroupResponse } from "@/api/auth/Auth";
import type { MenuPermissionResponse } from "@/api/Menu";
import Spinner from "@/components/common/Spinner";
import { UserApi } from "@/api/User";
import { AuthGroupApi } from "@/api/auth/Auth";
import { DetailLayout, type DetailSection } from "@/pages/layout/DetailLayout";
import { ChevronUpIcon, ChevronDownIcon } from "@heroicons/react/24/outline";
import "./SystemUser.css";

// 소메뉴 옆에 표시할 CRUD 권한 필드 정의
const PERMISSION_FIELDS: {
  key: "create" | "read" | "update" | "delete" | "approve";
  label: string;
}[] = [
    { key: "read", label: "조회" },
    { key: "create", label: "등록" },
    { key: "update", label: "수정" },
    { key: "delete", label: "삭제" },
    { key: "approve", label: "승인" },
  ];

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

  // 각 권한 그룹별 접힘/펼침 상태 (authId 기준, 기본값 true = 요약 상태)
  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>({});

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

  const sections: DetailSection<UserDetailResponse>[] = [
    {
      title: "기본 정보",
      fields: [
        { label: "이름", key: "userNm", editable: true, required: true },
        { label: "전화번호", key: "phone", editable: true },
        { label: "부서", key: "position", editable: true, fullWidth: true },
      ],
    },
  ];

  // 1. 전체 권한 그룹 목록 조회
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

  // 2. 사용자 상세 데이터 조회 함수
  const fetchUserDetail = async () => {
    if (!userId) return;
    setIsLoading(true);

    try {
      const encodedUserId = encodeURIComponent(userId);
      const response = await UserApi.getDetail(encodedUserId);
      const userData = response.data;

      if (userData) {
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
      alert("상세 정보를 불러오는 중 오류가 발생했습니다.");
      navigate({ pathname: "/system/users", search: location.search });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUserDetail();
  }, [userId, navigate, location.search]);

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

  const handleAuthCheck = (authId: string, checked: boolean) => {
    setAuthIds((prev) =>
      checked ? [...prev, authId] : prev.filter((id) => id !== authId)
    );
  };

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
      await fetchUserDetail();
      setIsEditing(false);
    } catch (err) {
      console.error("저장 실패:", err);
      const errorMessage = axios.isAxiosError(err) ? err.response?.data?.message : null;
      alert(errorMessage || "수정에 실패했습니다.");
    } finally {
      setIsUpdating(false);
    }
  };

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

  // 권한 그룹별 요약/전체보기 토글 함수
  const toggleCollapse = (authId: string) => {
    setCollapsedMap((prev) => {
      const currentState = prev[authId] ?? true;
      return {
        ...prev,
        [authId]: !currentState,
      };
    });
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
        <div className="detailSection detailSection--full">
          <label className={isEditing ? "requiredLabel" : "sectionTitleUnderline"}>
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
                    <div
                      key={auth.authId}
                      className={`typeCardButton ${isChecked ? "active" : ""}`}
                      onClick={() => {
                        if (isBusy) return;
                        handleAuthCheck(auth.authId, !isChecked);
                      }}
                      style={{
                        cursor: isBusy ? "not-allowed" : "pointer",
                      }}
                    >
                      <div className="cardText main">{auth.authNm}</div>
                      {auth.authDesc && (
                        <div className="cardText sub">{auth.authDesc}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            <div className="userAuthGroupDetails">
              {user.authGroups && user.authGroups.length > 0 ? (
                user.authGroups.map((group) => {
                  const rawMenus: MenuPermissionResponse[] = group.menuPermissions || [];

                  const parentMenus = rawMenus.filter((m) => m.menuId % 100 === 0);

                  const processedParents = parentMenus
                    .map((parent) => {
                      // 1. 하위 메뉴 중 READ(조회) 권한이 true인 항목만 필터링
                      const children = rawMenus.filter(
                        (m) =>
                          m.menuId > parent.menuId &&
                          m.menuId < parent.menuId + 100 &&
                          m.read === true
                      );

                      // 2. READ 가능한 소메뉴가 하나라도 있는 경우에만 유효한 대메뉴로 반환
                      if (children.length > 0) {
                        return {
                          ...parent,
                          children,
                        };
                      }
                      return null;
                    })
                    .filter(Boolean) as (MenuPermissionResponse & {
                      children: MenuPermissionResponse[];
                    })[];

                  const totalCount = processedParents.reduce((acc, parent) => {
                    return acc + (parent.children?.length || 0);
                  }, 0);

                  // true면 요약 상태 (알약 태그 표시), false면 전체 보기 상태 (상세 CRUD 닷 리스트)
                  const isCollapsed = collapsedMap[group.authId] ?? true;

                  return (
                    <div key={group.authId} className="authGroupCard">
                      {/* 권한 그룹 카드 헤더 */}
                      <div className="authGroupCardHeader">
                        <div className="authGroupCardHeaderLeft">
                          <h4 className="authGroupCardTitle">{group.authNm}</h4>
                          {group.authDesc && (
                            <p className="authGroupCardDesc">{group.authDesc}</p>
                          )}
                        </div>
                        <div className="authGroupCardHeaderRight">
                          <span className="totalMenuBadge">
                            총 {totalCount}개 메뉴
                          </span>
                          <button
                            type="button"
                            className="toggleViewBtn"
                            onClick={() => toggleCollapse(group.authId)}
                          >
                            {isCollapsed ? (
                              <>
                                <span>전체 메뉴 보기</span>
                                <ChevronDownIcon className="toggleIcon" aria-hidden="true" />
                              </>
                            ) : (
                              <>
                                <span>요약으로 보기</span>
                                <ChevronUpIcon className="toggleIcon" aria-hidden="true" />
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* 대메뉴별 서브 카드 그리드 */}
                      {processedParents.length > 0 ? (
                        <div className="categoryGrid">
                          {processedParents.map((parentMenu) => {
                            const childMenus = parentMenu.children || [];

                            return (
                              <div key={parentMenu.menuId} className="categorySubCard">
                                <div className="categorySubHeader">
                                  <span className="categorySubTitle">{parentMenu.menuNm}</span>
                                  {childMenus.length > 0 && (
                                    <span className="categorySubCount">{childMenus.length}개</span>
                                  )}
                                </div>

                                {isCollapsed ? (
                                  <div className="categoryMenuTags">
                                    {childMenus.length > 0 ? (
                                      childMenus.map((child) => (
                                        <span key={child.menuId} className="menuItemTag">
                                          {child.menuNm}
                                        </span>
                                      ))
                                    ) : (
                                      <span className="menuPermissionsEmpty">하위 메뉴 없음</span>
                                    )}
                                  </div>
                                ) : (
                                  <div className="menuPermList">
                                    {childMenus.length > 0 && (
                                      <div className="menuPermHeader">
                                        <span className="menuPermHeaderName" />
                                        <div className="menuPermHeaderLabels">
                                          {PERMISSION_FIELDS.map(({ key, label }) => (
                                            <span key={key} className="permHeaderLabel" title={label}>
                                              {label}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {childMenus.length > 0 ? (
                                      childMenus.map((node) => (
                                        <div key={node.menuId} className="menuPermRow">
                                          <span className="menuPermName">{node.menuNm}</span>
                                          <div className="menuPermDots">
                                            {PERMISSION_FIELDS.map(({ key, label }) => (
                                              <span
                                                key={key}
                                                className={`permDot ${
                                                  node[key] ? "permDot--on" : "permDot--off"
                                                }`}
                                                title={label}
                                              />
                                            ))}
                                          </div>
                                        </div>
                                      ))
                                    ) : (
                                      <span className="menuPermissionsEmpty">하위 메뉴 없음</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="menuPermissionsEmpty">
                          설정된 유효 메뉴 권한이 없습니다.
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="detailValue">-</div>
              )}
            </div>
          )}
        </div>
      </DetailLayout>
    </section>
  );
}