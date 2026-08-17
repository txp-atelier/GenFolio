/** Buckets a person's distance from "you" (see computeGenerationDepths) into
 * one of six generation groups. Every group gets a color, a plain-language
 * label, and an icon in the UI together — color is always a supporting cue,
 * never the only way to tell people apart. */
export type GenerationBucket = "self" | "peer" | "up1" | "up2" | "down1" | "down2";

export function bucketForDepth(depth: number, isSelf: boolean): GenerationBucket {
  if (isSelf) return "self";
  if (depth <= -2) return "up2";
  if (depth === -1) return "up1";
  if (depth === 0) return "peer";
  if (depth === 1) return "down1";
  return "down2";
}

export const GENERATION_LABEL: Record<GenerationBucket, string> = {
  self: "You",
  peer: "Your generation",
  up1: "Parents' generation",
  up2: "Grandparents' generation",
  down1: "Children's generation",
  down2: "Grandchildren's generation",
};

export const GENERATION_COLOR_VAR: Record<GenerationBucket, string> = {
  self: "gen-self",
  peer: "gen-peer",
  up1: "gen-up1",
  up2: "gen-up2",
  down1: "gen-down1",
  down2: "gen-down2",
};
