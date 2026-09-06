import { readFile, writeFile, mkdir } from "node:fs/promises";

const source = await readFile(new URL("../../index.html", import.meta.url), "utf8");
const match = source.match(/const REPORT_REGISTER=(\[[\s\S]*?\]);\s*const clusterByName/);
if (!match) throw new Error("REPORT_REGISTER was not found in index.html");
const records = JSON.parse(match[1]);
await mkdir(new URL("../../data/", import.meta.url), { recursive: true });
await writeFile(new URL("../../data/report-register.json", import.meta.url), `${JSON.stringify(records, null, 2)}\n`);
console.log(`Extracted ${records.length} baseline register records.`);
