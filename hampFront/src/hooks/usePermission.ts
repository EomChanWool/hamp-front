// hooks/usePermission.ts
import { useState, useCallback, useMemo } from "react";
import type { MenuResponse } from "@/types/Menu";

export const PERMISSIONS = [
  { label: "조회", key: "read" },
  { label: "등록", key: "create" },
  { label: "수정", key: "update" },
  { label: "삭제", key: "delete" },
  { label: "승인", key: "approve" },
] as const;

export type PermKey = (typeof PERMISSIONS)[number]["key"];
export type PermRecord = Record<PermKey, boolean>;
export type CheckState = "checked" | "unchecked" | "mixed";

const EMPTY_PERM: PermRecord = {
  read: false,
  create: false,
  update: false,
  delete: false,
  approve: false,
};

export function usePermission(menus: MenuResponse[]) {
  const [permState, setPermState] = useState<Record<number, PermRecord>>({});
  const [originalPermState, setOriginalPermState] = useState<Record<number, PermRecord>>({});

  // 1. 초기 데이터 설정 (수정 모드 진입 시 또는 생성 모드 초기화 시)
 const initializePerms = useCallback((initialData?: Record<number, PermRecord>) => {
    if (initialData) {
      setPermState(JSON.parse(JSON.stringify(initialData)));
      setOriginalPermState(JSON.parse(JSON.stringify(initialData)));
    } else {
      const emptyState: Record<number, PermRecord> = {};
      const flattenMenus = (list: MenuResponse[]): MenuResponse[] =>
        list.reduce<MenuResponse[]>((acc, menu) => {
          acc.push(menu);
          if (menu.children) acc.push(...flattenMenus(menu.children));
          return acc;
        }, []);

      flattenMenus(menus).forEach((menu) => {
        emptyState[menu.menuId] = { ...EMPTY_PERM };
      });
      setPermState(emptyState);
      setOriginalPermState(emptyState);
    }
  }, [menus]);

  // 2. 트리 유틸
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

  // 3. 토글 핸들러
  const handleToggle = (menuId: number, permKey: PermKey) => {
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

  // 4. 변경사항 체크
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

  const resetPerms = () => {
    setPermState(JSON.parse(JSON.stringify(originalPermState)));
  };

  const commitPerms = () => {
    setOriginalPermState(JSON.parse(JSON.stringify(permState)));
  };

  return {
    permState,
    initializePerms,
    getCheckState,
    handleToggle,
    handleGroupPermToggle,
    dirtyMenuCount,
    isDirty,
    resetPerms,
    commitPerms,
  };
}