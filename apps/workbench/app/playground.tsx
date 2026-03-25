"use client";

import { useEffect, useState } from "react";
import { AssistantChatSurface } from "./assistant-chat-surface";
import { defaultInspectorFocus } from "./playground-adapter";
import { InspectorPanel } from "./inspector-panel";
import { TimelinePanel } from "./timeline-panel";
import { useAgentSession } from "./use-agent-session";
import { useWorkbenchLayout } from "./use-workbench-layout";

type AgentPlaygroundProps = {
  apiBaseUrl: string;
  embedded?: boolean;
};

// 顶层编排组件：只负责把会话状态映射到三栏 UI，不直接处理网络细节。
export function AgentPlayground({ apiBaseUrl, embedded = false }: AgentPlaygroundProps) {
  const [operator] = useState("operator");
  const {
    session,
    sessionId,
    task,
    models,
    selectedModelId,
    setSelectedModelId,
    message,
    timelineFilter,
    setTimelineFilter,
    inspectorTab,
    setInspectorTab,
    inspectorFocus,
    setInspectorFocus,
    approvalConfig,
    approvalSelection,
    approvalNote,
    setApprovalDraft,
    isPending,
    planItems,
    timeline,
    submitApproval,
    resetSession,
    loadSession,
    ensureSession,
  } = useAgentSession(apiBaseUrl);
  const { leftCollapsed, rightCollapsed, planCollapsed, togglePlan } = useWorkbenchLayout(
    planItems.length,
  );

  useEffect(() => {
    void ensureSession();
  }, [ensureSession]);

  return (
    <main className={embedded ? "workbench-shell embedded" : "workbench-shell"}>
      <header className="workbench-topbar">
        <div className="workbench-brand workbench-brand-slim">
          <span className="workbench-brand-badge">Perfume Agent</span>
        </div>

        <div className="workbench-toolbar">
          <div className="workbench-meta">
            <span>{session?.sessionId ?? "未创建 Session"}</span>
            {selectedModelId ? (
              <span>
                {models.find((entry) => entry.id === selectedModelId)?.label ??
                  selectedModelId}
              </span>
            ) : null}
          </div>
          <div className="workbench-actions">
            <button
              className="secondary"
              onClick={() => {
                resetSession();
                setInspectorFocus(defaultInspectorFocus(null, "intention"));
              }}
              type="button"
            >
              新建
            </button>
            <button
              className="secondary"
              disabled={!sessionId || isPending}
              onClick={() => void loadSession(sessionId)}
              type="button"
            >
              刷新
            </button>
          </div>
        </div>
      </header>

      <section
        className={
          leftCollapsed
            ? "workbench-stage left-collapsed"
            : rightCollapsed
              ? "workbench-stage right-collapsed"
              : "workbench-stage"
        }
      >
        <InspectorPanel
          activeTab={inspectorTab}
          collapsed={leftCollapsed}
          inspectorFocus={inspectorFocus}
          onInspectorFocusChange={setInspectorFocus}
          onTabChange={(tab) => {
            setInspectorTab(tab);
            setInspectorFocus(defaultInspectorFocus(session, tab));
          }}
          session={session}
        />

        <AssistantChatSurface
          approvalConfig={approvalConfig}
          approvalNote={approvalNote}
          approvalSelection={approvalSelection}
          isPending={isPending}
          message={message}
          models={models}
          onApprovalNoteChange={(value) =>
            setApprovalDraft((current) => ({
              approvalId: approvalConfig?.id ?? null,
              selections: current.approvalId === approvalConfig?.id ? current.selections : [],
              note: value,
            }))
          }
          onApprovalSelectionChange={(next) =>
            setApprovalDraft((current) => ({
              approvalId: approvalConfig?.id ?? null,
              selections: next,
              note: current.approvalId === approvalConfig?.id ? current.note : "",
            }))
          }
          onModelChange={setSelectedModelId}
          onSubmitApproval={(action) => submitApproval(action, operator)}
          planCollapsed={planCollapsed}
          planItems={planItems}
          selectedModelId={selectedModelId}
          session={session}
          sessionId={sessionId}
          task={task}
          togglePlan={togglePlan}
        />

        <TimelinePanel
          collapsed={rightCollapsed}
          onInspectorFocusChange={setInspectorFocus}
          onTimelineFilterChange={setTimelineFilter}
          timeline={timeline}
          timelineFilter={timelineFilter}
        />
      </section>
    </main>
  );
}
