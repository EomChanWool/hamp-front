import { useState } from "react";
import type { ItemRoutingRequest } from "@/api/master/Item";

export function useItemRoutings() {
  const [routings, setRoutings] = useState<ItemRoutingRequest[]>([]);

  // 순번을 매기면서, 항상 마지막 항목은 finalYn을 "Y", 나머지는 "N"으로 자동 설정
  const reorderSequences = (items: ItemRoutingRequest[]) => {
    return items.map((item, i) => {
      const isLast = i === items.length - 1;
      return {
        ...item,
        operSeq: i + 1,
        finalYn: isLast ? "Y" : "N",
      };
    });
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
  };

  const removeRouting = (index: number) => {
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

  return {
    routings,
    syncRoutings,
    removeRouting,
    updateRouting,
    moveRouting,
  };
}