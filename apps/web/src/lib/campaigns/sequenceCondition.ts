// Mirrors conditionPasses()/normalize() in apps/api's sequenceService.ts exactly - both engines
// must agree on how a CONDITION step's stored body JSON is interpreted, since a lead's enrollment
// can be advanced by either worker against the same database.
export type SequenceConditionConfig = {
  leadStatusIn?: string[];
  leadStatusNotIn?: string[];
  pipelineStateIn?: string[];
  pipelineStateNotIn?: string[];
  hasEmail?: boolean;
};

function normalize(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function safeJsonObject(value: string | null | undefined): SequenceConditionConfig {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function evaluateSequenceCondition(step: { body?: string | null }, lead: { email?: string | null; status?: string | null; pipelineState?: string | null }): boolean {
  const config = safeJsonObject(step?.body);
  const status = normalize(lead?.status);
  const pipelineState = normalize(lead?.pipelineState);

  if (config.hasEmail === true && !lead?.email) return false;
  if (config.hasEmail === false && lead?.email) return false;
  if (config.leadStatusIn?.length && !config.leadStatusIn.map(normalize).includes(status)) return false;
  if (config.leadStatusNotIn?.map(normalize).includes(status)) return false;
  if (config.pipelineStateIn?.length && !config.pipelineStateIn.map(normalize).includes(pipelineState)) return false;
  if (config.pipelineStateNotIn?.map(normalize).includes(pipelineState)) return false;

  return true;
}
