"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function ApprovalForm({ apiBaseUrl, taskId }: { apiBaseUrl: string; taskId: string }) {
  const [operator, setOperator] = useState("operator");
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const router = useRouter();

  const submit = (action: "approve" | "reject" | "revise") => {
    startTransition(async () => {
      const response = await fetch(`${apiBaseUrl}/tasks/${taskId}/approval`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          operator,
        }),
      });

      if (!response.ok) {
        const body = await response.json();
        setMessage(body.message || "Approval submission failed.");
        return;
      }

      router.refresh();
    });
  };

  return (
    <div className="stack">
      <div className="field">
        <label>Operator</label>
        <input value={operator} onChange={(event) => setOperator(event.target.value)} />
      </div>
      <div className="actions">
        <button disabled={isPending} onClick={() => submit("approve")} type="button">
          Approve
        </button>
        <button className="secondary" disabled={isPending} onClick={() => submit("revise")} type="button">
          Revise
        </button>
        <button className="secondary" disabled={isPending} onClick={() => submit("reject")} type="button">
          Reject
        </button>
      </div>
      {message ? <p className="muted">{message}</p> : null}
    </div>
  );
}
