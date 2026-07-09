import { describe, expect, it } from "vitest";

import {
  BUILT_IN_SPATIAL_PRESETS,
  DEFAULT_STEM_ORDER,
  createDefaultPreset,
  effectiveGains,
  migratePreset,
  serializePreset,
  type SpatialPresetV1,
} from "./spatial-presets";

describe("spatial presets", () => {
  it("serializes presets as normalized versioned JSON", () => {
    const preset: SpatialPresetV1 = {
      version: 1,
      stems: {
        vocals: { volume: 2, muted: false, solo: false, x: 99, z: -99 },
      },
    };

    const parsed = JSON.parse(serializePreset(preset)) as SpatialPresetV1;

    expect(parsed.version).toBe(1);
    expect(parsed.stems.vocals.volume).toBe(1);
    expect(parsed.stems.vocals.x).toBe(2);
    expect(parsed.stems.vocals.z).toBe(-2);
  });

  it("migrates invalid or partial stored data into a complete preset", () => {
    const preset = migratePreset(
      JSON.stringify({
        stems: {
          vocals: { volume: 0.5, muted: true, x: -1.2 },
        },
      }),
      ["vocals", "drums"],
    );

    expect(preset.version).toBe(1);
    expect(preset.stems.vocals.volume).toBe(0.5);
    expect(preset.stems.vocals.muted).toBe(true);
    expect(preset.stems.drums).toBeDefined();
    expect(migratePreset("not json", ["vocals"]).stems.vocals).toBeDefined();
  });

  it("applies mute and solo gain precedence", () => {
    const preset: SpatialPresetV1 = {
      version: 1,
      stems: {
        vocals: { volume: 0.8, muted: false, solo: true, x: 0, z: 0 },
        drums: { volume: 0.7, muted: false, solo: false, x: 0, z: 0 },
        bass: { volume: 0.6, muted: true, solo: true, x: 0, z: 0 },
      },
    };

    expect(effectiveGains(preset)).toEqual({
      vocals: 0.8,
      drums: 0,
      bass: 0,
    });
  });

  it("ships valid built-in presets for the expected stems", () => {
    const expectedStems = [...DEFAULT_STEM_ORDER];
    const defaultPreset = createDefaultPreset(expectedStems);

    expect(Object.keys(defaultPreset.stems)).toEqual(expectedStems);
    expect(BUILT_IN_SPATIAL_PRESETS.map((preset) => preset.name)).toEqual([
      "studio",
      "live-room",
      "cinema",
      "focus-vocal",
    ]);

    for (const preset of BUILT_IN_SPATIAL_PRESETS) {
      const created = preset.create(expectedStems);
      expect(Object.keys(created.stems)).toEqual(expectedStems);
      for (const settings of Object.values(created.stems)) {
        expect(settings.volume).toBeGreaterThanOrEqual(0);
        expect(settings.volume).toBeLessThanOrEqual(1);
        expect(settings.x).toBeGreaterThanOrEqual(-2);
        expect(settings.x).toBeLessThanOrEqual(2);
        expect(settings.z).toBeGreaterThanOrEqual(-2);
        expect(settings.z).toBeLessThanOrEqual(2);
      }
    }
  });
});
