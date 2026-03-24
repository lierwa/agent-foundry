"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import type { PlaygroundModelOption } from "./playground-types";

function ChevronIcon() {
  return (
    <svg aria-hidden="true" className="model-select-icon" viewBox="0 0 16 16">
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
    <svg aria-hidden="true" className="model-select-check" viewBox="0 0 16 16">
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

  const activeModel = models.find((model) => model.id === value) ?? models[0];

  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger className="model-select-trigger" type="button">
        <span>{activeModel?.label ?? "选择模型"}</span>
        <ChevronIcon />
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content align="start" className="model-select-content" sideOffset={10}>
          <DropdownMenu.RadioGroup onValueChange={onValueChange} value={activeModel?.id}>
            {models.map((model) => (
              <DropdownMenu.RadioItem className="model-select-item" key={model.id} value={model.id}>
                <span>{model.label}</span>
                <DropdownMenu.ItemIndicator className="model-select-item-indicator">
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
