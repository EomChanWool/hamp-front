import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  CheckIcon,
  MinusIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/16/solid";
import { apiClient } from "@/api/apiClient";
import axios from "axios";
import type {
  AuthGroupResponse,
  AuthGroupDetailResponse,
  ApiResponseListAuthGroupResponse,
  ApiResponseAuthGroupDetailResponse,
  AuthGroupUpdateRequest,
} from "@/types/auth/Auth";
import type { MenuPermissionRequest, MenuResponse, ApiResponseListMenuResponse } from "@/types/Menu";
import "./PermissonBoard.css";

const PERMISSIONS = [
  { label: "조회", key: "read" },
  { label: "등록", key: "create" },
  { label: "수정", key: "update" },
  { label: "삭제", key: "delete" },
  { label: "승인", key: "approve" },
] as const;

type PermKey = (typeof PERMISSIONS)[number]["key"];
type PermRecord = Record<PermKey, boolean>;
type CheckState = "checked" | "unchecked" | "mixed";

const EMPTY_PERM: PermRecord = {
  read: false,
  create: false,
  update: false,
  delete: false,
  approve: false,
};

/* ================================
   접근성 체크박스 (3-state: checked / unchecked / mixed)
================================ */
function PermCheckbox({
  state,
  disabled,
  onToggle,
  label,
}: {
  state: CheckState;
  disabled?: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={state === "mixed" ? "mixed" : state === "checked"}
      aria-label={label}
      disabled={disabled}
      className={`permCheck ${state}`}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
    >
      {state === "checked" && <CheckIcon />}
      {state === "mixed" && <MinusIcon />}
    </button>
  );
}

export function PermissionBoard() {
  const [authGroups, setAuthGroups] = useState<AuthGroupResponse[]>([]);
  const [activeAuthId, setActiveAuthId] = useState<string | null>(null);
  const [groupDetail, setGroupDetail] = useState<AuthGroupDetailResponse | null>(null);

  const [menus, setMenus] = useState<MenuResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // 우측 상세 패널에 표시 중인 대메뉴
  const [activeTopMenuId, setActiveTopMenuId] = useState<number | null>(null);
  // 서브메뉴 내부의 손자 트리(자식이 또 있는 항목) 펼침 상태 - 기본 접힘
  const [collapsedSub, setCollapsedSub] = useState<Record<number, boolean>>({});

  const [permState, setPermState] = useState<Record<number, PermRecord>>({});
  const [originalPermState, setOriginalPermState] = useState<Record<number, PermRecord>>({});

  const [query, setQuery] = useState("");
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((type: "success" | "error", message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ type, message });
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [authRes, menuRes] = await Promise.all([
          apiClient.get<ApiResponseListAuthGroupResponse>("/auth-groups"),
          apiClient.get<ApiResponseListMenuResponse>("/menus"),
        ]);

        const groups = authRes.data.data;
        if (groups && groups.length > 0) {
          setAuthGroups(groups);
          setActiveAuthId(groups[0].authId);
        }

        if (menuRes.data.data) {
          setMenus(menuRes.data.data);
          if (menuRes.data.data.length > 0) {
            setActiveTopMenuId(menuRes.data.data[0].menuId);
          }
        }
      } catch (error) {
        console.error("데이터 초기화 실패:", error);
        showToast("error", "메뉴/권한 그룹 정보를 불러오지 못했습니다.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeAuthId || menus.length === 0) return;

    const fetchGroupDetail = async () => {
      setIsLoading(true);
      setIsEditing(false);
      try {
        const response = await apiClient.get<ApiResponseAuthGroupDetailResponse>(`/auth-groups/${activeAuthId}`);
        const detail = response.data.data;
        if (detail) {
          setGroupDetail(detail);

          const initialPerms: Record<number, PermRecord> = {};

          const flattenMenus = (menuList: MenuResponse[]): MenuResponse[] =>
            menuList.reduce<MenuResponse[]>((acc, menu) => {
              acc.push(menu);
              if (menu.children && menu.children.length > 0) {
                acc.push(...flattenMenus(menu.children));
              }
              return acc;
            }, []);

          const allMenus = flattenMenus(menus);

          allMenus.forEach((menu) => {
            const found = detail.menuPermissions?.find((p) => p.menuId === menu.menuId);
            initialPerms[menu.menuId] = {
              read: found?.read ?? false,
              create: found?.create ?? false,
              update: found?.update ?? false,
              delete: found?.delete ?? false,
              approve: found?.approve ?? false,
            };
          });
          setPermState(initialPerms);
          setOriginalPermState(initialPerms);
        }
      } catch (error) {
        console.error("권한 그룹 상세 조회 실패:", error);
        showToast("error", "권한 정보를 불러오지 못했습니다.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchGroupDetail();
  }, [activeAuthId, menus, showToast]);

  /* ── 트리 유틸 ── */
  const findMenuNode = (list: MenuResponse[], id: number): MenuResponse | null => {
    for (const m of list) {
      if (m.menuId === id) return m;
      if (m.children && m.children.length > 0) {
        const found = findMenuNode(m.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  const getAllDescendantIds = (menu: MenuResponse): number[] => {
    let ids: number[] = [menu.menuId];
    if (menu.children) {
      for (const child of menu.children) {
        ids.push(...getAllDescendantIds(child));
      }
    }
    return ids;
  };

  const getCheckState = useCallback(
    (menu: MenuResponse, permKey: PermKey): CheckState => {
      const ids = getAllDescendantIds(menu);
      if (ids.length === 0) return "unchecked";
      const checkedCount = ids.filter((id) => permState[id]?.[permKey]).length;
      if (checkedCount === 0) return "unchecked";
      if (checkedCount === ids.length) return "checked";
      return "mixed";
    },
    [permState]
  );

  const handleToggle = (menuId: number, permKey: PermKey) => {
    if (!isEditing) return;

    const targetMenu = findMenuNode(menus, menuId);
    if (!targetMenu) return;

    const descendantIds = getAllDescendantIds(targetMenu);
    const currentValue = permState[menuId]?.[permKey] ?? false;
    const newValue = !currentValue;

    setPermState((prev) => {
      const next = { ...prev };
      descendantIds.forEach((id) => {
        next[id] = { ...(next[id] || EMPTY_PERM), [permKey]: newValue };
      });
      return next;
    });
  };

  const handleGroupPermToggle = (menu: MenuResponse, permKey: PermKey) => {
    if (!isEditing) return;
    const ids = getAllDescendantIds(menu);
    const allChecked = ids.every((id) => permState[id]?.[permKey]);
    const newValue = !allChecked;

    setPermState((prev) => {
      const next = { ...prev };
      ids.forEach((id) => {
        next[id] = { ...(next[id] || EMPTY_PERM), [permKey]: newValue };
      });
      return next;
    });
  };

  /* ── 변경사항 추적 ── */
  const dirtyMenuCount = useMemo(() => {
    let count = 0;
    const ids = new Set([...Object.keys(permState), ...Object.keys(originalPermState)]);
    ids.forEach((idStr) => {
      const id = Number(idStr);
      const a = permState[id] || EMPTY_PERM;
      const b = originalPermState[id] || EMPTY_PERM;
      if (PERMISSIONS.some((p) => a[p.key] !== b[p.key])) count += 1;
    });
    return count;
  }, [permState, originalPermState]);

  const isDirty = dirtyMenuCount > 0;

  const handleStartEdit = () => {
    setOriginalPermState(JSON.parse(JSON.stringify(permState)));
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    if (isDirty && !window.confirm("변경사항이 저장되지 않았습니다. 취소하시겠습니까?")) return;
    setPermState(JSON.parse(JSON.stringify(originalPermState)));
    setIsEditing(false);
  };

  const toggleSubCollapse = (menuId: number) => {
    setCollapsedSub((prev) => {
      const currentVal = prev[menuId] ?? true;
      return { ...prev, [menuId]: !currentVal };
    });
  };

  // 대메뉴 전환: 수정 중 변경사항이 있으면 이동을 막고 저장/취소부터 하도록 안내.
  // 편집 모드였지만 실제 변경사항이 없었다면 조용히 초기화하고 이동.
  const handleTopMenuSelect = (menuId: number) => {
    if (menuId === activeTopMenuId) return;

    if (isEditing) {
      if (isDirty) {
        window.alert("변경사항이 저장되지 않았습니다. 먼저 저장하거나 취소해주세요.");
        return;
      }
      setPermState(JSON.parse(JSON.stringify(originalPermState)));
      setIsEditing(false);
    }

    setActiveTopMenuId(menuId);
  };

  const handleSave = async () => {
    if (!groupDetail || isSaving || !isDirty) return;

    setIsSaving(true);
    try {
      const menuPermissions: MenuPermissionRequest[] = Object.entries(permState).map(([menuIdStr, perms]) => ({
        menuId: Number(menuIdStr),
        read: perms.read ?? false,
        create: perms.create ?? false,
        update: perms.update ?? false,
        delete: perms.delete ?? false,
        approve: perms.approve ?? false,
      }));

      const updatePayload: AuthGroupUpdateRequest = {
        authNm: groupDetail.authNm,
        authDesc: groupDetail.authDesc,
        menuPermissions,
      };

      await apiClient.put(`/auth-groups/${groupDetail.authId}`, updatePayload);
      showToast("success", "권한 설정이 저장되었습니다.");

      setOriginalPermState(JSON.parse(JSON.stringify(permState)));
      setIsEditing(false);
    } catch (error) {
      console.error("권한 수정 실패:", error);
      const msg = axios.isAxiosError(error) ? error.response?.data?.message : null;
      showToast("error", msg || "저장에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  /* ── 검색 필터: 이름이 일치하거나 하위에 일치 항목이 있으면 유지 ── */
  const normalizedQuery = query.trim().toLowerCase();
  const isSearching = normalizedQuery.length > 0;

  const filterTree = useCallback(
    (list: MenuResponse[]): MenuResponse[] =>
      list.reduce<MenuResponse[]>((acc, menu) => {
        const selfMatch = menu.menuNm.toLowerCase().includes(normalizedQuery);
        const filteredChildren = menu.children ? filterTree(menu.children) : [];
        if (selfMatch || filteredChildren.length > 0) {
          acc.push({ ...menu, children: filteredChildren.length > 0 ? filteredChildren : menu.children });
        }
        return acc;
      }, []),
    [normalizedQuery]
  );

  // 좌측 대메뉴 탭 목록 (검색 시 매칭되는 대메뉴만)
  const visibleTopMenus = useMemo(
    () => (isSearching ? filterTree(menus) : menus),
    [isSearching, filterTree, menus]
  );

  // 검색 결과에 현재 선택된 대메뉴가 더 이상 없으면 첫 번째 매칭 항목으로 이동
  useEffect(() => {
    if (visibleTopMenus.length === 0) return;
    if (!visibleTopMenus.some((m) => m.menuId === activeTopMenuId)) {
      setActiveTopMenuId(visibleTopMenus[0].menuId);
    }
  }, [visibleTopMenus, activeTopMenuId]);

  const activeTopMenu = visibleTopMenus.find((m) => m.menuId === activeTopMenuId) ?? null;
  const activeRole = authGroups.find((g) => g.authId === activeAuthId);

  /* ── 하위 트리 렌더링 (depth 기반 인덴트 가이드 포함) ── */
  const renderSubTree = (menuList: MenuResponse[], depth = 1) => (
    <div className="permSubChildren" style={{ ["--depth" as string]: depth }}>
      {menuList.map((menu) => {
        const hasChildren = menu.children && menu.children.length > 0;
        const isCollapsed = isSearching ? false : collapsedSub[menu.menuId] ?? true;

        return (
          <div key={menu.menuId} className="permSubNode">
            <div className="permSubRow">
              <span
                className="permSubLabel"
                onClick={() => hasChildren && toggleSubCollapse(menu.menuId)}
                style={{ cursor: hasChildren ? "pointer" : "default" }}
              >
                {hasChildren ? (
                  <ChevronRightIcon className={`permSubToggleIcon ${!isCollapsed ? "open" : ""}`} />
                ) : (
                  <span className="permSubDot" />
                )}
                {menu.menuNm}
              </span>

              <div className="permCheckGroup">
                {PERMISSIONS.map((p) => (
                  <div key={p.key} className="permCheckCell">
                    <PermCheckbox
                      state={
                        hasChildren
                          ? getCheckState(menu, p.key)
                          : permState[menu.menuId]?.[p.key]
                          ? "checked"
                          : "unchecked"
                      }
                      disabled={!isEditing}
                      onToggle={() => handleToggle(menu.menuId, p.key)}
                      label={`${menu.menuNm} ${p.label} 권한`}
                    />
                  </div>
                ))}
              </div>
            </div>

            {hasChildren && !isCollapsed && renderSubTree(menu.children!, depth + 1)}
          </div>
        );
      })}
    </div>
  );

  return (
    <section className="permissionBoard">
      {toast && (
        <div className={`permToast ${toast.type}`} role="status">
          {toast.type === "error" && <ExclamationTriangleIcon />}
          {toast.type === "success" && <CheckIcon />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* 역할 탭: 상단 가로 배치 */}
      <div className="permissionTabsRow">
        <div className="permissionTabsBox" role="tablist" aria-label="권한 그룹">
          {authGroups.map((role) => (
            <button
              key={role.authId}
              type="button"
              role="tab"
              aria-selected={role.authId === activeAuthId}
              className={`permissionTab ${role.authId === activeAuthId ? "active" : ""}`}
              onClick={() => setActiveAuthId(role.authId)}
              disabled={isEditing && role.authId !== activeAuthId}
            >
              <span>{role.authNm}</span>
              {role.authId === activeAuthId && isDirty && <span className="permTabDirtyDot" aria-hidden />}
            </button>
          ))}
          {authGroups.length === 0 && !isLoading && (
            <p className="permissionTabsEmpty">등록된 권한 그룹이 없습니다.</p>
          )}
        </div>
        <p className="permissionDesc">
          {groupDetail?.authDesc || activeRole?.authDesc || "권한 그룹 설명이 없습니다."}
        </p>
      </div>

      {/* 대메뉴(좌측 세로 탭) + 서브메뉴(우측 상세) */}
      <div className="permMatrixPanel">
        <div className="permMatrixToolbar">
          <div className="permSearchBox">
            <MagnifyingGlassIcon className="permSearchIcon" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="메뉴 검색"
              aria-label="메뉴 검색"
            />
            {query && (
              <button type="button" className="permSearchClear" onClick={() => setQuery("")} aria-label="검색어 지우기">
                <XMarkIcon />
              </button>
            )}
          </div>
          {isEditing && (
            <span className={`permDirtyBadge ${isDirty ? "active" : ""}`}>
              {isDirty ? `${dirtyMenuCount}개 항목 변경됨` : "변경사항 없음"}
            </span>
          )}
          <div className="permBoardActions">
            {isEditing ? (
              <>
                <button type="button" className="ghostButton" onClick={handleCancelEdit} disabled={isSaving}>
                  취소
                </button>
                <button type="button" className="primaryButton" onClick={handleSave} disabled={isSaving || !isDirty}>
                  {isSaving ? "저장 중..." : "저장"}
                </button>
              </>
            ) : (
              <button type="button" className="primaryButton" onClick={handleStartEdit} disabled={!groupDetail}>
                수정
              </button>
            )}
          </div>
        </div>

        <div className="permMatrixBody">
          {/* 대메뉴 좌측 세로 탭 */}
          <nav className="permMenuNav" aria-label="대메뉴">
            {isLoading && menus.length === 0 ? (
              <div className="permNavSkeleton">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="permNavSkeletonRow" />
                ))}
              </div>
            ) : visibleTopMenus.length === 0 ? (
              <p className="permNavEmpty">{isSearching ? "일치하는 메뉴 없음" : "메뉴 없음"}</p>
            ) : (
              visibleTopMenus.map((topMenu) => {
                const isActive = topMenu.menuId === activeTopMenuId;
                return (
                  <button
                    key={topMenu.menuId}
                    type="button"
                    className={`permMenuNavItem ${isActive ? "active" : ""}`}
                    onClick={() => handleTopMenuSelect(topMenu.menuId)}
                  >
                    <span className="permMenuNavLabel">{topMenu.menuNm}</span>
                    {topMenu.children && topMenu.children.length > 0 && (
                      <span className="permMenuNavCount">{topMenu.children.length}</span>
                    )}
                    <ChevronRightIcon className="permMenuNavArrow" />
                  </button>
                );
              })
            )}
          </nav>

          {/* 선택된 대메뉴의 서브메뉴 매트릭스 */}
          <div className="permMenuDetail">
            {!activeTopMenu ? (
              <div className="permDetailEmpty">좌측에서 메뉴를 선택하세요.</div>
            ) : (
              <>
                <div className="permMatrixHeader">
                  <span className="permMatrixHeaderLabel">{activeTopMenu.menuNm}</span>
                  <div className="permCheckGroup">
                    {PERMISSIONS.map((p) => (
                      <div key={p.key} className="permCheckCell permCheckCellHeader">
                        <PermCheckbox
                          state={getCheckState(activeTopMenu, p.key)}
                          disabled={!isEditing}
                          onToggle={() => handleGroupPermToggle(activeTopMenu, p.key)}
                          label={`${activeTopMenu.menuNm} 전체 ${p.label} 권한`}
                        />
                        <span>{p.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="permGroupListScroll">
                  {activeTopMenu.children && activeTopMenu.children.length > 0 ? (
                    renderSubTree(activeTopMenu.children, 1)
                  ) : (
                    <div className="permEmptyState">하위 메뉴가 없습니다.</div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}