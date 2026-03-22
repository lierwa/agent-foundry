import fs from "node:fs";
import path from "node:path";
import type {
  PerfumeAgentCandidateSet,
  PerfumeAgentClarification,
  PerfumeAgentInput,
  PerfumeAgentIntention,
  PerfumeAgentOutput,
} from "./schemas.js";

function resolvePromptPath(filename: string) {
  const candidates = [
    path.resolve(path.dirname(new URL(import.meta.url).pathname), "prompts", filename),
    path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "src", "prompts", filename),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(`Missing prompt file: ${filename}`);
}

function loadPrompt(filename: string) {
  return fs.readFileSync(resolvePromptPath(filename), "utf8").trim();
}

function section(title: string, value: unknown) {
  return `## ${title}\n${JSON.stringify(value, null, 2)}`;
}

export function buildPlannerPrompt(input: PerfumeAgentInput, intention: PerfumeAgentIntention | null) {
  return [
    loadPrompt("planner.md"),
    section("当前输入", input),
    section("当前意向草案", intention),
  ].join("\n\n");
}

export function buildExecutorPrompt(
  input: PerfumeAgentInput,
  intention: PerfumeAgentIntention | null,
  candidatePool: PerfumeAgentCandidateSet | null,
  previousOutput: PerfumeAgentOutput | null,
) {
  return [
    loadPrompt("executor.md"),
    section("当前输入", input),
    section("当前意向草案", intention),
    section("候选池", candidatePool),
    section("上一次结构草案", previousOutput),
  ].join("\n\n");
}

export function buildReviewerPrompt(
  intention: PerfumeAgentIntention | null,
  clarification: PerfumeAgentClarification | null,
  output: PerfumeAgentOutput,
) {
  return [
    loadPrompt("reviewer.md"),
    section("当前意向草案", intention),
    section("待澄清问题", clarification),
    section("六层输出", output),
  ].join("\n\n");
}
