// generate-docs.js — run once with: node generate-docs.js
// Outputs: api-docs.json (OpenAPI spec) + postman-collection.json
import swaggerSpec from "./swagger.js";
import { writeFileSync } from "fs";
import { randomUUID } from "crypto";

// ── 1. api-docs.json ────────────────────────────────────────────────────────
writeFileSync("api-docs.json", JSON.stringify(swaggerSpec, null, 2));
console.log("✅  api-docs.json written");

// ── 2. Helpers ───────────────────────────────────────────────────────────────
function buildExample(schema) {
  if (!schema) return {};
  if (schema.example !== undefined) return schema.example;
  if (schema.type === "object" && schema.properties) {
    const obj = {};
    for (const [k, v] of Object.entries(schema.properties)) obj[k] = buildExample(v);
    return obj;
  }
  if (schema.type === "array") return [buildExample(schema.items || {})];
  switch (schema.type) {
    case "string":  return schema.format === "date" ? "2024-01-01" : schema.enum?.[0] ?? "string";
    case "integer": return 1;
    case "number":  return 1.0;
    case "boolean": return true;
    default:        return null;
  }
}

function buildBody(requestBody) {
  if (!requestBody?.content) return undefined;
  const { content } = requestBody;

  if (content["application/json"]) {
    const example = buildExample(content["application/json"].schema);
    return {
      mode: "raw",
      raw: JSON.stringify(example, null, 2),
      options: { raw: { language: "json" } },
    };
  }

  if (content["multipart/form-data"]) {
    const props = content["multipart/form-data"].schema?.properties || {};
    const formdata = Object.entries(props).map(([key, prop]) => ({
      key,
      value: prop.example !== undefined ? String(prop.example) : "",
      type: prop.format === "binary" ? "file" : "text",
      ...(prop.description ? { description: prop.description } : {}),
    }));
    return { mode: "formdata", formdata };
  }

  return undefined;
}

// ── 3. Group paths by first tag ───────────────────────────────────────────────
const groups = {};
for (const [path, methods] of Object.entries(swaggerSpec.paths || {})) {
  for (const [method, op] of Object.entries(methods)) {
    if (["parameters", "summary", "description"].includes(method)) continue;
    const tag = (op.tags?.[0]) ?? "General";
    (groups[tag] ??= []).push({ path, method, op });
  }
}

// ── 4. Build Postman items ────────────────────────────────────────────────────
function buildUrl(path, op) {
  const queryParams = (op.parameters || [])
    .filter((p) => p.in === "query")
    .map((p) => ({
      key: p.name,
      value: p.example !== undefined ? String(p.example) : "",
      ...(p.description ? { description: p.description } : {}),
      disabled: !p.required,
    }));

  const pathVars = (op.parameters || [])
    .filter((p) => p.in === "path")
    .map((p) => ({
      key: p.name,
      value: p.example !== undefined ? String(p.example) : "",
    }));

  const rawQuery = queryParams
    .filter((q) => !q.disabled)
    .map((q) => `${q.key}=${q.value}`)
    .join("&");

  const raw = `{{baseUrl}}${path}${rawQuery ? "?" + rawQuery : ""}`;

  const urlObj = {
    raw,
    host: ["{{baseUrl}}"],
    path: path.split("/").filter(Boolean),
    ...(queryParams.length ? { query: queryParams } : {}),
    ...(pathVars.length ? { variable: pathVars } : {}),
  };
  return urlObj;
}

const folders = Object.entries(groups).map(([tag, endpoints]) => ({
  name: tag,
  item: endpoints.map(({ path, method, op }) => {
    const isSecured = op.security?.length > 0;
    const header = isSecured
      ? [{ key: "Authorization", value: "Bearer {{token}}", type: "text" }]
      : [];

    const body = buildBody(op.requestBody);

    return {
      name: op.summary ?? `${method.toUpperCase()} ${path}`,
      request: {
        method: method.toUpperCase(),
        header,
        url: buildUrl(path, op),
        ...(body ? { body } : {}),
        ...(op.description ? { description: op.description } : {}),
      },
      response: [],
    };
  }),
}));

// ── 5. Assemble collection ───────────────────────────────────────────────────
const collection = {
  info: {
    _postman_id: randomUUID(),
    name: swaggerSpec.info.title,
    description: swaggerSpec.info.description ?? "",
    schema:
      "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
  },
  item: folders,
  variable: [
    { key: "baseUrl",      value: "http://localhost:8000", type: "string" },
    { key: "token",        value: "",                      type: "string" },
    { key: "refreshToken", value: "",                      type: "string" },
  ],
};

writeFileSync("postman-collection.json", JSON.stringify(collection, null, 2));
console.log("✅  postman-collection.json written");
console.log(`\n   Folders : ${folders.length}`);
console.log(`   Requests: ${folders.reduce((n, f) => n + f.item.length, 0)}`);
