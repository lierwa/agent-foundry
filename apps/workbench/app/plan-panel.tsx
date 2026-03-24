"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { PlanListItem } from "./playground-types";

function planTone(status: PlanListItem["status"]) {
  if (status === "done") return "done";
  if (status === "ready") return "active";
  if (status === "blocked") return "blocked";
  return "pending";
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
      className="plan-panel"
      initial={{ opacity: 0, y: 10 }}
      layout
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
    >
      <button className="plan-panel-toggle" onClick={onToggle} type="button">
        <div>
          <span className="plan-panel-kicker">Plan</span>
          <strong>当前规划任务</strong>
        </div>
        <span className="plan-panel-toggle-meta">
          {items.length} 项
          <span aria-hidden="true" className={collapsed ? "plan-caret" : "plan-caret is-open"}>
            ^
          </span>
        </span>
      </button>

      <AnimatePresence initial={false}>
        {!collapsed ? (
          <motion.div
            animate={{ opacity: 1, height: "auto" }}
            className="plan-panel-body"
            exit={{ opacity: 0, height: 0 }}
            initial={{ opacity: 0, height: 0 }}
          >
            {items.map((item) => (
              <article className={item.isActive ? "plan-line is-active" : "plan-line"} key={item.id}>
                <span className={`plan-line-dot tone-${planTone(item.status)}`} />
                <span className="plan-line-title">{item.title}</span>
              </article>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.section>
  );
}
