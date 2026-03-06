#!/usr/bin/env node
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const envFile = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = (key) => envFile.match(new RegExp(`^${key}=(.+)$`, "m"))?.[1]?.trim();
const PF_TOKEN = env("PRINTFUL_API_TOKEN");
const PF_STORE = env("PRINTFUL_STORE_ID");
const SB_URL = env("SUPABASE_URL") || env("NEXT_PUBLIC_SUPABASE_URL");
const supabase = createClient(SB_URL, env("SUPABASE_SERVICE_KEY"));
const delay = (ms) => new Promise(r => setTimeout(r, ms));

// Step 1: Upload fixed back.png to Supabase
const backPng = readFileSync(new URL("../public/brand-designs/trendi/back.png", import.meta.url));
console.log(`Uploading back.png to Supabase (${(backPng.length / 1024).toFixed(0)} KB)...`);
const { error: upErr } = await supabase.storage.from("designs").upload(
  "dtg-sources/trendi/back.png", backPng, { contentType: "image/png", upsert: true }
);
if (upErr) throw upErr;
console.log("✓ Supabase upload done");

// Step 2: Upload to Printful File Library
console.log("Uploading to Printful...");
await delay(3000);
const pfRes = await fetch("https://api.printful.com/files", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${PF_TOKEN}`,
    "X-PF-Store-Id": PF_STORE,
    "Content-Type": "application/json",
    "User-Agent": "POD-AI-Store/1.0",
  },
  body: JSON.stringify({
    url: `${SB_URL}/storage/v1/object/public/designs/dtg-sources/trendi/back.png?v=${Date.now()}`,
    filename: "trendi-back-1800x2400-v2.png",
  }),
});
const pfData = await pfRes.json();
if (pfRes.status >= 400) {
  console.error("Printful error:", pfData);
  process.exit(1);
}
const newBackFileId = pfData.result.id;
console.log("✓ New back file_id:", newBackFileId);

// Step 3: Fetch product and update all variants
console.log("Fetching product variants...");
await delay(2000);
const prodRes = await fetch("https://api.printful.com/store/products/422183431", {
  headers: {
    Authorization: `Bearer ${PF_TOKEN}`,
    "X-PF-Store-Id": PF_STORE,
    "Content-Type": "application/json",
    "User-Agent": "POD-AI-Store/1.0",
  },
});
const prodData = await prodRes.json();
const variants = prodData.result.sync_variants;
console.log(`Found ${variants.length} variants`);

for (const v of variants) {
  await delay(2000);
  const updatedFiles = v.files
    .filter(f => f.type !== "preview")
    .map(f => {
      if (f.type === "back") return { type: "back", id: newBackFileId };
      return { type: f.type, id: f.id };
    });

  const updateRes = await fetch(`https://api.printful.com/store/variants/${v.id}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${PF_TOKEN}`,
      "X-PF-Store-Id": PF_STORE,
      "Content-Type": "application/json",
      "User-Agent": "POD-AI-Store/1.0",
    },
    body: JSON.stringify({ files: updatedFiles }),
  });
  const updateData = await updateRes.json();
  if (updateRes.status >= 400) {
    console.error(`  ✗ ${v.name}:`, updateData.error?.message);
  } else {
    console.log(`  ✓ ${v.name}`);
  }
}

// Step 4: Regenerate Back mockups
console.log("\n═══ Regenerating Back mockups ═══");
const COLORS = { Black: 10781, White: 10776 };
const designUrls = {
  front: `${SB_URL}/storage/v1/object/public/designs/dtg-sources/trendi/front.png`,
  back: `${SB_URL}/storage/v1/object/public/designs/dtg-sources/trendi/back.png?v=${Date.now()}`,
  sleeve_left: `${SB_URL}/storage/v1/object/public/designs/dtg-sources/trendi/sleeve-left.png`,
};

const mockupFiles = [
  { placement: "front", image_url: designUrls.front, position: { area_width: 1800, area_height: 1800, width: 1800, height: 1800, top: 0, left: 0 } },
  { placement: "back", image_url: designUrls.back, position: { area_width: 1800, area_height: 2400, width: 1800, height: 2400, top: 0, left: 0 } },
  { placement: "sleeve_left", image_url: designUrls.sleeve_left, position: { area_width: 450, area_height: 1800, width: 450, height: 1800, top: 0, left: 0 } },
];

for (const [color, varId] of Object.entries(COLORS)) {
  console.log(`\n  Generating Back mockup for ${color}...`);
  await delay(10000);

  const taskRes = await fetch(`https://api.printful.com/mockup-generator/create-task/380`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PF_TOKEN}`,
      "X-PF-Store-Id": PF_STORE,
      "Content-Type": "application/json",
      "User-Agent": "POD-AI-Store/1.0",
    },
    body: JSON.stringify({
      variant_ids: [varId],
      format: "png",
      width: 1000,
      option_groups: ["Ghost"],
      options: ["Back"],
      files: mockupFiles,
    }),
  });
  const taskData = await taskRes.json();
  if (taskRes.status >= 400) { console.error("  Task error:", taskData); continue; }

  const taskKey = taskData.result.task_key;
  console.log(`  Task: ${taskKey}`);

  let mockups = null;
  for (let i = 0; i < 20; i++) {
    await delay(3000);
    const pollRes = await fetch(`https://api.printful.com/mockup-generator/task?task_key=${taskKey}`, {
      headers: {
        Authorization: `Bearer ${PF_TOKEN}`,
        "X-PF-Store-Id": PF_STORE,
        "User-Agent": "POD-AI-Store/1.0",
      },
    });
    const poll = await pollRes.json();
    if (poll.result.status === "completed") { mockups = poll.result.mockups; break; }
    if (poll.result.status === "failed") { console.error("  Failed:", poll.result.error); break; }
    process.stdout.write(".");
  }

  if (mockups && mockups.length > 0) {
    const m = mockups[0];
    const colorSlug = color.toLowerCase();
    const imgRes = await fetch(m.mockup_url);
    const buf = Buffer.from(await imgRes.arrayBuffer());
    await supabase.storage.from("designs").upload(
      `mockups/trendi/${colorSlug}-back.png`,
      buf,
      { contentType: "image/png", upsert: true }
    );
    console.log(`\n  ✓ ${colorSlug}-back.png uploaded (${(buf.length / 1024).toFixed(0)} KB)`);
  }
}

// Step 5: Update product images in Supabase
console.log("\n═══ Updating product images ═══");
const ts = Date.now();
const base = `${SB_URL}/storage/v1/object/public/designs/mockups/trendi`;
const images = [
  { src: `${base}/black-front.png?v=${ts}`, alt: "Trendi - Black" },
  { src: `${base}/white-front.png?v=${ts}`, alt: "Trendi - White" },
  { src: `${base}/black-back.png?v=${ts}`, alt: "Trendi - Black - Back" },
  { src: `${base}/white-back.png?v=${ts}`, alt: "Trendi - White - Back" },
  { src: `${base}/black-right.png?v=${ts}`, alt: "Trendi - Black - Sleeve" },
  { src: `${base}/white-right.png?v=${ts}`, alt: "Trendi - White - Sleeve" },
];
const { error: imgErr } = await supabase.from("products").update({ images }).eq("id", "dd5cdc0b-718d-4b33-b1aa-def20fee3095");
if (imgErr) console.error("Image update error:", imgErr);
else console.log("✓ Product images updated with fresh timestamps");

console.log("\n✓ All done!");
