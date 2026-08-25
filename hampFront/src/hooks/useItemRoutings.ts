import { useState } from "react";
import type { ItemRoutingRequest } from "@/api/master/Item";

export function useItemRoutings() {
  const [routings, setRoutings] = useState<ItemRoutingRequest[]>([]);
  
  // 키보드로 아이템을 선택(활성화)한 상태를 추적하는 인덱스
  const [keyboardActiveIndex, setKeyboardActiveIndex] = useState<number | null>(null);

  const reorderSequences = (items: ItemRoutingRequest[]) => {
    return items.map((item, i) => ({ ...item, operSeq: i + 1 }));
  };

  const syncRoutings = (selectedCodes: string[]) => {
    setRoutings((prev) => {
      const existingMap = new Map(prev.map((r) => [r.operCode, r]));
      const newRoutings = selectedCodes.map((code) => ({
        operCode: code,
        operSeq: 0,
        finalYn: existingMap.get(code)?.finalYn || "N",
      }));
      return reorderSequences(newRoutings);
    });
    setKeyboardActiveIndex(null);
  };

  const removeRouting = (index: number) => {
    setKeyboardActiveIndex(null);
    setRoutings((prev) => reorderSequences(prev.filter((_, i) => i !== index)));
  };

  const updateRouting = (index: number, field: keyof ItemRoutingRequest, value: unknown) => {
    setRoutings((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const moveRouting = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= routings.length) return;
    
    setRoutings((prev) => {
      const newRoutings = [...prev];
      const [movedItem] = newRoutings.splice(fromIndex, 1);
      newRoutings.splice(toIndex, 0, movedItem);
      return reorderSequences(newRoutings);
    });
  };

  /**
   * 키보드 이벤트 핸들러 (Enter/Space로 선택, 상하 방향키로 순서 이동)
   */
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    // 1. Space 또는 Enter: 선택 토글
    if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      setKeyboardActiveIndex(keyboardActiveIndex === index ? null : index);
      return index;
    }

    // 2. Escape: 선택 취소
    if (e.key === "Escape") {
      e.preventDefault();
      setKeyboardActiveIndex(null);
      return index;
    }

    // 3. 선택된 상태에서 상하 방향키로 순서 변경
    if (keyboardActiveIndex === index) {
      let newIndex = index;
      if (e.key === "ArrowUp") newIndex = index - 1;
      if (e.key === "ArrowDown") newIndex = index + 1;

      if (newIndex >= 0 && newIndex < routings.length && newIndex !== index) {
        e.preventDefault();
        moveRouting(index, newIndex);
        setKeyboardActiveIndex(newIndex);
        return newIndex;
      }
    }

    return index;
  };

  return {
    routings,
    keyboardActiveIndex,
    setKeyboardActiveIndex,
    syncRoutings,
    removeRouting,
    updateRouting,
    moveRouting,
    handleKeyDown,
  };
}