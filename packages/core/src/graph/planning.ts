import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import type { RuntimeState } from "../runtime/types.js";

const PlanningState = Annotation.Root({
  taskId: Annotation<string>(),
  packageId: Annotation<string>(),
  input: Annotation<unknown>(),
  plan: Annotation<RuntimeState["plan"]>(),
  currentNode: Annotation<string>(),
  trace: Annotation<RuntimeState["trace"]>(),
  pendingApproval: Annotation<RuntimeState["pendingApproval"]>(),
  approvalHistory: Annotation<RuntimeState["approvalHistory"]>(),
  status: Annotation<RuntimeState["status"]>(),
  execution: Annotation<RuntimeState["execution"]>(),
  result: Annotation<RuntimeState["result"]>(),
  error: Annotation<string | undefined>(),
});

export function createPlanningGraph(plannerNode: (state: RuntimeState) => Promise<Partial<RuntimeState>>) {
  // planning 图只有一个 planner 节点，负责收敛计划并决定是否需要审批。
  return new StateGraph(PlanningState)
    .addNode("planner", plannerNode)
    .addEdge(START, "planner")
    .addEdge("planner", END)
    .compile();
}
