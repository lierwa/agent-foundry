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
      body: "发一个 brief 进来，我会先理解目标、判断缺口，再逐步推进规划与执行。",
      details: [],
    };
  }

  const stepTitle = activeStepTitle(task);

  if (task.pendingApproval) {
    return {
      title: "我现在停在这里",
      body: "我已经收敛到了当前阶段的关键缺口，需要你给一个明确选择，随后我再继续往下推进。",
      details: [
        `${formatNode(task.currentNode)} · 等待确认`,
        stepTitle ? `当前步骤：${stepTitle}` : "当前没有激活步骤",
      ],
    };
  }

  if (task.status === "completed") {
    return {
      title: "我已经完成这一轮",
      body: "这一轮的规划、执行和整理已经完成。你可以继续追问、修改方向，或者直接开启下一轮。",
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
          : "我正在检查当前结果并推进到下一步。",
    details: [
      `${formatNode(task.currentNode)} · ${formatStatus(task.status)}`,
      stepTitle ? `当前步骤：${stepTitle}` : "正在等待下一步",
    ],
  };
}

function UserMessageCard() {
  return (
    <MessagePrimitive.Root className="aui-message aui-message-user">
      <div className="aui-message-header">
        <span className="aui-message-role">You</span>
      </div>
      <div className="aui-message-content">
        <MessagePrimitive.Parts />
      </div>
    </MessagePrimitive.Root>
  );
}

function AssistantMessageCard() {
  return (
    <MessagePrimitive.Root className="aui-message aui-message-assistant">
      <div className="aui-message-header">
        <span className="aui-message-role">Agent</span>
      </div>
      <div className="aui-message-content">
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
      <section className="chat-surface panel">
        <div className="chat-surface-scroll">
          <div className={isEmptyState ? "assistant-chat-shell is-empty" : "assistant-chat-shell"}>
            {showActivityPanel ? (
              <motion.section
                animate={{ opacity: 1, y: 0 }}
                className="live-activity-panel"
                initial={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="live-activity-header">
                  <span className="live-activity-kicker">Agent</span>
                  <span className="live-activity-title">{intro.title}</span>
                </div>
                <p>{intro.body}</p>
                {intro.details.length ? (
                  <ul className="live-activity-list">
                    {intro.details.map((detail) => (
                      <li key={detail}>{detail}</li>
                    ))}
                  </ul>
                ) : null}
              </motion.section>
            ) : null}

            <ThreadPrimitive.Root className="aui-thread-root">
              <ThreadPrimitive.Viewport className="aui-thread-viewport">
                {isEmptyState ? (
                  <div className="assistant-empty-hero">
                    <span className="aui-thread-empty-kicker">Perfume Agent</span>
                    <h2>从一个 brief 开始</h2>
                    <p>输入你的目标，我会先解释当前动作，再逐步推进 thought、追问和结果。</p>
                  </div>
                ) : null}
                <ThreadPrimitive.Empty>
                  <div className="aui-thread-empty">
                    <span className="aui-thread-empty-kicker">Ready</span>
                    <p>输入 brief，我会先说明当前动作，再逐步推进 thought、追问和结果。</p>
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

        <div className="chat-surface-bottom">
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

          <ComposerPrimitive.Root className="aui-composer-shell">
            <ComposerPrimitive.Input
              className="aui-composer-input"
              placeholder="输入你的 brief，让我开始这一轮工作。"
              submitMode="enter"
            />

            <div className="aui-composer-footer">
              <div className="aui-composer-footer-left">
                <ModelSelect
                  models={models}
                  onValueChange={onModelChange}
                  value={selectedModelId}
                />
              </div>

              <ComposerPrimitive.Send asChild>
                <button className="aui-composer-send" type="submit">
                  发送
                </button>
              </ComposerPrimitive.Send>
            </div>
          </ComposerPrimitive.Root>

          {message ? <p className="composer-inline-feedback">{message}</p> : null}
        </div>
      </section>
    </AssistantRuntimeProvider>
  );
}
