import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// IMPORT SETTINGS: values for this one-time CSV migration; keep the Supabase secret key private.
const baseUrl = process.env.SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const adminUserId = process.env.PORTAL_ADMIN_USER_ID;
const csvFolder = join(dirname(fileURLToPath(import.meta.url)), "csv");

if (!baseUrl || !secretKey || !adminUserId) {
  console.error("Set SUPABASE_URL, SUPABASE_SECRET_KEY, and PORTAL_ADMIN_USER_ID first.");
  process.exit(1);
}

// CSV PARSER: read quoted cells, commas, and newlines without an extra package.
function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n") { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell.length || row.length) { row.push(cell.replace(/\r$/, "")); rows.push(row); }
  return rows.filter(r => r.some(v => String(v).trim() !== ""));
}

// FIELD MAPPING: normalize sheet column names to the portal's record field keys.
function keyFor(header) {
  const key = String(header || "").trim().toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const aliases = {
    "asset_id": "asset_id", "asset_type": "asset_type",
    "brand_model": "brand_model", "brand_or_model": "brand_model",
    "location_hub": "location", "location": "location",
    "assigned_to": "assigned_employee", "assigned_employee": "assigned_employee",
    "serial_number": "serial_number", "operational_notes": "notes",
    "record_id": "record_id", "item_name": "item_name",
    "dispatch_id": "dispatch_id", "created_at": "created_at",
    "updated_at": "updated_at"
  };
  return aliases[key] || key;
}

// SUPABASE WRITE: submit a batch of prepared record rows using the temporary server secret.
async function postRows(rows) {
  const response = await fetch(baseUrl.replace(/\/$/, "") + "/rest/v1/portal_records", {
    method: "POST",
    headers: {
      apikey: secretKey,
      Authorization: "Bearer " + secretKey,
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    },
    body: JSON.stringify(rows)
  });
  if (!response.ok) throw new Error(response.status + " " + await response.text());
}

// IMPORT ALLOWLIST: only ordinary portal data modules can be imported; auth and audit tables are excluded.
const safeModules = new Set([
  "hardware_inventory","non_asset_inventory","hardware_dispatch","support_tickets","remote_desktop",
  "licenses","network_voice","toner_inventory","toner_transactions","spare_parts","supplier_payments",
  "monthly_payments","it_documents","handover_records","notification_settings","handover_settings"
]);

// IMPORT LOOP: read one CSV per module, convert each row, and send batches of at most 50 records.
const files = (await readdir(csvFolder)).filter(name => name.toLowerCase().endsWith(".csv"));
if (!files.length) {
  console.error("No CSV files found. Put one module CSV per file in migration/csv/.");
  process.exit(1);
}

for (const filename of files) {
  const module = filename.slice(0, -4).toLowerCase();
  if (!safeModules.has(module)) {
    console.warn("Skipping unsupported or protected module file: " + filename);
    continue;
  }
  const rows = parseCsv(await readFile(join(csvFolder, filename), "utf8"));
  if (rows.length < 2) {
    console.warn("Skipping empty CSV: " + filename);
    continue;
  }
  const headers = rows[0].map(keyFor);
  const payloads = rows.slice(1).map(values => {
    const data = {};
    headers.forEach((key, index) => {
      const value = String(values[index] || "").trim();
      if (key && value !== "") data[key] = value;
    });
    return { module, data, created_by: adminUserId };
  }).filter(record => Object.keys(record.data).length);

  for (let i = 0; i < payloads.length; i += 50) {
    await postRows(payloads.slice(i, i + 50));
  }
  console.log("Imported " + payloads.length + " rows from " + filename + ".");
}

console.log("Import finished. Review the records in the portal before staff use it.");
