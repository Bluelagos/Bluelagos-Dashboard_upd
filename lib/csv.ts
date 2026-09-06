export function csvCell(value: unknown, type: "text" | "number" | "boolean" = "text"): string {
  if (value === null || value === undefined) return '""';
  let output = String(value);
  if (type === "text" && /^\s*[=+\-@]/.test(output)) output = `'${output}`;
  return `"${output.replaceAll('"', '""')}"`;
}

export function createCsv<T>(rows: T[], fields: ReadonlyArray<{ key: keyof T; label: string; type?: "text" | "number" | "boolean" }>): string {
  return [
    fields.map((field) => csvCell(field.label)).join(","),
    ...rows.map((row) => fields.map((field) => csvCell(row[field.key], field.type)).join(",")),
  ].join("\r\n");
}
