"use client";

import { motion } from "framer-motion";
import { buildInspectorData } from "./playground-adapter";
import type { InspectorFocus, InspectorTab, PlaygroundSession } from "./playground-types";

const tabs: Array<{ id: InspectorTab; label: string }> = [
  { id: "intention", label: "意图" },
  { id: "structure", label: "结构" },
  { id: "output", label: "结果" },
  { id: "memory", label: "记忆" },
];

const panelClass =
  "min-h-0 min-w-0 overflow-hidden rounded-[22px] border border-white/10 bg-[rgba(18,21,29,0.88)] shadow-[0_16px_48px_rgba(0,0,0,0.22)] backdrop-blur-xl";

export function InspectorPanel({
  activeTab,
  collapsed,
  inspectorFocus,
  onInspectorFocusChange,
  onTabChange,
  session,
}: {
  activeTab: InspectorTab;
  collapsed: boolean;
  inspectorFocus: InspectorFocus;
  onInspectorFocusChange: (focus: InspectorFocus) => void;
  onTabChange: (tab: InspectorTab) => void;
  session: PlaygroundSession | null;
}) {
  const data = buildInspectorData(session, activeTab);

  if (collapsed) {
    return (
      <motion.aside
        animate={{ opacity: 1 }}
        className="flex min-h-0 items-center justify-center"
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="grid gap-2">
          {tabs.map((tab) => (
            <button
              className={
                activeTab === tab.id
                  ? "h-9 w-9 rounded-xl border border-workbench-line-strong bg-workbench-accent-soft text-xs text-white"
                  : "h-9 w-9 rounded-xl border border-white/10 bg-white/5 text-xs text-white/70"
              }
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              type="button"
            >
              {tab.label.slice(0, 1)}
            </button>
          ))}
        </div>
      </motion.aside>
    );
  }

  return (
    <motion.aside
      animate={{ opacity: 1 }}
      className={`${panelClass} grid min-h-0 grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-3 p-4`}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-workbench-accent">Inspector</p>
          <h3 className="mt-2 text-[2rem] font-semibold leading-none text-white">JSON 状态</h3>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            className={
              activeTab === tab.id
                ? "rounded-full border border-workbench-line-strong bg-workbench-accent-soft px-4 py-2 text-sm text-white"
                : "rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/85 transition hover:border-workbench-line-strong hover:bg-workbench-accent-soft/60"
            }
            key={tab.id}
            onClick={() => {
              onTabChange(tab.id);
              onInspectorFocusChange({
                type: "task",
                label: tab.label,
                data: buildInspectorData(session, tab.id),
              });
            }}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      <section className="workbench-scrollbar min-h-0 overflow-auto rounded-[22px] border border-white/10 bg-[#070b12]/70 p-4">
        {data ? (
          <pre className="whitespace-pre-wrap break-words text-xs leading-6 text-slate-200">
            {JSON.stringify(data, null, 2)}
          </pre>
        ) : (
          <p className="text-base leading-7 text-white/55">当前没有可展示的数据。</p>
        )}
      </section>

      {inspectorFocus.type === "event" ? (
        <section className="max-h-[220px] overflow-hidden rounded-[20px] border border-white/10 bg-[#070b12]/70">
          <div className="border-b border-white/10 px-4 py-3 text-sm font-semibold text-white">
            聚焦事件
          </div>
          <div className="workbench-scrollbar max-h-[168px] overflow-auto p-4">
            <pre className="whitespace-pre-wrap break-words text-xs leading-6 text-slate-200">
              {JSON.stringify(inspectorFocus.data, null, 2)}
            </pre>
          </div>
        </section>
      ) : null}
    </motion.aside>
  );
}
