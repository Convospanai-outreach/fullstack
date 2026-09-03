export interface WeightedVariant {
  id: string;
  subject: string;
  body: string;
  weight: number;
}

export function pickWeightedVariant<T extends WeightedVariant>(variants: T[]): T | null {
  if (variants.length === 0) return null;
  const totalWeight = variants.reduce((sum, v) => sum + Math.max(0, v.weight), 0);
  if (totalWeight <= 0) return variants[Math.floor(Math.random() * variants.length)] as T;

  let roll = Math.random() * totalWeight;
  for (const variant of variants) {
    roll -= Math.max(0, variant.weight);
    if (roll <= 0) return variant;
  }
  return variants[variants.length - 1] as T;
}
