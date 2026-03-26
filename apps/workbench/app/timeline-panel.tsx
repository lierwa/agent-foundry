"use client";

import { motion } from "framer-motion";
import { relativeTime, timelineBadge } from "./playground-adapter";
import type { InspectorFocus, PlaygroundTraceEvent, TimelineFilter } from "./playground-types";

const filters: TimelineFilter[] = ["all", "planning", "execution", "review", "approval", "errors"];

function label(filter: TimelineFilter) {
  switch (filter) {
    case "all":
      return "全部";
    case "planning":
      return "规划";
    case "execution":
      return "执行";
    case "review":
      return "审校";
    case "approval":
      return "审批";
    case "errors":
      return "异常";
  }
}

function prettifyEventType(value: string) {
  return value.replace(/\./g, " / ").replace(/_/g, " ");
}

const panelClass =
  "min-h-0 min-w-0 overflow-hidden rounded-[22px] border border-white/10 bg-[rgba(18,21,29,0.88)] shadow-[0_16px_48px_rgba(0,0,0,0.22)] backdrop-blur-xl";

export function TimelinePanel({
  collapsed,
  onInspectorFocusChange,
  onTimelineFilterChange,
  timeline,
  timelineFilter,
}: {
  collapsed: boolean;
  onInspectorFocusChange: (focus: InspectorFocus) => void;
  onTimelineFilterChange: (filter: TimelineFilter) => void;
  timeline: PlaygroundTraceEvent[];
  timelineFilter: TimelineFilter;
}) {
  if (collapsed) {
    return (
      <motion.aside
        animate={{ opacity: 1 }}
        className="flex min-h-0 items-center justify-center"
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      >
        <button className="h-9 w-9 rounded-xl border border-workbench-line-strong bg-workbench-accent-soft text-xs text-white" type="button">
          T
        </button>
      </motion.aside>
    );
  }

  return (
    <motion.aside
      animate={{ opacity: 1 }}
      className={`${panelClass} grid min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-3 p-4`}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
    >
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-workbench-accent">Timeline</p>
        <h3 className="mt-2 text-[2rem] font-semibold leading-none text-white">关键事件</h3>
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.map((filter) => (
          <button
            className={
              timelineFilter === filter
                ? "rounded-full border border-workbench-line-strong bg-workbench-accent-soft px-4 py-2 text-sm text-white"
                : "rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/85 transition hover:border-workbench-line-strong hover:bg-workbench-accent-soft/60"
            }
            key={filter}
            onClick={() => onTimelineFilterChange(filter)}
            type="button"
          >
            {label(filter)}
          </button>
        ))}
      </div>

      <div className="workbench-scrollbar min-h-0 overflow-auto">
        {timeline.length === 0 ? (
          <p className="text-base leading-7 text-white/55">当前没有事件。</p>
        ) : (
          <div className="grid gap-3">
            {timeline.map((event) => (
              <button
                className="grid gap-2 rounded-[20px] border border-white/10 bg-[#0a0d14]/75 p-4 text-left transition hover:border-workbench-line-strong hover:bg-[#111725]"
                key={event.id}
                onClick={() =>
                  onInspectorFocusChange({
                    type: "event",
                    label: `${event.nodeId} / ${event.eventType}`,
                    data: event,
                  })
                }
                type="button"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] text-white/70">
                    {timelineBadge(event)}
                  </span>
                  <span className="shrink-0 text-xs text-white/45">{relativeTime(event.timestamp)}</span>
                </div>
                <strong className="break-all text-sm font-semibold leading-6 text-white">
                  {prettifyEventType(event.eventType)}
                </strong>
                <p className="break-all text-sm leading-6 text-white/55">
                  {event.nodeId}
                  {event.model ? ` · ${event.model}` : ""}
                </p>
                {event.error ? (
                  <div className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-sm leading-6 text-rose-100">
                    {event.error}
                  </div>
                ) : null}
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.aside>
  );
}
