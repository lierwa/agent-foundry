"use client";

import { useEffect, useState } from "react";

export function useWorkbenchLayout(planCount: number) {
  const [leftCollapsed, setLeftCollapsed] = useState(true);
  const [rightCollapsed, setRightCollapsed] = useState(true);
  const [planCollapsed, setPlanCollapsed] = useState(true);

  useEffect(() => {
    if (planCount > 0) {
      setPlanCollapsed(true);
    }
  }, [planCount]);

  return {
    leftCollapsed,
    rightCollapsed,
    planCollapsed,
    toggleLeft: () => setLeftCollapsed((current) => !current),
    toggleRight: () => setRightCollapsed((current) => !current),
    togglePlan: () => setPlanCollapsed((current) => !current),
  };
}
