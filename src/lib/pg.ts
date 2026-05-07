/**
 * Serialize a `string[]` as a Postgres text-array literal (e.g. `{a,b}`).
 *
 * `@vercel/postgres` only handles JS array → Postgres array conversion through
 * its tagged-template form; passing `string[]` to `sql.query(text, values)`
 * fails. The literal-array constructor format works in both forms, so binding
 * a `toPgTextArray(...)` string is a uniform way to send a `text[]` value.
 */
export function toPgTextArray(values: string[]): string {
  if (values.length === 0) return "{}";
  const escaped = values.map(
    (v) => `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`,
  );
  return `{${escaped.join(",")}}`;
}
