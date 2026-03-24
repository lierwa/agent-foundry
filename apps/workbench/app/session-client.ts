import type {
  PlaygroundApprovalAction,
  PlaygroundModelOption,
  PlaygroundSession,
} from "./playground-types";

export async function fetchModels(apiBaseUrl: string) {
  const response = await fetch(`${apiBaseUrl}/models`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("未能获取模型列表。");
  }

  const payload = (await response.json()) as {
    items?: PlaygroundModelOption[];
  };

  return payload.items ?? [];
}

export async function createSession(apiBaseUrl: string, packageId: string) {
  const response = await fetch(`${apiBaseUrl}/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ packageId }),
  });

  if (!response.ok) {
    throw new Error("创建会话失败。");
  }

  return (await response.json()) as PlaygroundSession;
}

export async function fetchSession(apiBaseUrl: string, sessionId: string) {
  const response = await fetch(`${apiBaseUrl}/sessions/${sessionId}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("未能获取会话详情。");
  }

  return (await response.json()) as PlaygroundSession;
}

export async function sendSessionMessage(
  apiBaseUrl: string,
  sessionId: string,
  payload: {
    content: string;
    modelId?: string;
  },
) {
  const response = await fetch(`${apiBaseUrl}/sessions/${sessionId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: "发送消息失败。" }));
    throw new Error(body.message || "发送消息失败。");
  }

  return (await response.json()) as PlaygroundSession;
}

export async function submitSessionApproval(
  apiBaseUrl: string,
  sessionId: string,
  payload: {
    action: PlaygroundApprovalAction;
    operator: string;
    payload?: unknown;
  },
) {
  const response = await fetch(`${apiBaseUrl}/sessions/${sessionId}/approval`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: "审批提交失败。" }));
    throw new Error(body.message || "审批提交失败。");
  }

  return (await response.json()) as PlaygroundSession;
}
