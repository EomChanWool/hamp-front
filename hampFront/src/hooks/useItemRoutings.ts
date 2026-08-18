import { useState } from "react";
import type { ItemRoutingRequest } from "@/api/master/Item";

export function useItemRoutings() {
  const [routings, setRoutings] = useState<ItemRoutingRequest[]>([]);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [targetIndex, setTargetIndex] = useState<number | null>(null);
  
  // 키보드로 아이템을 잡고 있는 상태를 추적하는 인덱스
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

  const handleMouseDown = (index: number) => {
    setKeyboardActiveIndex(null);
    setDraggingIndex(index);
    setTargetIndex(index);
  };

  const handleMouseEnter = (index: number) => {
    if (draggingIndex === null) return;
    setTargetIndex(index);
  };

  const handleMouseUp = () => {
    if (draggingIndex !== null && targetIndex !== null && draggingIndex !== targetIndex) {
      moveRouting(draggingIndex, targetIndex);
    }
    setDraggingIndex(null);
    setTargetIndex(null);
  };

  /**
   * 키보드 이벤트 핸들러 (Space/Enter로 잡기/놓기, ESC로 취소, 방향키로 순서 변경)
   */
  const handleKeyDown = (e: React.KeyboardEvent, index: number, columns: number = 2) => {
    // 1. Space 또는 Enter: 잡기 / 놓기 토글
    if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      if (keyboardActiveIndex === index) {
        setKeyboardActiveIndex(null); // 놓기
      } else {
        setKeyboardActiveIndex(index); // 잡기
      }
      return index;
    }

    // 2. Escape: 키보드 이동 모드 강제 취소
    if (e.key === "Escape") {
      e.preventDefault();
      setKeyboardActiveIndex(null);
      return index;
    }

    // 3. 방향키 이동: 현재 키보드로 '잡은(Active)' 상태일 때만 데이터 순서 변경 및 포커스 승계
    if (keyboardActiveIndex === index) {
      let newIndex = index;
      switch (e.key) {
        case "ArrowUp":    newIndex = index - columns; break;
        case "ArrowDown":  newIndex = index + columns; break;
        case "ArrowLeft":  newIndex = index - 1; break;
        case "ArrowRight": newIndex = index + 1; break;
        default: return index;
      }

      if (newIndex >= 0 && newIndex < routings.length) {
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
    draggingIndex,
    targetIndex,
    keyboardActiveIndex,
    syncRoutings,
    removeRouting,
    updateRouting,
    handleMouseDown,
    handleMouseEnter,
    handleMouseUp,
    handleKeyDown,
    moveRouting,
  };
}