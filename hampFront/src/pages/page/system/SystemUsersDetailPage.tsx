import { Fragment, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { ChevronDownIcon, CheckIcon, MinusIcon } from "@heroicons/react/16/solid";
import { Badge } from "@components/common/Badge";
import { formatDateTime, isValidPhone } from "@/utils/common";
import type { UserDetailResponse, UserUpdateRequest } from "@/api/User";
import type { AuthGroupResponse } from "@/api/auth/Auth";
import type { MenuPermissionResponse } from "@/api/Menu";
import Spinner from "@/components/common/Spinner";
import { UserApi } from "@/api/User";
import { AuthGroupApi } from "@/api/auth/Auth";
import { DetailLayout, type DetailSection } from "@/pages/layout/DetailLayout";
import "./SystemUser.css";

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

type MenuNode = MenuPermissionResponse & { children: MenuPermissionResponse[] };
type UserAuthGroup = NonNullable<UserDetailResponse["authGroups"]>[number];

/** 대메뉴(menuId % 100 === 0) 아래에 조회 가능한 소메뉴만 묶어서 반환 */
function buildMenuTree(menus: MenuPermissionResponse[]): MenuNode[] {
  return menus
    .filter((m) => m.menuId % 100 === 0)
    .map((parent) => ({
      ...parent,
      children: menus.filter(
        (m) =>
          m.menuId > parent.menuId &&
          m.menuId < parent.menuId + 100 &&
          m.read === true
      ),
    }))
    .filter((parent) => parent.children.length > 0);
}

type AuthGroupCardProps = {
  group: UserAuthGroup;
  collapsed: boolean;
  onToggle: () => void;
};

/** 권한 그룹 1개의 메뉴 권한 현황 카드 (요약: 태그 / 상세: 권한 매트릭스) */
function AuthGroupCard({ group, collapsed, onToggle }: AuthGroupCardProps) {
  const tree = useMemo(
    () => buildMenuTree(group.menuPermissions ?? []),
    [group.menuPermissions]
  );
  const totalCount = tree.reduce((acc, p) => acc + p.children.length, 0);

  return (
    <article className="authCard">
      <header className="authCardHead">
        <div className="authCardTitleWrap">
          <h4 className="authCardTitle">{group.authNm}</h4>
          {group.authDesc && <p className="authCardDesc">{group.authDesc}</p>}
        </div>

        <div className="authCardActions">
          <span className="authCardCount">메뉴 {totalCount}개</span>
          <button
            type="button"
            className="authCardToggle"
            aria-expanded={!collapsed}
            onClick={onToggle}
          >
            {collapsed ? "권한 상세" : "요약"}
            <ChevronDownIcon aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="authCardBody">
        {tree.length === 0 ? (
          <p className="authCardEmpty">설정된 유효 메뉴 권한이 없습니다.</p>
        ) : collapsed ? (
          <div className="authCategoryGrid">
            {tree.map((parent) => (
              <div key={parent.menuId} className="authCategory">
                <div className="authCategoryHead">
                  <span>{parent.menuNm}</span>
                  <em>{parent.children.length}</em>
                </div>
                <div className="authTags">
                  {parent.children.map((child) => (
                    <span key={child.menuId} className="authTag">
                      {child.menuNm}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="permMatrix" role="table" aria-label={`${group.authNm} 메뉴 권한`}>
            <div className="permRow permRow--head" role="row">
              <span role="columnheader">메뉴</span>
              {PERMISSION_FIELDS.map(({ key, label }) => (
                <span key={key} role="columnheader" className="permCell">
                  {label}
                </span>
              ))}
            </div>

            {tree.map((parent) => (
              <Fragment key={parent.menuId}>
                <div className="permRow permRow--group" role="row">
                  <span role="rowheader">{parent.menuNm}</span>
                </div>

                {parent.children.map((node) => (
                  <div key={node.menuId} className="permRow" role="row">
                    <span className="permName" role="rowheader">
                      {node.menuNm}
                    </span>
                    {PERMISSION_FIELDS.map(({ key, label }) => (
                      <span key={key} className="permCell" role="cell">
                        {node[key] ? (
                          <CheckIcon
                            className="permMark permMark--on"
                            role="img"
                            aria-label={`${label} 가능`}
                          />
                        ) : (
                          <MinusIcon
                            className="permMark"
                            role="img"
                            aria-label={`${label} 불가`}
                          />
                        )}
                      </span>
                    ))}
                  </div>
                ))}
              </Fragment>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

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

  // authId별 접힘 상태 (기본값 true = 요약)
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
        { label: "직책", key: "position", editable: true },
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
        if (isMounted) setAuthGroups(response.data ?? []);
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
  const fetchUserDetail = async () => {
    if (!userId) return;
    setIsLoading(true);

    try {
      const encodedUserId = encodeURIComponent(userId);
      const response = await UserApi.getDetail(encodedUserId);
      const userData = response.data;

      if (userData) {
        setUser(userData);
        setForm({
          userId: userData.userId,
          userNm: userData.userNm || "",
          phone: userData.phone || "",
          position: userData.position || "",
          use: userData.use ? "Y" : "N",
          createdAt: formatDateTime(userData.createdAt),
        });
        setAuthIds(userData.authGroups?.map((g) => g.authId) || []);
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

  // 수정 모드를 빠져나오면 원본으로 롤백
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
    if (!isValidPhone(form.phone)) {
      alert("전화번호 형식이 올바르지 않습니다.\n예: 02-1234-5678, 010-1234-5678");
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

      await UserApi.update(encodeURIComponent(user.userId), updatePayload);

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
      await UserApi.delete(encodeURIComponent(user.userId));
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

  const toggleCollapse = (authId: string) => {
    setCollapsedMap((prev) => ({ ...prev, [authId]: !(prev[authId] ?? true) }));
  };

  if (isLoading) {
    return (
      <section className="screenStack">
        <div className="detailCard" aria-busy="true">
          <div className="flex justify-center p-10">
            <Spinner />
          </div>
        </div>
      </section>
    );
  }

  if (!user) return null;

  const goList = () =>
    navigate({ pathname: "/system/users", search: location.search });

  return (
    <section className="screenStack">
      <DetailLayout
        title={user.userNm}
        subtitle={
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span className="userIdText">{form.userId}</span>
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
                onClick={goList}
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
        <section className="detailSection">
          <div className="detailSectionHead">
            <h3 className="detailSectionTitle">
              권한 그룹
              {isEditing && (
                <span className="required" aria-hidden="true">
                  {" "}
                  *
                </span>
              )}
            </h3>
            <span className="detailSectionMeta">
              {isEditing
                ? `${authIds.length}개 선택`
                : `${user.authGroups?.length ?? 0}개`}
            </span>
          </div>

          {isEditing ? (
            isLoadingGroups ? (
              <p className="authGroupEmpty">권한 그룹 목록을 불러오는 중...</p>
            ) : authGroups.length === 0 ? (
              <p className="authGroupEmpty">선택 가능한 권한 그룹이 없습니다.</p>
            ) : (
              <div className="authPickGrid" role="group" aria-label="권한 그룹 선택">
                {authGroups.map((auth) => {
                  const checked = authIds.includes(auth.authId);
                  return (
                    <button
                      key={auth.authId}
                      type="button"
                      role="checkbox"
                      aria-checked={checked}
                      className={`authPick${checked ? " isChecked" : ""}`}
                      disabled={isBusy}
                      onClick={() => handleAuthCheck(auth.authId, !checked)}
                    >
                      <span className="authPickBox" aria-hidden="true">
                        {checked && <CheckIcon />}
                      </span>
                      <span className="authPickText">
                        <strong>{auth.authNm}</strong>
                        {auth.authDesc && <small>{auth.authDesc}</small>}
                      </span>
                    </button>
                  );
                })}
              </div>
            )
          ) : user.authGroups && user.authGroups.length > 0 ? (
            <div className="authCardList">
              {user.authGroups.map((group) => (
                <AuthGroupCard
                  key={group.authId}
                  group={group}
                  collapsed={collapsedMap[group.authId] ?? true}
                  onToggle={() => toggleCollapse(group.authId)}
                />
              ))}
            </div>
          ) : (
            <p className="authGroupEmpty">지정된 권한 그룹이 없습니다.</p>
          )}
        </section>
      </DetailLayout>
    </section>
  );
}