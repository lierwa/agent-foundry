"use client";

import { useEffect, useState } from "react";

export function useWorkbenchLayout(planCount: number) {
  const [planCollapsed, setPlanCollapsed] = useState(true);

  useEffect(() => {
    if (planCount > 0) {
      setPlanCollapsed(true);
    }
  }, [planCount]);

  return {
    leftCollapsed: false,
    rightCollapsed: false,
    planCollapsed,
    togglePlan: () => setPlanCollapsed((current) => !current),
  };
}
