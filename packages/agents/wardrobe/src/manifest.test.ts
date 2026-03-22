import { describe, expect, it } from "vitest";
import { wardrobeAgentPackage } from "./manifest.js";

describe("wardrobeAgentPackage", () => {
  it("registers a minimal full-template agent package", async () => {
    const planning = await wardrobeAgentPackage.createPlan(
      {
        goal: "帮我做一套通勤穿搭。",
        conversation: [{ role: "user", content: "帮我做一套通勤穿搭。" }],
      },
      {
        taskId: "task_wardrobe",
        packageId: "wardrobe-agent",
        input: null,
        plan: [],
        approvalHistory: [],
        pendingApproval: null,
        async invokeTool() {
          return null;
        },
      },
    );

    expect(planning.plan).toHaveLength(2);
    expect(planning.planningDecision.replanMode).toBe("full");
  });
});
