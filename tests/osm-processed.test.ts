import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { pointInPolygonGeometry } from "@/lib/spatial";
import adminCollection from "@/data/spatial/lagos-administrative.json";

const dir = join(process.cwd(), "data", "spatial", "processed");
const read = (f: string) => JSON.parse(readFileSync(join(dir, f), "utf8"));
const meta = read("osm-processed.metadata.json");
const state = (adminCollection as { features: Array<{ properties: { admin_level: string }; geometry: unknown }> }).features.find(
  (f) => f.properties.admin_level === "ADM1",
)!;

describe("processed OSM layers", () => {
  const layers = ["osm-health-facilities", "osm-marine-access", "osm-waterways"] as const;

  it("metadata declares ODbL licence and OpenStreetMap attribution", () => {
    expect(meta.license).toMatch(/ODbL/i);
    expect(meta.attribution).toMatch(/OpenStreetMap/i);
  });

  for (const id of layers) {
    describe(id, () => {
      const fc = read(`${id}.geojson`);

      it("is a FeatureCollection whose count matches its metadata", () => {
        expect(fc.type).toBe("FeatureCollection");
        expect(fc.features.length).toBe(meta.layers[id].featureCount);
      });

      it("every feature carries OSM provenance and is not marked field-verified", () => {
        for (const feature of fc.features) {
          expect(typeof feature.properties.osm_id).toBe("string");
          expect(feature.properties.source).toMatch(/OpenStreetMap/);
          expect(feature.properties.field_verified).toBe(false);
          expect(feature.properties.source_tags).toBeTypeOf("object");
        }
      });

      it("has no duplicate OSM ids", () => {
        const ids = fc.features.map((f: { properties: { osm_id: string } }) => f.properties.osm_id);
        expect(new Set(ids).size).toBe(ids.length);
      });

      it("unnamed features are labelled, never given an invented name", () => {
        for (const feature of fc.features) {
          if (!feature.properties.named) {
            expect(feature.properties.name).toMatch(/^Unnamed \(OSM /);
          }
        }
      });

      it("all point geometry sits inside the Lagos State polygon", () => {
        for (const feature of fc.features) {
          if (feature.geometry.type !== "Point") continue;
          expect(
            pointInPolygonGeometry(
              feature.geometry.coordinates as [number, number],
              state.geometry as Parameters<typeof pointInPolygonGeometry>[1],
            ),
          ).toBe(true);
        }
      });
    });
  }

  it("marine and waterway layers never assert navigability", () => {
    for (const id of ["osm-marine-access", "osm-waterways"] as const) {
      for (const feature of read(`${id}.geojson`).features) {
        expect(feature.properties.navigability).toBe("unknown");
      }
    }
  });
});
