export const DEFAULT_STEM_ORDER = ["vocals", "drums", "bass", "other"] as const;

export type KnownStemName = (typeof DEFAULT_STEM_ORDER)[number];
export type StemName = KnownStemName | (string & {});

export type SpatialStemSettings = {
  volume: number;
  muted: boolean;
  solo: boolean;
  x: number;
  z: number;
};

export type SpatialPresetV1 = {
  version: 1;
  stems: Record<string, SpatialStemSettings>;
};

export type SpatialPresetName = "studio" | "live-room" | "cinema" | "focus-vocal";

export type BuiltInSpatialPreset = {
  name: SpatialPresetName;
  label: string;
  create: (stemNames: string[]) => SpatialPresetV1;
};

const DEFAULT_SETTINGS: SpatialStemSettings = {
  volume: 0.82,
  muted: false,
  solo: false,
  x: 0,
  z: 0,
};

const POSITION_LIMIT = 2;

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function numberOrDefault(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function boolOrDefault(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function normalizeStemSettings(value: unknown): SpatialStemSettings {
  const data = value && typeof value === "object" ? (value as Partial<SpatialStemSettings>) : {};
  return {
    volume: clamp(numberOrDefault(data.volume, DEFAULT_SETTINGS.volume), 0, 1),
    muted: boolOrDefault(data.muted, DEFAULT_SETTINGS.muted),
    solo: boolOrDefault(data.solo, DEFAULT_SETTINGS.solo),
    x: clamp(numberOrDefault(data.x, DEFAULT_SETTINGS.x), -POSITION_LIMIT, POSITION_LIMIT),
    z: clamp(numberOrDefault(data.z, DEFAULT_SETTINGS.z), -POSITION_LIMIT, POSITION_LIMIT),
  };
}

export function defaultStemSettings(stemName: string, index = 0, total: number = DEFAULT_STEM_ORDER.length): SpatialStemSettings {
  const byName: Record<string, Partial<SpatialStemSettings>> = {
    vocals: { volume: 0.88, x: 0, z: -1.35 },
    bass: { volume: 0.8, x: 0, z: 0 },
    drums: { volume: 0.76, x: 0, z: 1.35 },
    other: { volume: 0.7, x: 1.25, z: -0.25 },
  };

  if (byName[stemName]) return normalizeStemSettings({ ...DEFAULT_SETTINGS, ...byName[stemName] });

  const angle = total <= 1 ? 0 : (index / total) * Math.PI * 2;
  return normalizeStemSettings({
    ...DEFAULT_SETTINGS,
    x: Math.cos(angle) * 1.1,
    z: Math.sin(angle) * 1.1,
  });
}

export function createDefaultPreset(stemNames: string[] = [...DEFAULT_STEM_ORDER]): SpatialPresetV1 {
  return {
    version: 1,
    stems: Object.fromEntries(
      stemNames.map((stemName, index) => [stemName, defaultStemSettings(stemName, index, stemNames.length)]),
    ),
  };
}

export function mergePresetWithStems(
  preset: SpatialPresetV1 | null | undefined,
  stemNames: string[],
): SpatialPresetV1 {
  const fallback = createDefaultPreset(stemNames);
  if (!preset) return fallback;

  return {
    version: 1,
    stems: Object.fromEntries(
      stemNames.map((stemName) => [
        stemName,
        normalizeStemSettings({
          ...fallback.stems[stemName],
          ...preset.stems[stemName],
        }),
      ]),
    ),
  };
}

export function migratePreset(raw: unknown, stemNames: string[] = [...DEFAULT_STEM_ORDER]): SpatialPresetV1 {
  if (!raw) return createDefaultPreset(stemNames);

  let parsed = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return createDefaultPreset(stemNames);
    }
  }

  if (!parsed || typeof parsed !== "object") return createDefaultPreset(stemNames);
  const maybePreset = parsed as { version?: unknown; stems?: unknown };

  if (maybePreset.version === 1 && maybePreset.stems && typeof maybePreset.stems === "object") {
    return mergePresetWithStems(
      {
        version: 1,
        stems: Object.fromEntries(
          Object.entries(maybePreset.stems as Record<string, unknown>).map(([stemName, settings]) => [
            stemName,
            normalizeStemSettings(settings),
          ]),
        ),
      },
      stemNames,
    );
  }

  if (maybePreset.stems && typeof maybePreset.stems === "object") {
    return mergePresetWithStems(
      {
        version: 1,
        stems: Object.fromEntries(
          Object.entries(maybePreset.stems as Record<string, unknown>).map(([stemName, settings]) => [
            stemName,
            normalizeStemSettings(settings),
          ]),
        ),
      },
      stemNames,
    );
  }

  return createDefaultPreset(stemNames);
}

export function serializePreset(preset: SpatialPresetV1): string {
  const stemNames = Object.keys(preset.stems);
  return JSON.stringify(mergePresetWithStems(preset, stemNames), null, 2);
}

export function effectiveStemGain(settings: SpatialStemSettings, hasAnySolo: boolean): number {
  if (settings.muted) return 0;
  if (hasAnySolo && !settings.solo) return 0;
  return clamp(settings.volume, 0, 1);
}

export function effectiveGains(preset: SpatialPresetV1): Record<string, number> {
  const hasAnySolo = Object.values(preset.stems).some((settings) => settings.solo);
  return Object.fromEntries(
    Object.entries(preset.stems).map(([stemName, settings]) => [
      stemName,
      effectiveStemGain(settings, hasAnySolo),
    ]),
  );
}

function withPositions(stemNames: string[], positions: Record<string, Partial<SpatialStemSettings>>): SpatialPresetV1 {
  const fallback = createDefaultPreset(stemNames);
  return {
    version: 1,
    stems: Object.fromEntries(
      stemNames.map((stemName) => [
        stemName,
        normalizeStemSettings({
          ...fallback.stems[stemName],
          ...positions[stemName],
        }),
      ]),
    ),
  };
}

export const BUILT_IN_SPATIAL_PRESETS: BuiltInSpatialPreset[] = [
  {
    name: "studio",
    label: "Studio",
    create: (stemNames) =>
      withPositions(stemNames, {
        vocals: { x: 0, z: -1.35, volume: 0.9 },
        bass: { x: 0, z: -0.1, volume: 0.82 },
        drums: { x: 0, z: 1.25, volume: 0.78 },
        other: { x: 1.25, z: -0.2, volume: 0.72 },
      }),
  },
  {
    name: "live-room",
    label: "Live room",
    create: (stemNames) =>
      withPositions(stemNames, {
        vocals: { x: 0, z: -1.15, volume: 0.88 },
        bass: { x: -0.45, z: 0.2, volume: 0.8 },
        drums: { x: 0.65, z: 1.45, volume: 0.76 },
        other: { x: 1.45, z: 0.25, volume: 0.74 },
      }),
  },
  {
    name: "cinema",
    label: "Cinema",
    create: (stemNames) =>
      withPositions(stemNames, {
        vocals: { x: 0, z: -1.65, volume: 0.86 },
        bass: { x: 0, z: 0.35, volume: 0.86 },
        drums: { x: -1.25, z: 1.35, volume: 0.72 },
        other: { x: 1.45, z: 1.05, volume: 0.78 },
      }),
  },
  {
    name: "focus-vocal",
    label: "Focus vocal",
    create: (stemNames) =>
      withPositions(stemNames, {
        vocals: { x: 0, z: -1.8, volume: 1, solo: false },
        bass: { x: 0, z: 0.05, volume: 0.58 },
        drums: { x: -1.15, z: 1.15, volume: 0.48 },
        other: { x: 1.25, z: 0.75, volume: 0.52 },
      }),
  },
];

export function presetStorageKey(audioId: string): string {
  return `ai_spatial_preset:${audioId}`;
}
