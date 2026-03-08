import type { BossPhaseDef, StageDef } from "@shared/index";

export const BOSS_PHASES: BossPhaseDef[] = [
  { threshold: 0.66, fireIntervalMs: 950 },
  { threshold: 0.33, fireIntervalMs: 700 },
  { threshold: 0, fireIntervalMs: 460 }
];

const makeStage = (id: string, label: string, laneOffset: number): StageDef => ({
  id,
  label,
  durationMs: 24000,
  bossId: `${id}-boss`,
  waves: [
    { id: `${id}-wave-1`, timeMs: 1500, kind: "fighter", lane: laneOffset % 6, count: 4, spacingMs: 280 },
    { id: `${id}-wave-2`, timeMs: 4500, kind: "fighter", lane: (laneOffset + 2) % 6, count: 5, spacingMs: 220 },
    { id: `${id}-wave-3`, timeMs: 8000, kind: "heavy", lane: (laneOffset + 1) % 6, count: 2, spacingMs: 1200 },
    { id: `${id}-wave-4`, timeMs: 11500, kind: "kamikaze", lane: (laneOffset + 4) % 6, count: 6, spacingMs: 180 },
    { id: `${id}-wave-5`, timeMs: 15500, kind: "fighter", lane: (laneOffset + 3) % 6, count: 6, spacingMs: 200 },
    { id: `${id}-wave-6`, timeMs: 19500, kind: "heavy", lane: (laneOffset + 5) % 6, count: 3, spacingMs: 900 }
  ]
});

export const CAMPAIGN_STAGES: StageDef[] = [
  makeStage("stage-1", "Nebula Run", 0),
  makeStage("stage-2", "Carrier Graveyard", 1),
  makeStage("stage-3", "Solar Gate", 2)
];
