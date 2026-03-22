"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type {
  BriefDraft,
  InspectorFocus,
  PlaygroundApprovalAction,
  PlaygroundTask,
  TimelineFilter,
} from "./playground-types";
import {
  buildApprovalOptions,
  buildMessages,
  buildPlanProgress,
  createDefaultBrief,
  defaultInspectorFocus,
  filterTimeline,
  formatNode,
  formatStatus,
  formatStepStatus,
  relativeTime,
  timelineBadge,
  toTaskInput,
} from "./playground-adapter";

const fixedPackageId = "perfume-formulation";

type AgentPlaygroundProps = {
  apiBaseUrl: string;
  initialTaskId?: string;
  embedded?: boolean;
};

export function AgentPlayground({ apiBaseUrl, initialTaskId, embedded = false }: AgentPlaygroundProps) {
  const [task, setTask] = useState<PlaygroundTask | null>(null);
  const [taskId, setTaskId] = useState(initialTaskId ?? "");
  const [draft, setDraft] = useState<BriefDraft>(createDefaultBrief());
  const [message, setMessage] = useState("");
  const [operator, setOperator] = useState("operator");
  const [timelineFilter, setTimelineFilter] = useState<TimelineFilter>("all");
  const [activeTab, setActiveTab] = useState<"state" | "memory">("state");
  const [inspectorFocus, setInspectorFocus] = useState<InspectorFocus>(defaultInspectorFocus(null));
  const [approvalSelection, setApprovalSelection] = useState<string[]>([]);
  const [approvalNote, setApprovalNote] = useState("");
  const [isPlanOpen, setIsPlanOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const messages = useMemo(() => buildMessages(task), [task]);
  const progress = useMemo(() => buildPlanProgress(task), [task]);
  const timeline = useMemo(() => filterTimeline(task?.trace ?? [], timelineFilter), [task, timelineFilter]);
  const approvalConfig = useMemo(() => (task ? buildApprovalOptions(task) : null), [task]);
  const hasPlan = (task?.plan.length ?? 0) > 0;

  const loadTask = async (nextTaskId: string) => {
    if (!nextTaskId) {
      setTask(null);
      setInspectorFocus(defaultInspectorFocus(null));
      return;
    }

    const response = await fetch(`${apiBaseUrl}/tasks/${nextTaskId}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      setMessage("未能获取任务详情，请检查 API 是否运行。");
      return;
    }

    const nextTask = (await response.json()) as PlaygroundTask;
    setTask(nextTask);
    setInspectorFocus(defaultInspectorFocus(nextTask));
    setApprovalSelection([]);
    setApprovalNote("");
  };

  useEffect(() => {
    if (initialTaskId) {
      void loadTask(initialTaskId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTaskId]);

  useEffect(() => {
    if (!taskId || !task || !["running", "awaiting_approval", "queued"].includes(task.status)) {
      return;
    }

    const timer = window.setInterval(() => {
      void loadTask(taskId);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [task, taskId]);

  useEffect(() => {
    if (!hasPlan) {
      setIsPlanOpen(false);
    }
  }, [hasPlan]);

  useEffect(() => {
    const node = composerTextareaRef.current;
    if (!node) return;

    const lineHeight = 28;
    const verticalPadding = 12;
    const minHeight = lineHeight * 3 + verticalPadding;
    const maxHeight = lineHeight * 6 + verticalPadding;

    node.style.height = `${minHeight}px`;
    const nextHeight = Math.min(Math.max(node.scrollHeight, minHeight), maxHeight);
    node.style.height = `${nextHeight}px`;
    node.style.overflowY = node.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [draft.goal]);

  const submitBrief = () => {
    startTransition(async () => {
      setMessage("");
      const response = await fetch(`${apiBaseUrl}/tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          packageId: fixedPackageId,
          input: toTaskInput(draft),
        }),
      });

      if (!response.ok) {
        setMessage("创建任务失败，请确认 API 运行正常。");
        return;
      }

      const nextTask = (await response.json()) as PlaygroundTask;
      setTaskId(nextTask.taskId);
      setTask(nextTask);
      setInspectorFocus(defaultInspectorFocus(nextTask));
      setApprovalSelection([]);
      setApprovalNote("");
    });
  };

  const submitApproval = (action: PlaygroundApprovalAction) => {
    if (!task) return;

    startTransition(async () => {
      setMessage("");
      const response = await fetch(`${apiBaseUrl}/tasks/${task.taskId}/approval`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          operator,
          payload: {
            selections: approvalSelection,
            note: approvalNote.trim() || undefined,
          },
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({ message: "审批提交失败。" }));
        setMessage(body.message || "审批提交失败。");
        return;
      }

      await loadTask(task.taskId);
    });
  };

  const resetSession = () => {
    setTask(null);
    setTaskId("");
    setDraft(createDefaultBrief());
    setTimelineFilter("all");
    setInspectorFocus(defaultInspectorFocus(null));
    setApprovalSelection([]);
    setApprovalNote("");
    setIsPlanOpen(false);
    setMessage("");
  };

  const shellClassName = embedded ? "playground-shell is-embedded" : "playground-shell";

  return (
    <main className={shellClassName}>
      <section className="playground-header panel">
        <div className="session-bar">
          <div className="session-bar-primary">
            <span className="meta-chip meta-chip-accent">Perfume Agent</span>
            <span className="session-title">调试会话</span>
          </div>
          <div className="playground-session-meta">
            <span className="meta-chip">Task {task?.taskId ?? "未创建"}</span>
            <span className="meta-chip">{task ? formatStatus(task.status) : "空闲"}</span>
            <span className="meta-chip">{task ? formatNode(task.currentNode) : "无节点"}</span>
          </div>
        </div>
        <div className="actions">
          <button className="secondary" onClick={resetSession} type="button">
            新建会话
          </button>
          <button
            className="secondary"
            disabled={!taskId || isPending}
            onClick={() => {
              void loadTask(taskId);
            }}
            type="button"
          >
            刷新状态
          </button>
        </div>
      </section>

      <section className="playground-layout">
        <aside className="panel side-panel">
          <div className="side-panel-tabs">
            <button
              className={activeTab === "state" ? "tab-button is-active" : "tab-button"}
              onClick={() => setActiveTab("state")}
              type="button"
            >
              State
            </button>
            <button
              className={activeTab === "memory" ? "tab-button is-active" : "tab-button"}
              onClick={() => setActiveTab("memory")}
              type="button"
            >
              Memory
            </button>
          </div>

          {activeTab === "state" ? (
            <div className="side-panel-content stack">
              <div className="data-group">
                <h3>任务摘要</h3>
                {task ? (
                  <div className="info-list">
                    <span>taskId：{task.taskId}</span>
                    <span>status：{formatStatus(task.status)}</span>
                    <span>currentNode：{task.currentNode}</span>
                    <span>createdAt：{relativeTime(task.createdAt)}</span>
                    <span>updatedAt：{relativeTime(task.updatedAt)}</span>
                  </div>
                ) : (
                  <p className="muted">创建任务后，这里会展示运行时状态与输入输出。</p>
                )}
              </div>

              {task ? (
                <>
                  <div className="data-group">
                    <h3>输入摘要</h3>
                    <pre className="code compact">{JSON.stringify(task.inputPayload, null, 2)}</pre>
                  </div>

                  <div className="data-group">
                    <h3>当前 intention</h3>
                    <pre className="code compact">{JSON.stringify(task.inputPayload.intention ?? null, null, 2)}</pre>
                  </div>

                  <div className="data-group">
                    <h3>Planning Decision</h3>
                    <pre className="code compact">
                      {JSON.stringify(task.inputPayload.lastPlanningDecision ?? null, null, 2)}
                    </pre>
                  </div>

                  <div className="data-group">
                    <h3>Planning Feedback</h3>
                    <pre className="code compact">
                      {JSON.stringify(task.inputPayload.pendingPlanningFeedback ?? null, null, 2)}
                    </pre>
                  </div>

                  <div className="data-group">
                    <h3>候选池</h3>
                    <pre className="code compact">{JSON.stringify(task.inputPayload.candidatePool ?? null, null, 2)}</pre>
                  </div>

                  <div className="data-group">
                    <h3>结构草案</h3>
                    <pre className="code compact">{JSON.stringify(task.inputPayload.structureDraft ?? null, null, 2)}</pre>
                  </div>

                  <div className="data-group">
                    <h3>审批历史</h3>
                    {task.approvalHistory.length === 0 ? (
                      <p className="muted">暂无审批历史。</p>
                    ) : (
                      <div className="event-stack">
                        {task.approvalHistory.map((event, index) => (
                          <button
                            className="event-card"
                            key={`${event.timestamp}-${index}`}
                            onClick={() =>
                              setInspectorFocus({
                                type: "event",
                                label: `审批事件：${event.action}`,
                                data: event,
                              })
                            }
                            type="button"
                          >
                            <strong>{event.action}</strong>
                            <span>{event.nodeId}</span>
                            <span>{relativeTime(event.timestamp)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="data-group">
                    <h3>选中内容</h3>
                    <pre className="code compact">{JSON.stringify(inspectorFocus.data, null, 2)}</pre>
                  </div>
                </>
              ) : null}
            </div>
          ) : (
            <div className="side-panel-content stack">
              <div className="data-group">
                <h3>Memory Refs</h3>
                {task?.memoryRefs.length ? (
                  <div className="memory-ref-list">
                    {task.memoryRefs.map((ref) => (
                      <div className="memory-ref-card" key={ref}>
                        <strong>{ref}</strong>
                        <span className="muted">当前仅展示 refs，structured / semantic memory payload 尚未暴露。</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted">当前没有 memory refs。任务完成后通常会看到 structured / semantic 两类 ref。</p>
                )}
              </div>
            </div>
          )}
        </aside>

        <section className="panel center-panel">
          <div className="message-thread">
            {messages.map((entry) => (
              <article className={`message-bubble kind-${entry.kind}`} key={entry.id}>
                <div className="message-label">{entry.kind}</div>
                {entry.title ? <h3>{entry.title}</h3> : null}
                {entry.body ? <p>{entry.body}</p> : null}
                {entry.kind === "intention" ? (
                  <button
                    className="inline-link"
                    onClick={() =>
                      setInspectorFocus({
                        type: "task",
                        label: "当前 intention",
                        data: task?.inputPayload.intention ?? null,
                      })
                    }
                    type="button"
                  >
                    查看 intention 详情
                  </button>
                ) : null}

                {entry.kind === "clarification" ? (
                  <button
                    className="inline-link"
                    onClick={() =>
                      setInspectorFocus({
                        type: "task",
                        label: "当前澄清问题",
                        data: task?.inputPayload.clarification ?? null,
                      })
                    }
                    type="button"
                  >
                    查看问题卡 payload
                  </button>
                ) : null}

                {entry.kind === "approval" && task?.pendingApproval && approvalConfig ? (
                  <div className="approval-card stack">
                    <div className="field">
                      <label>Operator</label>
                      <input onChange={(event) => setOperator(event.target.value)} value={operator} />
                    </div>

                  <div className="field">
                    <label>{approvalConfig.multiple ? "多选确认项" : "单选确认项"}</label>
                      <div className="choice-group">
                        {approvalConfig.options.map((option) => {
                          const checked = approvalSelection.includes(option.value);
                          return (
                            <label className="choice-option" key={option.value}>
                              <input
                                checked={checked}
                                onChange={(event) => {
                                  if (approvalConfig.multiple) {
                                    setApprovalSelection((current) =>
                                      event.target.checked
                                        ? [...current, option.value]
                                        : current.filter((item) => item !== option.value),
                                    );
                                  } else {
                                    setApprovalSelection(event.target.checked ? [option.value] : []);
                                  }
                                }}
                                type={approvalConfig.multiple ? "checkbox" : "radio"}
                              />
                              <span>{option.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div className="field">
                      <label>补充说明（可选）</label>
                      <textarea
                        onChange={(event) => setApprovalNote(event.target.value)}
                        placeholder="例如：我希望强调更清新的前调，并降低高成本原料占比。"
                        value={approvalNote}
                      />
                    </div>

                    {task.inputPayload.lastPlanningDecision ? (
                      <p className="muted">
                        当前 planner 决策：{task.inputPayload.lastPlanningDecision.replanMode} / {task.inputPayload.lastPlanningDecision.reason}
                      </p>
                    ) : null}

                    <div className="actions">
                      <button disabled={isPending} onClick={() => submitApproval("approve")} type="button">
                        批准
                      </button>
                      <button className="secondary" disabled={isPending} onClick={() => submitApproval("revise")} type="button">
                        需要调整
                      </button>
                      <button className="secondary" disabled={isPending} onClick={() => submitApproval("reject")} type="button">
                        拒绝
                      </button>
                    </div>
                  </div>
                ) : null}

                {entry.kind === "result" && task?.result ? (
                  <button
                    className="inline-link"
                    onClick={() =>
                      setInspectorFocus({
                        type: "result",
                        label: "结构化结果",
                        data: task.result,
                      })
                    }
                    type="button"
                  >
                    查看完整结构化结果
                  </button>
                ) : null}
              </article>
            ))}
          </div>

          <form
            className="composer-card"
            onSubmit={(event) => {
              event.preventDefault();
              submitBrief();
            }}
          >
            {hasPlan ? (
              <div className={isPlanOpen ? "plan-drawer-shell is-open" : "plan-drawer-shell"}>
                <button
                  className={isPlanOpen ? "plan-drawer-toggle is-open" : "plan-drawer-toggle"}
                  onClick={() => setIsPlanOpen((current) => !current)}
                  type="button"
                >
                  <div className="plan-drawer-toggle-main">
                    <span className="plan-drawer-title">任务规划</span>
                    <span className="plan-drawer-summary">
                      {progress.done}/{progress.total || 0} · {progress.activeStepTitle ?? "等待任务"} · 重规划 {progress.replanMode ?? "none"}
                    </span>
                  </div>
                  <span className="plan-drawer-chevron">{isPlanOpen ? "收起" : "展开"}</span>
                </button>

                {isPlanOpen ? (
                  <div className="plan-drawer">
                    {progress.replanReason ? <p className="muted plan-drawer-reason">{progress.replanReason}</p> : null}
                    <div className="plan-timeline">
                      {task?.plan.map((step) => (
                        <button
                          className={progress.activeStepId === step.id ? "plan-step-card is-active" : "plan-step-card"}
                          key={step.id}
                          onClick={() =>
                            setInspectorFocus({
                              type: "step",
                              label: `计划步骤：${step.title}`,
                              data: step,
                            })
                          }
                          type="button"
                        >
                          <div className="plan-step-rail" aria-hidden="true">
                            <span className={`plan-step-dot status-${step.status}`} />
                          </div>
                          <div className="plan-step-main">
                            <div className="plan-step-card-header">
                              <strong>{step.title}</strong>
                              <span className={`status-pill status-${step.status}`}>{formatStepStatus(step.status)}</span>
                            </div>
                            <p className="muted">
                              {step.objective}
                              {step.kind ? ` · ${step.kind}` : ""}
                              {step.source ? ` · ${step.source}` : ""}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="composer-shell">
              <textarea
                ref={composerTextareaRef}
                onChange={(event) => setDraft((current) => ({ ...current, goal: event.target.value }))}
                placeholder="直接输入你的调香目标，Agent 会在对话中动态规划并追问澄清。"
                rows={3}
                value={draft.goal}
              />
              <div className="composer-toolbar">
                <div className="composer-hint">{task ? "发送将开启新任务" : "Enter 换行，点击发送创建任务"}</div>
                <button className="composer-send" disabled={isPending} type="submit">
                  发送
                </button>
              </div>
            </div>
            {message ? <p className="muted">{message}</p> : null}
          </form>
        </section>

        <aside className="panel side-panel">
          <div className="side-panel-header">
            <div>
              <p className="eyebrow">Timeline</p>
              <h2>事件时间线</h2>
            </div>
            <div className="timeline-filters">
              {(["all", "approval", "planning", "execution", "review", "errors"] as TimelineFilter[]).map((filter) => (
                <button
                  className={timelineFilter === filter ? "filter-chip is-active" : "filter-chip"}
                  key={filter}
                  onClick={() => setTimelineFilter(filter)}
                  type="button"
                >
                  {filter === "all"
                    ? "全部"
                    : filter === "approval"
                      ? "审批"
                      : filter === "planning"
                        ? "规划"
                        : filter === "execution"
                          ? "执行"
                          : filter === "review"
                            ? "审校"
                            : "异常"}
                </button>
              ))}
            </div>
          </div>

          <div className="timeline-list">
            {timeline.length === 0 ? (
              <p className="muted">创建任务后，这里会展示 trace 事件时间线。</p>
            ) : (
              timeline.map((event) => (
                <button
                  className="timeline-card"
                  key={event.id}
                  onClick={() =>
                    setInspectorFocus({
                      type: "event",
                      label: `${event.nodeId} / ${event.eventType}`,
                      data: event,
                    })
                  }
                  type="button"
                >
                  <div className="timeline-card-header">
                    <span className="timeline-badge">{timelineBadge(event)}</span>
                    <strong>{event.nodeId}</strong>
                  </div>
                  <div className="timeline-meta">
                    <span>{event.eventType}</span>
                    <span>{relativeTime(event.timestamp)}</span>
                    {typeof event.latencyMs === "number" ? <span>{event.latencyMs} ms</span> : null}
                  </div>
                  <div className="timeline-flags">
                    {event.input ? <span>input</span> : null}
                    {event.output ? <span>output</span> : null}
                    {event.toolCall ? <span>tool</span> : null}
                    {event.knowledgeCall ? <span>knowledge</span> : null}
                    {event.error ? <span>error</span> : null}
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>
      </section>
    </main>
  );
}
