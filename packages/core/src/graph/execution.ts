import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import type { RuntimeState } from "../runtime/types.js";

const ExecutionState = Annotation.Root({
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

export function createExecutionGraph(nodes: {
  executor: (state: RuntimeState) => Promise<Partial<RuntimeState>>;
  reviewer: (state: RuntimeState) => Promise<Partial<RuntimeState>>;
  finalizer: (state: RuntimeState) => Promise<Partial<RuntimeState>>;
}) {
  return new StateGraph(ExecutionState)
    .addNode("executor", nodes.executor)
    .addNode("reviewer", nodes.reviewer)
    .addNode("finalizer", nodes.finalizer)
    .addEdge(START, "executor")
    .addConditionalEdges("executor", (state: RuntimeState) => {
      if (state.status === "awaiting_approval") {
        return END;
      }
      return "reviewer";
    })
    .addEdge("reviewer", "finalizer")
    .addEdge("finalizer", END)
    .compile();
}
