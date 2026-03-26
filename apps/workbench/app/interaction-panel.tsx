"use client";

import { AnimatePresence, motion } from "framer-motion";
import type {
  PlaygroundApprovalAction,
  PlaygroundApprovalViewModel,
} from "./playground-types";

const secondaryButtonClass =
  "rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white transition hover:border-workbench-line-strong hover:bg-workbench-accent-soft disabled:cursor-not-allowed disabled:opacity-50";

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
          className="grid gap-4 rounded-2xl border border-white/10 bg-gradient-to-b from-[#161a23] to-[#131821] p-4"
          exit={{ opacity: 0, y: 8, height: 0 }}
          initial={{ opacity: 0, y: 12, height: 0 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="grid gap-1.5">
            <span className="text-[11px] uppercase tracking-[0.18em] text-workbench-accent">
              {approvalConfig.nodeId === "planner" ? "Clarify" : "Confirm"}
            </span>
            <h3 className="text-lg font-semibold text-white">{approvalConfig.question}</h3>
            <p className="text-sm leading-6 text-white/60">{approvalConfig.reason}</p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {approvalConfig.contextCards.map((card) => (
              <div
                className="grid gap-1.5 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3"
                key={card.label}
              >
                <span className="text-xs tracking-[0.06em] text-white/80">{card.label}</span>
                <p className="text-sm leading-6 text-white/60">{card.body}</p>
              </div>
            ))}
          </div>

          {approvalConfig.options.length ? (
            <div className="grid gap-3">
              {approvalConfig.options.map((option) => {
                const checked = approvalSelection.includes(option.value);
                return (
                  <label
                    className={
                      checked
                        ? "flex items-center gap-3 rounded-2xl border border-workbench-line-strong bg-workbench-accent-soft/70 px-4 py-3"
                        : "flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3"
                    }
                    key={option.value}
                  >
                    <input
                      checked={checked}
                      className="h-4 w-4 accent-[#58a6ff]"
                      onChange={(event) => {
                        if (approvalConfig.multiple) {
                          onApprovalSelectionChange(
                            event.target.checked
                              ? [...approvalSelection, option.value]
                              : approvalSelection.filter((item) => item !== option.value),
                          );
                          return;
                        }

                        onApprovalSelectionChange(event.target.checked ? [option.value] : []);
                      }}
                      type={approvalConfig.multiple ? "checkbox" : "radio"}
                    />
                    <span className="text-sm leading-6 text-white">{option.label}</span>
                  </label>
                );
              })}
            </div>
          ) : null}

          {approvalConfig.allowsFreeText ? (
            <textarea
              className="min-h-[96px] rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/30 focus:border-workbench-line-strong"
              onChange={(event) => onApprovalNoteChange(event.target.value)}
              placeholder="补充更细的方向、限制条件或修改建议。"
              value={approvalNote}
            />
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button
              className="rounded-xl bg-gradient-to-r from-[#58a6ff] to-[#3b82f6] px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isPending}
              onClick={() => onSubmitApproval("approve")}
              type="button"
            >
              确认继续
            </button>
            <button
              className={secondaryButtonClass}
              disabled={isPending}
              onClick={() => onSubmitApproval("revise")}
              type="button"
            >
              需要调整
            </button>
            <button
              className={secondaryButtonClass}
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
