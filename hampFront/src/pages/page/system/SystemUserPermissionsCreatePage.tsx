import { useEffect, useState, useMemo, useCallback, type SyntheticEvent } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { ChevronRightIcon, ExclamationTriangleIcon, CheckIcon } from "@heroicons/react/16/solid";
import type { MenuResponse } from "@/api/Menu";
import { MenuApi } from "@/api/Menu";
import { AuthGroupApi } from "@/api/auth/Auth";
import type { AuthGroupCreateRequest } from "@/api/auth/Auth";
import { usePermission, PERMISSIONS } from "@/hooks/usePermission";
import type { CheckState, PermRecord } from "@/hooks/usePermission";
import "@components/permission/PermissonBoard.css";

/* ================================
    권한 토글 스위치 (checked / unchecked / mixed)
================================ */
function PermToggle({
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
            role="switch"
            aria-checked={state === "checked"}
            aria-label={label}
            disabled={disabled}
            className={`permToggle ${state}`}
            onClick={(e) => {
                e.stopPropagation();
                onToggle();
            }}
        >
            <span className="permToggleKnob" />
        </button>
    );
}

export function SystemUserPermissionsCreatePage() {
    const navigate = useNavigate();
    const location = useLocation();

    const [menus, setMenus] = useState<MenuResponse[]>([]);
    const [isLoadingMenus, setIsLoadingMenus] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // 권한 그룹 기본 정보
    const [form, setForm] = useState({
        authId: "",
        authNm: "",
        authDesc: "",
    });

    // 우측 상세 패널 대메뉴 및 서브메뉴 펼침 상태
    const [activeTopMenuId, setActiveTopMenuId] = useState<number | null>(null);
    const [collapsedSub, setCollapsedSub] = useState<Record<number, boolean>>({});

    // usePermission 훅 연동
    const {
        permState,
        initializePerms,
        getCheckState,
        handleToggle,
    } = usePermission(menus);

    const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

    const showToast = useCallback((type: "success" | "error", message: string) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 2600);
    }, []);

    // 1. 전체 메뉴 목록 조회 및 초기화 (의존성 배열 문제 해결)
    useEffect(() => {
        let isMounted = true;
        const loadMenus = async () => {
            setIsLoadingMenus(true);
            try {
                const response = await MenuApi.getList();
                if (!isMounted) return;

                const menuData = response.data ?? [];
                setMenus(menuData);
                if (menuData.length > 0) {
                    setActiveTopMenuId(menuData[0].menuId);
                }

                // 생성 페이지 초기 권한 설정
                const initialPerms: Record<number, PermRecord> = {};
                const flattenMenus = (list: MenuResponse[]): MenuResponse[] =>
                    list.reduce<MenuResponse[]>((acc, menu) => {
                        acc.push(menu);
                        if (menu.children && menu.children.length > 0) {
                            acc.push(...flattenMenus(menu.children));
                        }
                        return acc;
                    }, []);

                flattenMenus(menuData).forEach((menu) => {
                    initialPerms[menu.menuId] = {
                        read: false,
                        create: false,
                        update: false,
                        delete: false,
                        approve: false,
                    };
                });
                initializePerms(initialPerms);
            } catch (error) {
                console.error("메뉴 목록 조회 실패:", error);
                showToast("error", "메뉴 정보를 불러오지 못했습니다.");
            } finally {
                if (isMounted) setIsLoadingMenus(false);
            }
        };

        loadMenus();
        return () => {
            isMounted = false;
        };
    }, []);

    const handleFormChange = (key: string, value: string) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const toggleSubCollapse = (menuId: number) => {
        setCollapsedSub((prev) => ({
            ...prev,
            [menuId]: !(prev[menuId] ?? true),
        }));
    };

    const activeTopMenu = useMemo(
        () => menus.find((m) => m.menuId === activeTopMenuId) ?? null,
        [menus, activeTopMenuId]
    );

    /* ── 하위 트리 렌더링 ── */
    const renderSubTree = useCallback(
        (menuList: MenuResponse[], depth = 1) => (
            <div className="permSubChildren" style={{ ["--depth" as string]: depth }}>
                {menuList.map((menu) => {
                    const hasChildren = menu.children && menu.children.length > 0;
                    const isCollapsed = collapsedSub[menu.menuId] ?? true;

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
                                            <PermToggle
                                                state={
                                                    hasChildren
                                                        ? getCheckState(menu, p.key)
                                                        : permState[menu.menuId]?.[p.key]
                                                        ? "checked"
                                                        : "unchecked"
                                                }
                                                disabled={isSubmitting}
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
        ),
        [collapsedSub, getCheckState, handleToggle, permState, isSubmitting]
    );

    const validateForm = (): boolean => {
        if (!form.authId.trim()) {
            alert("권한 그룹 ID를 입력해주세요.");
            return false;
        }
        if (!form.authNm.trim()) {
            alert("권한 그룹명을 입력해주세요.");
            return false;
        }
        return true;
    };

    // 2. 권한 그룹 생성 처리
    const handleSubmit = async (e: SyntheticEvent) => {
        e.preventDefault();
        if (!validateForm()) return;

        const menuPermissions = Object.entries(permState).map(([menuIdStr, perms]) => ({
            menuId: Number(menuIdStr),
            read: perms.read ?? false,
            create: perms.create ?? false,
            update: perms.update ?? false,
            delete: perms.delete ?? false,
            approve: perms.approve ?? false,
        }));

        const payload: AuthGroupCreateRequest = {
            authId: form.authId.trim(),
            authNm: form.authNm.trim(),
            authDesc: form.authDesc.trim(),
            menuPermissions,
        };

        setIsSubmitting(true);
        try {
            await AuthGroupApi.create(payload);
            alert("권한 그룹이 성공적으로 생성되었습니다.");
            navigate({
                pathname: "/system/auths",
                search: location.search,
            });
        } catch (error) {
            console.error("권한 그룹 생성 실패:", error);
            const message = axios.isAxiosError(error) ? error.response?.data?.message : null;
            alert(message || "권한 그룹 생성 중 오류가 발생했습니다.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCancel = () => {
        navigate({
            pathname: "/system/auths",
            search: location.search,
        });
    };

    return (
        <section className="screenStack">
            {toast && (
                <div className={`permToast ${toast.type}`} role="status">
                    {toast.type === "error" && <ExclamationTriangleIcon />}
                    {toast.type === "success" && <CheckIcon />}
                    <span>{toast.message}</span>
                </div>
            )}

            <div className="createCard">
                <div className="createHeader">
                    <h1 className="createTitle">신규 권한 그룹 등록</h1>
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
                                        권한 그룹 ID <span className="required">*</span>
                                    </label>
                                    <input
                                        className="tableInput"
                                        value={form.authId}
                                        disabled={isSubmitting}
                                        onChange={(e) => handleFormChange("authId", e.target.value)}
                                        placeholder="예: ADMIN"
                                    />
                                </div>

                                <div className="createField">
                                    <label className="requiredLabel">
                                        권한 그룹명 <span className="required">*</span>
                                    </label>
                                    <input
                                        className="tableInput"
                                        value={form.authNm}
                                        disabled={isSubmitting}
                                        onChange={(e) => handleFormChange("authNm", e.target.value)}
                                        placeholder="예: 시스템 관리자"
                                    />
                                </div>

                                <div className="createField fullWidth">
                                    <label>설명</label>
                                    <textarea
                                        className="tableInput"
                                        rows={3}
                                        value={form.authDesc}
                                        disabled={isSubmitting}
                                        onChange={(e) => handleFormChange("authDesc", e.target.value)}
                                        placeholder="권한 그룹에 대한 설명 입력"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 2. 메뉴별 권한 설정 섹션 */}
                        <div className="createSection">
                            <h2 className="createSectionTitle">
                                메뉴별 권한 설정 <span className="required">*</span>
                            </h2>

                            {isLoadingMenus ? (
                                <div className="authGroupEmpty">메뉴 구조 로딩 중...</div>
                            ) : (
                                <div className="permissionBoard" style={{ padding: 0, background: "transparent" }}>
                                    <div className="permMatrixPanel" style={{ marginTop: "0" }}>
                                        <div className="permMatrixBody">
                                            {/* 좌측 대메뉴 세로 탭 */}
                                            <nav className="permMenuNav" aria-label="대메뉴">
                                                {menus.map((topMenu) => {
                                                    const isActive = topMenu.menuId === activeTopMenuId;
                                                    return (
                                                        <button
                                                            key={topMenu.menuId}
                                                            type="button"
                                                            className={`permMenuNavItem ${isActive ? "active" : ""}`}
                                                            onClick={() => setActiveTopMenuId(topMenu.menuId)}
                                                        >
                                                            <span className="permMenuNavLabel">{topMenu.menuNm}</span>
                                                            {topMenu.children && topMenu.children.length > 0 && (
                                                                <span className="permMenuNavCount">{topMenu.children.length}</span>
                                                            )}
                                                            <ChevronRightIcon className="permMenuNavArrow" />
                                                        </button>
                                                    );
                                                })}
                                            </nav>

                                            {/* 우측 서브메뉴 매트릭스 */}
                                            <div className="permMenuDetail">
                                                {!activeTopMenu ? (
                                                    <div className="permDetailEmpty">좌측에서 메뉴를 선택하세요.</div>
                                                ) : (
                                                    <>
                                                        {/* 컬럼 라벨만 표시 — 열 단위 일괄 토글은 제공하지 않음 */}
                                                        <div className="permMatrixHeader">
                                                            <span className="permMatrixHeaderLabel">{activeTopMenu.menuNm}</span>
                                                            <div className="permCheckGroup">
                                                                {PERMISSIONS.map((p) => (
                                                                    <div key={p.key} className="permCheckCell permCheckCellHeader">
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
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="createFooter">
                        <button type="button" className="ghostButton" onClick={handleCancel} disabled={isSubmitting}>
                            취소
                        </button>
                        <button type="submit" className="primaryButton" disabled={isSubmitting}>
                            {isSubmitting ? "생성 중..." : "생성"}
                        </button>
                    </div>
                </form>
            </div>
        </section>
    );
}
