import type { ToolDefinition } from "@agent-foundry/core";
import type { PerfumeAgentCandidateSet, PerfumeAgentIntention, PerfumeAgentOutput } from "../schemas.js";

function pickUnique(items: string[]) {
  return [...new Set(items)].slice(0, 8);
}

export function composeStructureLayers(input: {
  intention: PerfumeAgentIntention;
  candidatePool: PerfumeAgentCandidateSet;
}): PerfumeAgentOutput {
  const { intention, candidatePool } = input;
  const body = candidatePool.middle
    .filter((item) =>
      intention.expressive_pool.length === 0
        ? true
        : intention.expressive_pool.some((token) => item.name.includes(token) || item.families.some((family) => family.includes(token))),
    )
    .slice(0, 2)
    .map((item) => item.id);
  const structure = candidatePool.base
    .filter((item) => (item.structural_power ?? 0) >= 0.5 || item.category === "base")
    .slice(0, 3)
    .map((item) => item.id);
  const impact = candidatePool.top
    .filter((item) => item.impact_level === "high" || item.volatility === "high")
    .slice(0, 1)
    .map((item) => item.id);
  const buffer = impact.length > 0
    ? candidatePool.middle
        .filter((item) => item.impact_level !== "high")
        .slice(0, 1)
        .map((item) => item.id)
    : [];
  const bridge =
    body.length > 0 && structure.length > 0
      ? candidatePool.middle
          .filter((item) => !body.includes(item.id))
          .slice(0, 1)
          .map((item) => item.id)
      : [];
  const fix =
    structure.length === 0
      ? candidatePool.base.slice(0, 1).map((item) => item.id)
      : [];

  return {
    output: {
      Impact: pickUnique(impact),
      Buffer: pickUnique(buffer),
      Body: pickUnique(body),
      Bridge: pickUnique(bridge),
      Structure: pickUnique(structure),
      Fix: pickUnique(fix),
    },
  };
}

export const composeStructureLayersTool: ToolDefinition = {
  id: "compose_structure_layers",
  description: "将意向对象和候选池组装为六层结构输出。",
  async invoke(input) {
    return composeStructureLayers(input as { intention: PerfumeAgentIntention; candidatePool: PerfumeAgentCandidateSet });
  },
};
