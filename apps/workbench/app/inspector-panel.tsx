"use client";

import { motion } from "framer-motion";
import { buildInspectorData } from "./playground-adapter";
import type { InspectorFocus, InspectorTab, PlaygroundSession } from "./playground-types";

const tabs: Array<{ id: InspectorTab; label: string }> = [
  { id: "intention", label: "Intention" },
  { id: "structure", label: "Structure" },
  { id: "output", label: "Output" },
  { id: "memory", label: "Memory" },
];

export function InspectorPanel({
  activeTab,
  collapsed,
  inspectorFocus,
  onInspectorFocusChange,
  onTabChange,
  onToggle,
  session,
}: {
  activeTab: InspectorTab;
  collapsed: boolean;
  inspectorFocus: InspectorFocus;
  onInspectorFocusChange: (focus: InspectorFocus) => void;
  onTabChange: (tab: InspectorTab) => void;
  onToggle: () => void;
  session: PlaygroundSession | null;
}) {
  const data = buildInspectorData(session, activeTab);

  return (
    <motion.aside
      animate={{ width: collapsed ? 42 : 320, opacity: 1 }}
      className={collapsed ? "side-dock inspector-dock collapsed" : "side-dock inspector-dock"}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="side-dock-top">
        {!collapsed ? (
          <div>
            <p className="side-dock-kicker">Inspector</p>
            <h3>JSON 状态</h3>
          </div>
        ) : (
          <div />
        )}
        <button className="side-dock-toggle" onClick={onToggle} type="button">
          {collapsed ? "›" : "‹"}
        </button>
      </div>

      {!collapsed ? (
        <>
          <div className="side-dock-tabs">
            {tabs.map((tab) => (
              <button
                className={activeTab === tab.id ? "side-dock-tab is-active" : "side-dock-tab"}
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

          <section className="side-dock-panel">
            {data ? <pre className="side-json">{JSON.stringify(data, null, 2)}</pre> : <p className="side-empty">当前没有可展示的数据。</p>}
          </section>

          {inspectorFocus.type === "event" ? (
            <section className="side-dock-panel compact">
              <div className="side-dock-panel-header">
                <strong>Focused Event</strong>
              </div>
              <pre className="side-json">{JSON.stringify(inspectorFocus.data, null, 2)}</pre>
            </section>
          ) : null}
        </>
      ) : (
        <div className="side-dock-rail">
          {tabs.map((tab) => (
            <button className={activeTab === tab.id ? "side-dock-rail-button is-active" : "side-dock-rail-button"} key={tab.id} onClick={() => onTabChange(tab.id)} type="button">
              {tab.label.slice(0, 1)}
            </button>
          ))}
        </div>
      )}
    </motion.aside>
  );
}
