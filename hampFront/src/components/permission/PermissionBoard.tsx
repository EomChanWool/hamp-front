import { useEffect, useState } from 'react';
import { CheckIcon } from '@heroicons/react/16/solid';
import { apiClient } from '@/api/apiClient';
import axios from 'axios';
import type {
  AuthGroupResponse,
  AuthGroupDetailResponse,
  ApiResponseListAuthGroupResponse,
  ApiResponseAuthGroupDetailResponse,
  AuthGroupUpdateRequest,
} from '@/types/auth/Auth';
import type { MenuPermissionRequest, MenuResponse, ApiResponseListMenuResponse } from '@/types/Menu';

const PERMISSIONS = [
  { label: '조회', key: 'read' },
  { label: '등록', key: 'create' },
  { label: '수정', key: 'update' },
  { label: '삭제', key: 'delete' },
  { label: '승인', key: 'approve' },
] as const;

export function PermissionBoard() {
  const [authGroups, setAuthGroups] = useState<AuthGroupResponse[]>([]);
  const [activeAuthId, setActiveAuthId] = useState<string | null>(null);
  const [groupDetail, setGroupDetail] = useState<AuthGroupDetailResponse | null>(null);
  
  const [menus, setMenus] = useState<MenuResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // 대메뉴별 접기/펼치기 상태 관리
  const [collapsedGroups, setCollapsedGroups] = useState<Record<number, boolean>>({});

  // 메뉴별 권한 상태 매트릭스
  const [permState, setPermState] = useState<Record<number, Record<string, boolean>>>({});
  const [originalPermState, setOriginalPermState] = useState<Record<number, Record<string, boolean>>>({});

  // 1. 전체 메뉴 목록 및 권한 그룹 목록 조회
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [authRes, menuRes] = await Promise.all([
          apiClient.get<ApiResponseListAuthGroupResponse>('/auth-groups'),
          apiClient.get<ApiResponseListMenuResponse>('/menus'),
        ]);

        const groups = authRes.data.data;
        if (groups && groups.length > 0) {
          setAuthGroups(groups);
          setActiveAuthId(groups[0].authId);
        }

        if (menuRes.data.data) {
          setMenus(menuRes.data.data);
        }
      } catch (error) {
        console.error("데이터 초기화 실패:", error);
      }
    };

    fetchData();
  }, []);

  // 2. 선택된 권한 그룹 변경 시 상세 정보 및 메뉴 권한 조회
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

          const initialPerms: Record<number, Record<string, boolean>> = {};
          
          const flattenMenus = (menuList: MenuResponse[]): MenuResponse[] => {
            return menuList.reduce<MenuResponse[]>((acc, menu) => {
              acc.push(menu);
              if (menu.children && menu.children.length > 0) {
                acc.push(...flattenMenus(menu.children));
              }
              return acc;
            }, []);
          };

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
      } finally {
        setIsLoading(false);
      }
    };

    fetchGroupDetail();
  }, [activeAuthId, menus]);

  // 특정 메뉴 노드를 찾는 재귀함수
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

  // 자신과 모든 하위 메뉴들의 ID를 수집하는 함수
  const getAllDescendantIds = (menu: MenuResponse): number[] => {
    let ids: number[] = [menu.menuId];
    if (menu.children) {
      for (const child of menu.children) {
        ids.push(...getAllDescendantIds(child));
      }
    }
    return ids;
  };

  // 체크박스 토글 핸들러 (대메뉴 체크 시 하위 메뉴 동기화)
  const handleToggle = (menuId: number, permKey: string) => {
    if (!isEditing) return;

    const targetMenu = findMenuNode(menus, menuId);
    if (!targetMenu) return;

    const descendantIds = getAllDescendantIds(targetMenu);
    const currentValue = permState[menuId]?.[permKey] ?? false;
    const newValue = !currentValue;

    setPermState((prev) => {
      const next = { ...prev };
      descendantIds.forEach((id) => {
        next[id] = {
          ...(next[id] || { read: false, create: false, update: false, delete: false, approve: false }),
          [permKey]: newValue,
        };
      });
      return next;
    });
  };

  // 수정 모드 진입
  const handleStartEdit = () => {
    setOriginalPermState(JSON.parse(JSON.stringify(permState)));
    setIsEditing(true);
  };

  // 수정 취소
  const handleCancelEdit = () => {
    setPermState(JSON.parse(JSON.stringify(originalPermState)));
    setIsEditing(false);
  };

  // 대메뉴 접기/펼치기 토글 (기본값을 접힘(true)으로 두고 토글)
  const toggleCollapse = (menuId: number) => {
    setCollapsedGroups((prev) => {
      const currentVal = prev[menuId] ?? true; // 기본값 true (접힘)
      return {
        ...prev,
        [menuId]: !currentVal,
      };
    });
  };

  // 변경사항 저장 핸들러
  const handleSave = async () => {
    if (!groupDetail || isSaving) return;

    setIsSaving(true);
    try {
      const menuPermissions: MenuPermissionRequest[] = Object.entries(permState).map(([menuIdStr, perms]) => ({
        menuId: Number(menuIdStr),
        read: perms['read'] ?? false,
        create: perms['create'] ?? false,
        update: perms['update'] ?? false,
        delete: perms['delete'] ?? false,
        approve: perms['approve'] ?? false,
      }));

      const updatePayload: AuthGroupUpdateRequest = {
        authNm: groupDetail.authNm,
        authDesc: groupDetail.authDesc,
        menuPermissions,
      };

      await apiClient.put(`/auth-groups/${groupDetail.authId}`, updatePayload);
      alert("권한 설정이 성공적으로 저장되었습니다.");
      
      setOriginalPermState(JSON.parse(JSON.stringify(permState)));
      setIsEditing(false);
    } catch (error) {
      console.error("권한 수정 실패:", error);
      const msg = axios.isAxiosError(error) ? error.response?.data?.message : null;
      alert(msg || "저장에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading && !groupDetail) {
    return <div className="p-8 text-center">권한 정보를 불러오는 중입니다...</div>;
  }

  const activeRole = authGroups.find((g) => g.authId === activeAuthId);

  // 계층형 메뉴 렌더링 함수
  const renderMenuTree = (menuList: MenuResponse[], depth = 0) => {
    return menuList.map((menu) => {
      const hasChildren = menu.children && menu.children.length > 0;
      // 기본값을 true(접힘)로 설정하여 처음에는 안 보이게 처리
      const isCollapsed = collapsedGroups[menu.menuId] ?? true;
      const checked = permState[menu.menuId] ?? {};

      return (
        <div key={menu.menuId} style={{ display: 'contents' }}>
          {/* 메뉴 행 */}
          <div 
            className="matrixRow"
            onClick={() => {
              if (hasChildren) {
                toggleCollapse(menu.menuId);
              }
            }}
            style={{ cursor: hasChildren ? 'pointer' : 'default' }}
          >
            <span 
              className="matrixLabel"
              style={{ paddingLeft: `${depth * 20}px` }}
            >
              {menu.menuNm} {hasChildren && (isCollapsed ? ' [+]' : ' [-]')}
            </span>

            {PERMISSIONS.map((p) => {
              const isChecked = checked[p.key] ?? false;
              return (
                <div key={p.key} className="matrixCheckCell" onClick={(e) => e.stopPropagation()}>
                  <span
                    className={`customCheck ${isChecked ? 'checked' : ''} ${!isEditing ? 'opacity-70 cursor-not-allowed' : ''}`}
                    onClick={() => handleToggle(menu.menuId, p.key)}
                    title={!isEditing ? "수정 버튼을 누르면 변경할 수 있습니다." : ""}
                  >
                    {isChecked && <CheckIcon />}
                  </span>
                </div>
              );
            })}
          </div>

          {/* 자식 메뉴들 (접혀있지 않을 때만 렌더링) */}
          {hasChildren && !isCollapsed && renderMenuTree(menu.children!, depth + 1)}
        </div>
      );
    });
  };

  return (
    <section className="permissionBoard">
      <div className="permissionTabs">
        <div className="permissionTabsBox">
          {authGroups.map((role) => (
            <button
              key={role.authId}
              type="button"
              className={`permissionTab ${role.authId === activeAuthId ? 'active' : ''}`}
              onClick={() => setActiveAuthId(role.authId)}
            >
              <span>{role.authNm}</span>
            </button>
          ))}
        </div>
        <p className="permissionDesc">
          {groupDetail?.authDesc || activeRole?.authDesc || "권한 그룹 설명이 없습니다."}
        </p>
      </div>

      <div className="permissionMatrix">
        <div className="matrixHeader">
          <span>메뉴명 (대메뉴 클릭 시 접기/펼치기)</span>
          {PERMISSIONS.map((p) => (
            <span key={p.key}>{p.label}</span>
          ))}
        </div>

        {renderMenuTree(menus)}
      </div>

      <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
        {isEditing ? (
          <>
            <button
              type="button"
              className="ghostButton"
              onClick={handleCancelEdit}
              disabled={isSaving}
            >
              취소
            </button>
            <button
              type="button"
              className="primaryButton"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? "저장 중..." : "저장"}
            </button>
          </>
        ) : (
          <button
            type="button"
            className="primaryButton"
            onClick={handleStartEdit}
          >
            수정
          </button>
        )}
      </div>
    </section>
  );
}