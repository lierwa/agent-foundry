"use client";

import { useMemo } from "react";
import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
} from "@assistant-ui/react";
import {
  AssistantChatTransport,
  useChatRuntime,
} from "@assistant-ui/react-ai-sdk";
import type { UIMessage } from "ai";
import { motion } from "framer-motion";
import { ModelSelect } from "./model-select";
import { PlanPanel } from "./plan-panel";
import { InteractionPanel } from "./interaction-panel";
import { formatNode, formatStatus } from "./playground-adapter";
import type {
  PlaygroundApprovalAction,
  PlaygroundApprovalViewModel,
  PlaygroundModelOption,
  PlaygroundSession,
  PlaygroundTask,
  PlanListItem,
} from "./playground-types";

function toUiMessage(
  entry: PlaygroundSession["historyMessages"][number],
): UIMessage {
  return {
    id: entry.id,
    role: entry.kind === "user" ? "user" : "assistant",
    parts: [{ type: "text", text: entry.body }],
  };
}

function activeStepTitle(task: PlaygroundTask | null) {
  if (!task) {
    return null;
  }

  return (
    task.plan.find((step) => step.status === "ready")?.title ??
    task.plan.find((step) => step.status === "pending")?.title ??
    null
  );
}

function currentWorkCopy(task: PlaygroundTask | null) {
  if (!task) {
    return {
      title: "等待输入",
      body: "发来一个 brief 后，我会先理解目标、判断当前缺口，再逐步推进规划、追问和结果生成。",
      details: [] as string[],
    };
  }

  const stepTitle = activeStepTitle(task);

  if (task.pendingApproval) {
    return {
      title: "我现在停在这里",
      body: "我已经定位到当前阶段的关键信息缺口，需要你给一个明确选择，然后我再继续往下推进。",
      details: [
        `${formatNode(task.currentNode)} · 等待确认`,
        stepTitle ? `当前步骤：${stepTitle}` : "当前还没有活动步骤",
      ],
    };
  }

  if (task.status === "completed") {
    return {
      title: "这一轮已经完成",
      body: "当前这轮的规划、执行和整理已经结束。你可以继续追问、调整方向，或者直接开始下一轮。",
      details: [formatStatus(task.status)],
    };
  }

  if (task.status === "failed") {
    return {
      title: "当前任务失败",
      body: "这一轮没有成功完成。请结合右侧时间线查看失败节点和错误细节。",
      details: [formatNode(task.currentNode)],
    };
  }

  return {
    title: "我正在做什么",
    body:
      task.currentNode === "planner"
        ? "我正在先理解 brief、判断当前缺口，再决定是继续追问还是进入执行。"
        : task.currentNode === "executor"
          ? "我已经进入执行阶段，正在围绕当前规划生成候选与结构。"
          : "我正在检查当前结果，并推进到下一步。",
    details: [
      `${formatNode(task.currentNode)} · ${formatStatus(task.status)}`,
      stepTitle ? `当前步骤：${stepTitle}` : "正在等待下一步",
    ],
  };
}

function UserMessageCard() {
  return (
    <MessagePrimitive.Root className="ml-auto w-full max-w-[820px] rounded-2xl border border-workbench-line-strong/50 bg-gradient-to-br from-[#20324f] to-[#16233b] px-4 py-3">
      <div className="mb-2">
        <span className="text-[11px] uppercase tracking-[0.18em] text-white/70">You</span>
      </div>
      <div className="text-sm leading-7 text-white">
        <MessagePrimitive.Parts />
      </div>
    </MessagePrimitive.Root>
  );
}

function AssistantMessageCard() {
  return (
    <MessagePrimitive.Root className="w-full max-w-[820px] rounded-2xl border border-white/10 bg-[#13171f]/90 px-4 py-3">
      <div className="mb-2">
        <span className="text-[11px] uppercase tracking-[0.18em] text-white/70">Agent</span>
      </div>
      <div className="text-sm leading-7 text-white">
        <MessagePrimitive.Parts />
      </div>
    </MessagePrimitive.Root>
  );
}

export function AssistantChatSurface({
  approvalConfig,
  approvalNote,
  approvalSelection,
  isPending,
  message,
  models,
  onApprovalNoteChange,
  onApprovalSelectionChange,
  onModelChange,
  onSubmitApproval,
  planCollapsed,
  planItems,
  selectedModelId,
  session,
  sessionId,
  task,
  togglePlan,
}: {
  approvalConfig: PlaygroundApprovalViewModel | null;
  approvalNote: string;
  approvalSelection: string[];
  isPending: boolean;
  message: string;
  models: PlaygroundModelOption[];
  onApprovalNoteChange: (value: string) => void;
  onApprovalSelectionChange: (next: string[]) => void;
  onModelChange: (value: string) => void;
  onSubmitApproval: (action: PlaygroundApprovalAction) => void;
  planCollapsed: boolean;
  planItems: PlanListItem[];
  selectedModelId: string;
  session: PlaygroundSession | null;
  sessionId: string;
  task: PlaygroundTask | null;
  togglePlan: () => void;
}) {
  const intro = currentWorkCopy(task);
  const initialMessages = useMemo(
    () => session?.historyMessages.map(toUiMessage) ?? [],
    [session?.historyMessages],
  );
  const isEmptyState = !task && initialMessages.length === 0;
  const transport = useMemo(
    () =>
      new AssistantChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: async (options) => ({
          body: {
            ...options.body,
            id: options.id,
            messages: options.messages,
            trigger: options.trigger,
            messageId: options.messageId,
            sessionId,
            modelId: selectedModelId || undefined,
          },
        }),
      }),
    [selectedModelId, sessionId],
  );
  const runtime = useChatRuntime({
    id: sessionId || "pending-session",
    messages: initialMessages,
    transport,
  });
  const showActivityPanel = Boolean(task);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <section className="grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)_auto] overflow-hidden rounded-[22px] border border-white/10 bg-[rgba(18,21,29,0.88)] shadow-[0_16px_48px_rgba(0,0,0,0.22)] backdrop-blur-xl">
        <div className="workbench-scrollbar flex min-h-0 min-w-0 justify-center overflow-auto px-3 pt-3 pb-1">
          <div className={isEmptyState ? "grid min-h-full w-full min-w-0 max-w-[1060px] grid-rows-[minmax(0,1fr)] gap-3" : "grid min-h-full w-full min-w-0 max-w-[1060px] grid-rows-[auto_minmax(0,1fr)] gap-3"}>
            {showActivityPanel ? (
              <motion.section
                animate={{ opacity: 1, y: 0 }}
                className="grid max-w-[760px] gap-2 rounded-2xl border border-white/10 bg-[#11151e]/90 px-4 py-3"
                initial={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[11px] uppercase tracking-[0.18em] text-workbench-accent">
                    Agent
                  </span>
                  <span className="text-xs text-slate-200">{intro.title}</span>
                </div>
                <p className="text-sm leading-6 text-white/80">{intro.body}</p>
                {intro.details.length ? (
                  <ul className="grid gap-1 pl-4 text-xs leading-6 text-white/45">
                    {intro.details.map((detail) => (
                      <li key={detail}>{detail}</li>
                    ))}
                  </ul>
                ) : null}
              </motion.section>
            ) : null}

            <ThreadPrimitive.Root className="flex min-h-full min-w-0 flex-col">
              <ThreadPrimitive.Viewport className="flex min-h-full min-w-0 flex-1 flex-col gap-4">
                {isEmptyState ? (
                  <div className="my-auto grid max-w-[560px] gap-2">
                    <span className="text-[11px] uppercase tracking-[0.18em] text-workbench-accent">
                      Perfume Agent
                    </span>
                    <h2 className="text-[2.2rem] font-semibold leading-tight text-white">
                      从一个 brief 开始
                    </h2>
                    <p className="text-lg leading-8 text-white/55">
                      输入你的目标，我会先解释当前动作，再逐步推进 thought、追问和结果。
                    </p>
                  </div>
                ) : null}
                <ThreadPrimitive.Empty>
                  <div className="my-auto max-w-[560px]">
                    <span className="mb-2 inline-flex text-[11px] uppercase tracking-[0.18em] text-workbench-accent">
                      Ready
                    </span>
                    <p className="text-sm leading-7 text-white/55">
                      输入 brief，我会先说明当前动作，再逐步推进 thought、追问和结果。
                    </p>
                  </div>
                </ThreadPrimitive.Empty>

                <ThreadPrimitive.Messages
                  components={{
                    UserMessage: UserMessageCard,
                    AssistantMessage: AssistantMessageCard,
                  }}
                />
              </ThreadPrimitive.Viewport>
            </ThreadPrimitive.Root>
          </div>
        </div>

        <div className="grid gap-2 bg-gradient-to-b from-transparent via-[#0a0c11]/70 to-[#0a0c11]/95 px-3 pb-3">
          {approvalConfig ? (
            <InteractionPanel
              approvalConfig={approvalConfig}
              approvalNote={approvalNote}
              approvalSelection={approvalSelection}
              isPending={isPending}
              onApprovalNoteChange={onApprovalNoteChange}
              onApprovalSelectionChange={onApprovalSelectionChange}
              onSubmitApproval={onSubmitApproval}
            />
          ) : (
            <PlanPanel
              collapsed={planCollapsed}
              items={planItems}
              onToggle={togglePlan}
            />
          )}

          <ComposerPrimitive.Root className="mx-auto grid w-full max-w-[1060px] gap-3 rounded-2xl border border-white/10 bg-[#10141c]/95 px-3 py-3">
            <ComposerPrimitive.Input
              className="min-h-[56px] border-0 bg-transparent text-sm leading-7 text-white outline-none placeholder:text-white/30"
              placeholder="输入你的 brief，让我开始这一轮工作。"
              submitMode="enter"
            />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <ModelSelect
                  models={models}
                  onValueChange={onModelChange}
                  value={selectedModelId}
                />
              </div>

              <ComposerPrimitive.Send asChild>
                <button
                  className="rounded-2xl bg-gradient-to-r from-[#58a6ff] to-[#3b82f6] px-5 py-2.5 text-sm font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={!selectedModelId}
                  type="submit"
                >
                  发送
                </button>
              </ComposerPrimitive.Send>
            </div>
          </ComposerPrimitive.Root>

          {message ? (
            <p className="mx-auto w-full max-w-[1060px] px-1 text-sm leading-6 text-white/55">
              {message}
            </p>
          ) : null}
        </div>
      </section>
    </AssistantRuntimeProvider>
  );
}
