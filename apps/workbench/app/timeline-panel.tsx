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
  return (
    <motion.aside
      animate={{ width: collapsed ? 42 : 320, opacity: 1 }}
      className={collapsed ? "side-dock timeline-dock collapsed" : "side-dock timeline-dock timeline"}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="side-dock-top">
        {!collapsed ? (
          <div>
            <p className="side-dock-kicker">Timeline</p>
            <h3>关键事件</h3>
          </div>
        ) : (
          <div />
        )}
        <div />
      </div>

      {!collapsed ? (
        <>
          <div className="timeline-filter-row">
            {filters.map((filter) => (
              <button
                className={timelineFilter === filter ? "timeline-filter-chip is-active" : "timeline-filter-chip"}
                key={filter}
                onClick={() => onTimelineFilterChange(filter)}
                type="button"
              >
                {label(filter)}
              </button>
            ))}
          </div>

          <div className="timeline-stack">
            {timeline.length === 0 ? (
              <p className="side-empty">当前没有事件。</p>
            ) : (
              timeline.map((event) => (
                <button
                  className="timeline-event"
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
                  <div className="timeline-event-top">
                    <span className="timeline-event-badge">{timelineBadge(event)}</span>
                    <span className="timeline-event-time">{relativeTime(event.timestamp)}</span>
                  </div>
                  <strong>{event.eventType}</strong>
                  <p>{event.nodeId}{event.model ? ` · ${event.model}` : ""}</p>
                </button>
              ))
            )}
          </div>
        </>
      ) : (
        <div className="side-dock-rail">
          <button className="side-dock-rail-button is-active" type="button">
            T
          </button>
        </div>
      )}
    </motion.aside>
  );
}
