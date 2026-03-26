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

const panelClass =
  "overflow-hidden rounded-[22px] border border-white/10 bg-[rgba(18,21,29,0.72)] shadow-[0_12px_36px_rgba(0,0,0,0.22)] backdrop-blur-xl";

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

  const stageClass = leftCollapsed
    ? "grid min-h-0 gap-3 xl:grid-cols-[42px_minmax(0,1fr)_240px]"
    : rightCollapsed
      ? "grid min-h-0 gap-3 xl:grid-cols-[240px_minmax(0,1fr)_42px]"
      : "grid min-h-0 gap-3 xl:grid-cols-[240px_minmax(0,1fr)_240px]";

  return (
    <main className={embedded ? "grid h-dvh grid-rows-[auto_minmax(0,1fr)] gap-3" : "grid h-dvh grid-rows-[auto_minmax(0,1fr)] gap-3 p-3"}>
      <header className={`${panelClass} flex flex-wrap items-center justify-between gap-3 px-4 py-3`}>
        <div className="flex min-w-0 items-center gap-3">
          <span className="rounded-full border border-workbench-line-strong/80 bg-workbench-accent-soft px-4 py-2 text-xs font-medium text-[#dceeff]">
            Perfume Agent
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] text-slate-200">
              {session?.sessionId ?? "未创建 Session"}
            </span>
            {selectedModelId ? (
              <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] text-slate-200">
                {models.find((entry) => entry.id === selectedModelId)?.label ?? selectedModelId}
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white transition hover:border-workbench-line-strong hover:bg-workbench-accent-soft"
              onClick={() => {
                resetSession();
                setInspectorFocus(defaultInspectorFocus(null, "intention"));
              }}
              type="button"
            >
              新建
            </button>
            <button
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white transition hover:border-workbench-line-strong hover:bg-workbench-accent-soft disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!sessionId || isPending}
              onClick={() => void loadSession(sessionId)}
              type="button"
            >
              刷新
            </button>
          </div>
        </div>
      </header>

      <section className={`${stageClass} ${embedded ? "" : ""}`}>
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
