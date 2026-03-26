"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { PlanListItem } from "./playground-types";

function planTone(status: PlanListItem["status"]) {
  if (status === "done") return "bg-workbench-success";
  if (status === "ready") return "bg-workbench-accent";
  if (status === "blocked") return "bg-workbench-danger";
  return "bg-white/25";
}

export function PlanPanel({
  items,
  collapsed,
  onToggle,
}: {
  items: PlanListItem[];
  collapsed: boolean;
  onToggle: () => void;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <motion.section
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-2xl border border-white/10 bg-[#10141c]/95"
      initial={{ opacity: 0, y: 10 }}
      layout
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
    >
      <button
        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left"
        onClick={onToggle}
        type="button"
      >
        <div className="min-w-0">
          <span className="text-[11px] uppercase tracking-[0.18em] text-workbench-accent">
            Plan
          </span>
          <div className="mt-1 text-sm font-semibold text-white">当前规划任务</div>
        </div>
        <span className="inline-flex items-center gap-2 text-sm text-white/55">
          {items.length} 项
          <span
            aria-hidden="true"
            className={collapsed ? "transition-transform" : "rotate-180 transition-transform"}
          >
            ^
          </span>
        </span>
      </button>

      <AnimatePresence initial={false}>
        {!collapsed ? (
          <motion.div
            animate={{ opacity: 1, height: "auto" }}
            className="grid gap-2 px-3 pb-3"
            exit={{ opacity: 0, height: 0 }}
            initial={{ opacity: 0, height: 0 }}
          >
            {items.map((item) => (
              <article
                className={
                  item.isActive
                    ? "grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-xl border border-workbench-line-strong bg-workbench-accent-soft/70 px-3 py-2.5"
                    : "grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5"
                }
                key={item.id}
              >
                <span
                  className={`h-2.5 w-2.5 rounded-full ${planTone(item.status)} ${item.isActive ? "shadow-[0_0_0_5px_rgba(88,166,255,0.12)]" : ""}`}
                />
                <span className="min-w-0 text-sm leading-5 text-white">{item.title}</span>
              </article>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.section>
  );
}
