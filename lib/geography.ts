import type { SenatorialDistrict } from "./domain";

const aliases: Record<string, string> = {
  "AMUWO-ODOFIN": "AMUWO ODOFIN",
  "AGBADO-OKE-ODO": "AGBADO OKE-ODO",
  "AJEROMI IFELODUN": "AJEROMI-IFELODUN",
  "AYOBO IPAJA": "AYOBO-IPAJA",
  "ETI-OSA": "ETI OSA",
  "IBEJU-LEKKI": "IBEJU LEKKI",
  "IFAKO IJAIYE": "IFAKO-IJAIYE",
  "IFAKO/IJAIYE": "IFAKO-IJAIYE",
  "IFAKO IJAYE": "IFAKO-IJAIYE",
  "LAGOS-MAINLAND": "LAGOS MAINLAND",
  "OSHODI ISOLO": "OSHODI-ISOLO",
  "OSHODI/ISOLO": "OSHODI-ISOLO",
  SHOMOLU: "SOMOLU",
};

export function normalizeLga(value: string): string {
  const normalized = value.trim().toUpperCase().replace(/[/_]/g, " ").replace(/\s+/g, " ");
  return aliases[normalized] ?? normalized;
}

export const LGA_TO_DISTRICT: Readonly<Record<string, SenatorialDistrict>> = {
  AGEGE: "Lagos West", "AGBADO OKE-ODO": "Lagos West", "AJEROMI-IFELODUN": "Lagos West", ALIMOSHO: "Lagos West",
  "AMUWO ODOFIN": "Lagos West", "AYOBO-IPAJA": "Lagos West", BADAGRY: "Lagos West", "EGBE-IDIMU": "Lagos West",
  EJIGBO: "Lagos West", IBA: "Lagos West", "IFAKO-IJAIYE": "Lagos West", IKEJA: "Lagos West", "IGANDO-IKOTUN": "Lagos West",
  IFELODUN: "Lagos West", ISOLO: "Lagos West", MUSHIN: "Lagos West", "MOSAN-OKUNOLA": "Lagos West",
  "ODI-OLOWO/OJUWOYE": "Lagos West", OJO: "Lagos West", OJODU: "Lagos West", OJOKORO: "Lagos West",
  "ORILE-AGEGE": "Lagos West", ORIADE: "Lagos West", "OSHODI-ISOLO": "Lagos West", "OTO-AWORI": "Lagos West",
  APAPA: "Lagos Central", "COKER-AGUDA": "Lagos Central", "ETI OSA": "Lagos Central", "ITIRE-IKATE": "Lagos Central",
  "LAGOS ISLAND": "Lagos Central", "LAGOS MAINLAND": "Lagos Central", SURULERE: "Lagos Central", YABA: "Lagos Central",
  BARIGA: "Lagos East", EPE: "Lagos East", EREDO: "Lagos East", "IBEJU LEKKI": "Lagos East", IGBOGBO: "Lagos East",
  "IGBOGBO-BAYEKU": "Lagos East", IJEDE: "Lagos East", IKORODU: "Lagos East", "IKORODU NORTH": "Lagos East",
  "IKORODU WEST": "Lagos East", IMOTA: "Lagos East", KOSOFE: "Lagos East", LEKKI: "Lagos East", SOMOLU: "Lagos East",
};

const districtAliases: Record<string, SenatorialDistrict> = {
  "LAGOS CENTRAL": "Lagos Central", CENTRAL: "Lagos Central",
  "LAGOS EAST": "Lagos East", EAST: "Lagos East",
  "LAGOS WEST": "Lagos West", WEST: "Lagos West",
};

export function normalizeDistrict(value: unknown): SenatorialDistrict | null {
  if (typeof value !== "string") return null;
  return districtAliases[value.trim().toUpperCase()] ?? null;
}

export function districtForLga(value: string): SenatorialDistrict | null {
  return LGA_TO_DISTRICT[normalizeLga(value)] ?? null;
}
