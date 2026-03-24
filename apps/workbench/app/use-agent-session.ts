"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  defaultInspectorFocus,
  buildWorkbenchState,
} from "./playground-adapter";
import {
  createSession,
  fetchModels,
  fetchSession,
  submitSessionApproval,
} from "./session-client";
import type {
  InspectorFocus,
  InspectorTab,
  PlaygroundApprovalAction,
  PlaygroundModelOption,
  PlaygroundSession,
  TimelineFilter,
} from "./playground-types";

const fixedPackageId = "perfume-formulation";

/**
 * Keeps API transport, SSE subscription, optimistic chat state,
 * and approval draft state out of the render component.
 */
export function useAgentSession(apiBaseUrl: string) {
  const [session, setSession] = useState<PlaygroundSession | null>(null);
  const [sessionId, setSessionId] = useState("");
  const [models, setModels] = useState<PlaygroundModelOption[]>([]);
  const [selectedModelId, setSelectedModelId] = useState("");
  const [message, setMessage] = useState("");
  const [timelineFilter, setTimelineFilter] = useState<TimelineFilter>("all");
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("intention");
  const [inspectorFocus, setInspectorFocus] = useState<InspectorFocus>(defaultInspectorFocus(null, "intention"));
  const [approvalDraft, setApprovalDraft] = useState<{
    approvalId: string | null;
    selections: string[];
    note: string;
  }>({
    approvalId: null,
    selections: [],
    note: "",
  });
  const [usePollingFallback, setUsePollingFallback] = useState(false);
  const [isPending, startTransition] = useTransition();
  const hasLoadedModelsRef = useRef(false);

  const task = session?.task ?? null;
  const workbenchState = useMemo(
    () => buildWorkbenchState(session, inspectorTab, timelineFilter, inspectorFocus),
    [inspectorFocus, inspectorTab, session, timelineFilter],
  );
  const planItems = workbenchState.planItems;
  const timeline = workbenchState.timeline;
  const approvalConfig = workbenchState.approvalConfig;
  const activeApprovalId = approvalConfig?.id ?? null;
  const approvalSelection = approvalDraft.approvalId === activeApprovalId ? approvalDraft.selections : [];
  const approvalNote = approvalDraft.approvalId === activeApprovalId ? approvalDraft.note : "";
  const eventSourceSupported = typeof window !== "undefined" && typeof EventSource !== "undefined";
  const shouldUsePolling = usePollingFallback || !eventSourceSupported;

  const applySession = (nextSession: PlaygroundSession) => {
    setSession(nextSession);
    setSelectedModelId(nextSession.task?.modelConfig?.id ?? "");
    setInspectorFocus((current) =>
      buildWorkbenchState(nextSession, inspectorTab, timelineFilter, current)
        .nextInspectorFocus,
    );
  };

  const loadSession = async (nextSessionId: string) => {
    if (!nextSessionId) {
      setSession(null);
      setInspectorFocus(defaultInspectorFocus(null, inspectorTab));
      return;
    }

    try {
      applySession(await fetchSession(apiBaseUrl, nextSessionId));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "未能获取会话详情。");
    }
  };

  const ensureSession = useCallback(async () => {
    if (sessionId) {
      return sessionId;
    }

    const created = await createSession(apiBaseUrl, fixedPackageId);
    setSessionId(created.sessionId);
    applySession(created);
    return created.sessionId;
  }, [apiBaseUrl, sessionId]);

  useEffect(() => {
    if (hasLoadedModelsRef.current) {
      return;
    }
    hasLoadedModelsRef.current = true;

    void fetchModels(apiBaseUrl)
      .then((availableModels) => {
        setModels(availableModels);
        setSelectedModelId((current) => current || availableModels[0]?.id || "");
      })
      .catch(() => undefined);
  }, [apiBaseUrl]);

  useEffect(() => {
    if (!sessionId || !task || !shouldUsePolling || !["running", "queued"].includes(task.status)) {
      return;
    }

    const timer = window.setInterval(() => {
      void loadSession(sessionId);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [sessionId, shouldUsePolling, task]);

  useEffect(() => {
    if (!activeApprovalId) {
      setApprovalDraft((current) =>
        current.approvalId === null ? current : { approvalId: null, selections: [], note: "" },
      );
      return;
    }

    setApprovalDraft((current) =>
      current.approvalId === activeApprovalId
        ? current
        : {
            approvalId: activeApprovalId,
            selections: [],
            note: "",
          },
    );
  }, [activeApprovalId]);

  useEffect(() => {
    if (!sessionId || !eventSourceSupported || usePollingFallback) {
      return;
    }

    if (task && !["queued", "running"].includes(task.status)) {
      return;
    }

    const stream = new EventSource(`${apiBaseUrl}/sessions/${sessionId}/stream`);

    const handleSession = (event: MessageEvent<string>) => {
      const payload = JSON.parse(event.data) as { type: "session.snapshot"; session: PlaygroundSession };
      applySession(payload.session);
      if (payload.session.task && ["awaiting_approval", "completed", "failed"].includes(payload.session.task.status)) {
        stream.close();
      }
    };

    const handleError = () => {
      stream.close();
      setUsePollingFallback(true);
    };

    stream.addEventListener("session", handleSession as EventListener);
    stream.onerror = handleError;

    return () => {
      stream.removeEventListener("session", handleSession as EventListener);
      stream.close();
    };
  }, [apiBaseUrl, eventSourceSupported, sessionId, task?.status, usePollingFallback]);

  const submitApproval = (action: PlaygroundApprovalAction, operator: string) => {
    if (!sessionId) {
      return;
    }

    startTransition(async () => {
      setMessage("");
      try {
        const nextSession = await submitSessionApproval(apiBaseUrl, sessionId, {
          action,
          operator,
          payload: {
            selections: approvalSelection,
            note: approvalNote.trim() || undefined,
          },
        });
        applySession(nextSession);
        setApprovalDraft({
          approvalId: null,
          selections: [],
          note: "",
        });
        setUsePollingFallback(false);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "审批提交失败。");
      }
    });
  };

  const resetSession = () => {
    setSession(null);
    setSessionId("");
    setTimelineFilter("all");
    setInspectorTab("intention");
    setInspectorFocus(defaultInspectorFocus(null, "intention"));
    setApprovalDraft({
      approvalId: null,
      selections: [],
      note: "",
    });
    setUsePollingFallback(false);
    setMessage("");
  };

  return {
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
  };
}
