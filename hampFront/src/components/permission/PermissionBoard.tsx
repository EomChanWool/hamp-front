import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
    CheckIcon,
    MinusIcon,
    ChevronRightIcon,
    MagnifyingGlassIcon,
    XMarkIcon,
    ExclamationTriangleIcon,
} from "@heroicons/react/16/solid";
import axios from "axios";
import type {
    AuthGroupResponse,
    AuthGroupDetailResponse,
    AuthGroupUpdateRequest,
} from "@/api/auth/Auth";
import { AuthGroupApi } from "@/api/auth/Auth";
import type { MenuPermissionRequest, MenuResponse } from "@/api/Menu";
import { MenuApi } from "@/api/Menu";
import { usePermission, PERMISSIONS } from "@/hooks/usePermission";
import type { CheckState, PermRecord } from "@/hooks/usePermission";
import "./PermissonBoard.css";

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
    const [isDeleting, setIsDeleting] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    // 우측 상세 패널에 표시 중인 대메뉴 및 서브메뉴 펼침 상태
    const [activeTopMenuId, setActiveTopMenuId] = useState<number | null>(null);
    const [collapsedSub, setCollapsedSub] = useState<Record<number, boolean>>({});

    // usePermission 훅 연동
    const {
        permState,
        initializePerms,
        getCheckState,
        handleToggle,
        handleGroupPermToggle,
        dirtyMenuCount,
        isDirty,
        resetPerms,
        commitPerms,
    } = usePermission(menus);

    const [query, setQuery] = useState("");
    const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
    const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const showToast = useCallback((type: "success" | "error", message: string) => {
        if (toastTimer.current) clearTimeout(toastTimer.current);
        setToast({ type, message });
        toastTimer.current = setTimeout(() => setToast(null), 2600);
    }, []);

    // 1. 초기 데이터(권한 그룹 목록, 전체 메뉴) 로드
    useEffect(() => {
        let isMounted = true;
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [authRes, menuRes] = await Promise.all([
                    AuthGroupApi.getList(),
                    MenuApi.getList(),
                ]);

                if (!isMounted) return;

                const groups = authRes.data ?? [];
                if (groups.length > 0) {
                    setAuthGroups(groups);
                    setActiveAuthId((prev) => (prev && groups.some((g) => g.authId === prev) ? prev : groups[0].authId));
                } else {
                    setAuthGroups([]);
                    setActiveAuthId(null);
                    setGroupDetail(null);
                }

                const menuData = menuRes.data ?? [];
                if (menuData.length > 0) {
                    setMenus(menuData);
                    setActiveTopMenuId(menuData[0].menuId);
                }
            } catch (error) {
                console.error("데이터 초기화 실패:", error);
                if (isMounted) {
                    showToast("error", "메뉴/권한 그룹 정보를 불러오지 못했습니다.");
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        fetchData();
        return () => {
            isMounted = false;
        };
    }, [showToast]);

    // 2. 선택된 권한 그룹의 상세 정보 및 매트릭스 권한 상태 동기화
    useEffect(() => {
        if (!activeAuthId || menus.length === 0) return;

        let isMounted = true;
        const fetchGroupDetail = async () => {
            setIsLoading(true);
            setIsEditing(false);
            try {
                const response = await AuthGroupApi.getDetail(activeAuthId);
                if (!isMounted) return;

                const detail = response.data;
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

                    // 훅의 초기화 함수 호출
                    initializePerms(initialPerms);
                }
            } catch (error) {
                console.error("권한 그룹 상세 조회 실패:", error);
                if (isMounted) {
                    showToast("error", "권한 정보를 불러오지 못했습니다.");
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        fetchGroupDetail();
        return () => {
            isMounted = false;
        };
    }, [activeAuthId, menus, showToast, initializePerms]);

    const handleStartEdit = () => {
        setIsEditing(true);
    };

    const handleCancelEdit = () => {
        if (isDirty && !window.confirm("변경사항이 저장되지 않았습니다. 취소하시겠습니까?")) return;
        resetPerms();
        setIsEditing(false);
    };

    // 권한 그룹 삭제 핸들러 (AuthGroupApi 활용)
    const handleDelete = async () => {
        if (!activeAuthId || !groupDetail || isDeleting) return;

        const confirmMsg = `"${groupDetail.authNm}" 권한 그룹을 삭제하시겠습니까?\n(이 권한 그룹을 사용 중인 회원이 없을 때만 삭제 가능합니다.)`;
        if (!window.confirm(confirmMsg)) return;

        setIsDeleting(true);
        try {
            await AuthGroupApi.delete(activeAuthId);
            showToast("success", "권한 그룹이 삭제되었습니다.");

            // 삭제된 그룹을 제외하고 목록 재설정 및 첫 번째 그룹 활성화
            const updatedGroups = authGroups.filter((g) => g.authId !== activeAuthId);
            setAuthGroups(updatedGroups);

            if (updatedGroups.length > 0) {
                setActiveAuthId(updatedGroups[0].authId);
            } else {
                setActiveAuthId(null);
                setGroupDetail(null);
            }
        } catch (error) {
            console.error("권한 그룹 삭제 실패:", error);
            const msg = axios.isAxiosError(error) ? error.response?.data?.message : null;
            showToast("error", msg || "삭제에 실패했습니다. (사용 중인 회원이 있는지 확인해주세요)");
        } finally {
            setIsDeleting(false);
        }
    };

    const toggleSubCollapse = (menuId: number) => {
        setCollapsedSub((prev) => {
            const currentVal = prev[menuId] ?? true;
            return { ...prev, [menuId]: !currentVal };
        });
    };

    const handleTopMenuSelect = (menuId: number) => {
        if (menuId === activeTopMenuId) return;
        setActiveTopMenuId(menuId);
    };

    // 권한 설정 저장 핸들러 (AuthGroupApi 활용)
    const handleSave = async () => {
        if (!groupDetail || isSaving || !isDirty) return;

        const flattenMenus = (menuList: MenuResponse[]): MenuResponse[] =>
            menuList.reduce<MenuResponse[]>((acc, menu) => {
                acc.push(menu);
                if (menu.children && menu.children.length > 0) {
                    acc.push(...flattenMenus(menu.children));
                }
                return acc;
            }, []);

        const allMenus = flattenMenus(menus);
        const permManagementMenus = allMenus.filter(
            (m) => m.menuNm.includes("권한관리") || m.menuNm.includes("사용자 권한")
        );

        const isRevokingAuthMgmtUpdate = permManagementMenus.some((menu) => {
            const currentPerm = permState[menu.menuId];
            const initialPerm = groupDetail.menuPermissions?.find(
                (p) => p.menuId === menu.menuId
            );
            return initialPerm?.update === true && currentPerm?.update === false;
        });

        if (isRevokingAuthMgmtUpdate) {
            const confirmRevoke = window.confirm(
                "사용자 권한관리 메뉴의 수정 권한을 해제하려고 합니다.\n" +
                "저장할 경우 더 이상 이 페이지에서 권한을 수정할 수 없게 됩니다.\n\n정말 변경하시겠습니까?"
            );
            if (!confirmRevoke) return;
        }

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

            await AuthGroupApi.update(groupDetail.authId, updatePayload);
            showToast("success", "권한 설정이 저장되었습니다.");

            commitPerms();
            setIsEditing(false);
        } catch (error) {
            console.error("권한 수정 실패:", error);
            const msg = axios.isAxiosError(error) ? error.response?.data?.message : null;
            showToast("error", msg || "저장에 실패했습니다.");
        } finally {
            setIsSaving(false);
        }
    };

    /* ── 검색 필터 트리 가공 ── */
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

    const visibleTopMenus = useMemo(
        () => (isSearching ? filterTree(menus) : menus),
        [isSearching, filterTree, menus]
    );

    useEffect(() => {
        if (visibleTopMenus.length === 0) return;
        if (!visibleTopMenus.some((m) => m.menuId === activeTopMenuId)) {
            setActiveTopMenuId(visibleTopMenus[0].menuId);
        }
    }, [visibleTopMenus, activeTopMenuId]);

    const activeTopMenu = visibleTopMenus.find((m) => m.menuId === activeTopMenuId) ?? null;
    const activeRole = authGroups.find((g) => g.authId === activeAuthId);

    /* ── 하위 트리 렌더링 ── */
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
                            <span className="permTabUserCount" style={{ fontSize: "0.85em", opacity: 0.8 }}>
                                ({role.userCount ?? 0}명)
                            </span>
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
                            <>
                                <button type="button" className="primaryButton" onClick={handleStartEdit} disabled={!groupDetail}>
                                    수정
                                </button>
                                <button
                                    type="button"
                                    className="dangerButton"
                                    onClick={handleDelete}
                                    disabled={!groupDetail || isDeleting}
                                >
                                    {isDeleting ? "삭제 중..." : "삭제"}
                                </button>
                            </>
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