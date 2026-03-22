"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function TaskCreateForm({
  packages,
  apiBaseUrl,
}: {
  packages: Array<{ id: string; title: string }>;
  apiBaseUrl: string;
}) {
  const [selectedPackage, setSelectedPackage] = useState(packages[0]?.id ?? "perfume-formulation");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <form
      className="stack"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const preferredAccords = String(formData.get("preferredAccords") ?? "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
        const avoidNotes = String(formData.get("avoidNotes") ?? "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);

        startTransition(async () => {
          setMessage("");
          const response = await fetch(`${apiBaseUrl}/tasks`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              packageId: selectedPackage,
              input: {
                goal: formData.get("goal"),
                season: formData.get("season"),
                preferredAccords,
                avoidNotes,
                budgetLevel: formData.get("budgetLevel"),
                manufacturableOnly: formData.get("manufacturableOnly") === "on",
                requiresHumanReview: formData.get("requiresHumanReview") === "on",
              },
            }),
          });

          if (!response.ok) {
            setMessage("Failed to create task.");
            return;
          }

          const task = await response.json();
          router.push(`/tasks/${task.taskId}`);
          router.refresh();
        });
      }}
    >
      <div className="field">
        <label>Package</label>
        <select value={selectedPackage} onChange={(event) => setSelectedPackage(event.target.value)}>
          {packages.map((pkg) => (
            <option key={pkg.id} value={pkg.id}>
              {pkg.title}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>Goal</label>
        <textarea name="goal" defaultValue="Create a spring-ready woody fragrance that can be manufactured at scale." />
      </div>

      <div className="field">
        <label>Season</label>
        <input name="season" defaultValue="spring" />
      </div>

      <div className="field">
        <label>Preferred accords (comma separated)</label>
        <input name="preferredAccords" defaultValue="woody,fresh" />
      </div>

      <div className="field">
        <label>Avoid notes (comma separated)</label>
        <input name="avoidNotes" defaultValue="animalic" />
      </div>

      <div className="field">
        <label>Budget level</label>
        <select name="budgetLevel" defaultValue="medium">
          <option value="low">low</option>
          <option value="medium">medium</option>
          <option value="high">high</option>
        </select>
      </div>

      <label>
        <input type="checkbox" name="manufacturableOnly" defaultChecked /> Manufacturable materials only
      </label>
      <label>
        <input type="checkbox" name="requiresHumanReview" defaultChecked /> Force human review
      </label>

      <div className="actions">
        <button disabled={isPending} type="submit">
          {isPending ? "Creating..." : "Create Task"}
        </button>
      </div>
      {message ? <p className="muted">{message}</p> : null}
    </form>
  );
}
