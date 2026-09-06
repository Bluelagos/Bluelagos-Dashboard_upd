import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const outputDirectory = resolve(root, "data/spatial");
const APIs = {
  ADM1: "https://www.geoboundaries.org/api/current/gbOpen/NGA/ADM1/",
  ADM2: "https://www.geoboundaries.org/api/current/gbOpen/NGA/ADM2/",
};

async function getJson(url, label) {
  const response = await fetch(url, {
    headers: { "user-agent": "Blue-Lagos-spatial-pipeline/1.0" },
  });
  if (!response.ok) throw new Error(`${label} request failed (${response.status}).`);
  return response.json();
}

function visitCoordinates(value, visit) {
  if (typeof value?.[0] === "number") visit(value);
  else for (const child of value ?? []) visitCoordinates(child, visit);
}

function bounds(geometry) {
  const box = [Infinity, Infinity, -Infinity, -Infinity];
  visitCoordinates(geometry.coordinates, ([x, y]) => {
    box[0] = Math.min(box[0], x);
    box[1] = Math.min(box[1], y);
    box[2] = Math.max(box[2], x);
    box[3] = Math.max(box[3], y);
  });
  return box;
}

function pointInRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function pointInGeometry(point, geometry) {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polygons.some(
    (polygon) => pointInRing(point, polygon[0]) && !polygon.slice(1).some((hole) => pointInRing(point, hole)),
  );
}

function validateFeature(feature, label) {
  if (!feature?.geometry || !["Polygon", "MultiPolygon"].includes(feature.geometry.type)) {
    throw new Error(`${label} is not Polygon/MultiPolygon geometry.`);
  }
  const box = bounds(feature.geometry);
  if (!box.every(Number.isFinite) || box[0] < -180 || box[2] > 180 || box[1] < -90 || box[3] > 90) {
    throw new Error(`${label} has invalid WGS84 coordinates.`);
  }
}

function normalize(feature, level, source) {
  const name = String(feature.properties.shapeName);
  return {
    type: "Feature",
    geometry: feature.geometry,
    properties: {
      layer_id: level === "ADM1" ? "lagos-state" : `lga-${name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replaceAll(/^-|-$/g, "")}`,
      name,
      admin_level: level,
      source_id: feature.properties.shapeID ?? null,
      source: source.boundarySource,
      source_year: source.boundaryYearRepresented,
      confidence: "Reputable open administrative dataset; not cadastral",
    },
  };
}

async function run() {
  const retrievedAt = new Date().toISOString();
  const [adm1Meta, adm2Meta] = await Promise.all([
    getJson(APIs.ADM1, "ADM1 metadata"),
    getJson(APIs.ADM2, "ADM2 metadata"),
  ]);
  const [states, allLgas] = await Promise.all([
    getJson(adm1Meta.simplifiedGeometryGeoJSON, "ADM1 geometry"),
    getJson(adm2Meta.simplifiedGeometryGeoJSON, "ADM2 geometry"),
  ]);
  const lagos = states.features.find(
    (feature) => String(feature.properties?.shapeName).trim().toLowerCase() === "lagos",
  );
  if (!lagos) throw new Error("Lagos State was not found in the ADM1 source.");
  validateFeature(lagos, "Lagos State");
  const lagosLgas = allLgas.features.filter((feature) => {
    const box = bounds(feature.geometry);
    return pointInGeometry([(box[0] + box[2]) / 2, (box[1] + box[3]) / 2], lagos.geometry);
  });
  if (lagosLgas.length !== 20) {
    throw new Error(`Expected 20 Lagos LGAs after polygon containment; found ${lagosLgas.length}. Source change requires review.`);
  }
  for (const feature of lagosLgas) validateFeature(feature, `LGA ${feature.properties?.shapeName ?? "unknown"}`);
  const collection = {
    type: "FeatureCollection",
    name: "Lagos administrative boundaries",
    crs: { type: "name", properties: { name: "urn:ogc:def:crs:OGC:1.3:CRS84" } },
    features: [normalize(lagos, "ADM1", adm1Meta), ...lagosLgas.map((feature) => normalize(feature, "ADM2", adm2Meta))],
  };
  const metadata = {
    id: "lagos-administrative-boundaries",
    title: "Lagos State and LGA boundaries",
    provider: adm1Meta.boundarySource,
    distributor: "geoBoundaries gbOpen",
    source: adm1Meta.boundarySourceURL,
    sourceApi: APIs.ADM1,
    sourceGeometry: [adm1Meta.simplifiedGeometryGeoJSON, adm2Meta.simplifiedGeometryGeoJSON],
    sourceDate: adm1Meta.sourceDataUpdateDate,
    boundaryYear: adm1Meta.boundaryYearRepresented,
    retrievedAt,
    license: adm1Meta.boundaryLicense,
    geometryType: "Polygon/MultiPolygon",
    crs: "OGC:CRS84 (WGS84 longitude/latitude)",
    featureCount: collection.features.length,
    processing: "Selected Lagos ADM1 by source name; selected ADM2 features whose extent centre falls inside Lagos ADM1; retained simplified source geometry; validated geometry types and coordinate ranges.",
    limitations: "Open administrative planning context. Not cadastral. Spatial selection is guarded by an expected count of 20 and requires review if the source changes.",
    confidence: "High for state/LGA planning context",
  };
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(resolve(outputDirectory, "lagos-administrative.json"), `${JSON.stringify(collection)}\n`),
    writeFile(resolve(outputDirectory, "lagos-administrative.metadata.json"), `${JSON.stringify(metadata, null, 2)}\n`),
  ]);
  console.log(`Validated ${collection.features.length} administrative features (1 state, ${lagosLgas.length} LGAs).`);
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
