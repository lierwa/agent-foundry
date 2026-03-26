"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import type { PlaygroundModelOption } from "./playground-types";

function ChevronIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 16 16">
      <path
        d="M4.25 6.5 8 10.25 11.75 6.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 16 16">
      <path
        d="M3.75 8.25 6.5 11l5.75-6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function ModelSelect({
  models,
  value,
  onValueChange,
}: {
  models: PlaygroundModelOption[];
  value: string;
  onValueChange: (value: string) => void;
}) {
  if (models.length === 0) {
    return null;
  }

  const activeModel = models.find((model) => model.id === value) ?? null;

  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger
        className="inline-flex min-w-[220px] items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-xs text-white transition hover:border-workbench-line-strong hover:bg-workbench-accent-soft/70 data-[state=open]:border-workbench-line-strong data-[state=open]:bg-workbench-accent-soft/70"
        type="button"
      >
        <span className="truncate">{activeModel?.label ?? "请选择模型"}</span>
        <ChevronIcon />
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          className="z-50 min-w-[260px] rounded-2xl border border-white/10 bg-[#12161f]/95 p-2 text-sm text-white shadow-2xl backdrop-blur"
          sideOffset={10}
        >
          <DropdownMenu.RadioGroup onValueChange={onValueChange} value={value}>
            {models.map((model) => (
              <DropdownMenu.RadioItem
                className="flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5 outline-none transition data-[highlighted]:bg-workbench-accent-soft/80"
                key={model.id}
                value={model.id}
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-white">{model.label}</div>
                  <div className="truncate text-xs text-white/45">
                    {model.provider} / {model.model}
                  </div>
                </div>
                <DropdownMenu.ItemIndicator className="flex h-4 w-4 items-center justify-center text-workbench-accent">
                  <CheckIcon />
                </DropdownMenu.ItemIndicator>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
