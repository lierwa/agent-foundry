"use client";

import { AnimatePresence, motion } from "framer-motion";
import type {
  PlaygroundApprovalAction,
  PlaygroundApprovalViewModel,
} from "./playground-types";

export function InteractionPanel({
  approvalConfig,
  approvalNote,
  approvalSelection,
  isPending,
  onApprovalNoteChange,
  onApprovalSelectionChange,
  onSubmitApproval,
}: {
  approvalConfig: PlaygroundApprovalViewModel | null;
  approvalNote: string;
  approvalSelection: string[];
  isPending: boolean;
  onApprovalNoteChange: (value: string) => void;
  onApprovalSelectionChange: (next: string[]) => void;
  onSubmitApproval: (action: PlaygroundApprovalAction) => void;
}) {
  return (
    <AnimatePresence initial={false}>
      {approvalConfig ? (
        <motion.section
          animate={{ opacity: 1, y: 0, height: "auto" }}
          className="interaction-panel"
          exit={{ opacity: 0, y: 8, height: 0 }}
          initial={{ opacity: 0, y: 12, height: 0 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="interaction-panel-header">
            <span className="interaction-panel-kicker">
              {approvalConfig.nodeId === "planner" ? "Clarify" : "Confirm"}
            </span>
            <h3>{approvalConfig.question}</h3>
            <p>{approvalConfig.reason}</p>
          </div>

          <div className="interaction-panel-context">
            {approvalConfig.contextCards.map((card) => (
              <div className="interaction-context-card" key={card.label}>
                <span className="interaction-context-label">{card.label}</span>
                <p>{card.body}</p>
              </div>
            ))}
          </div>

          {approvalConfig.options.length ? (
            <div className="interaction-choice-grid">
              {approvalConfig.options.map((option) => {
                const checked = approvalSelection.includes(option.value);
                return (
                  <label
                    className={
                      checked
                        ? "interaction-choice is-active"
                        : "interaction-choice"
                    }
                    key={option.value}
                  >
                    <input
                      checked={checked}
                      onChange={(event) => {
                        if (approvalConfig.multiple) {
                          onApprovalSelectionChange(
                            event.target.checked
                              ? [...approvalSelection, option.value]
                              : approvalSelection.filter(
                                  (item) => item !== option.value,
                                ),
                          );
                          return;
                        }

                        onApprovalSelectionChange(
                          event.target.checked ? [option.value] : [],
                        );
                      }}
                      type={approvalConfig.multiple ? "checkbox" : "radio"}
                    />
                    <span>{option.label}</span>
                  </label>
                );
              })}
            </div>
          ) : null}

          {approvalConfig.allowsFreeText ? (
            <textarea
              className="interaction-note"
              onChange={(event) => onApprovalNoteChange(event.target.value)}
              placeholder="补充更细的方向、限制条件或修改建议。"
              value={approvalNote}
            />
          ) : null}

          <div className="interaction-actions">
            <button
              disabled={isPending}
              onClick={() => onSubmitApproval("approve")}
              type="button"
            >
              确认继续
            </button>
            <button
              className="secondary"
              disabled={isPending}
              onClick={() => onSubmitApproval("revise")}
              type="button"
            >
              需要调整
            </button>
            <button
              className="secondary"
              disabled={isPending}
              onClick={() => onSubmitApproval("reject")}
              type="button"
            >
              暂不继续
            </button>
          </div>
        </motion.section>
      ) : null}
    </AnimatePresence>
  );
}
