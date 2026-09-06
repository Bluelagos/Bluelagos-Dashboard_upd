import { describe, expect, it, vi } from "vitest";
import { updateCommunityMap } from "@/components/community-map";
import type { CommunityFeatureCollection } from "@/lib/geo";

const empty: CommunityFeatureCollection = { type: "FeatureCollection", features: [] };

describe("MapLibre source lifecycle", () => {
  it("creates a missing source and layers once", () => {
    const map = { getSource: vi.fn(), addSource: vi.fn(), getLayer: vi.fn(), addLayer: vi.fn() };
    updateCommunityMap(map as unknown as import("maplibre-gl").Map, empty);
    expect(map.addSource).toHaveBeenCalledOnce();
    expect(map.addLayer).toHaveBeenCalledTimes(2);
  });
  it("updates existing GeoJSON without recreating source or layers", () => {
    const source = { setData: vi.fn() };
    const map = { getSource: vi.fn(() => source), addSource: vi.fn(), getLayer: vi.fn(() => ({})), addLayer: vi.fn() };
    updateCommunityMap(map as unknown as import("maplibre-gl").Map, empty);
    expect(source.setData).toHaveBeenCalledWith(empty);
    expect(map.addSource).not.toHaveBeenCalled();
    expect(map.addLayer).not.toHaveBeenCalled();
  });
});
