#!/usr/bin/env node
import { readFileSync } from "fs";

const envFile = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = (key) => envFile.match(new RegExp(`^${key}=(.+)$`, "m"))?.[1]?.trim();
const PF_TOKEN = env("PRINTFUL_API_TOKEN");
const PF_STORE = env("PRINTFUL_STORE_ID");
const delay = (ms) => new Promise(r => setTimeout(r, ms));

const NEW_BACK_FILE_ID = 950776582;
const FRONT_FILE_ID = 950766641;
const SLEEVE_LEFT_FILE_ID = 950766672;
const SLEEVE_RIGHT_FILE_ID = 950766696;

// Fetch product to get the 2 White 2XL and 3XL variant IDs
console.log("Fetching product variants...");
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

// Find White 2XL and 3XL
const targets = variants.filter(v => {
  const name = v.name.toLowerCase();
  return name.includes("white") && (name.includes("2xl") || name.includes("3xl"));
});

console.log(`Found ${targets.length} target variants:`);
for (const v of targets) {
  console.log(`  - ${v.name} (id: ${v.id})`);
}

for (const v of targets) {
  await delay(3000);
  const files = [
    { type: "default", id: FRONT_FILE_ID },
    { type: "back", id: NEW_BACK_FILE_ID },
    { type: "sleeve_left", id: SLEEVE_LEFT_FILE_ID },
    { type: "sleeve_right", id: SLEEVE_RIGHT_FILE_ID },
  ];

  const updateRes = await fetch(`https://api.printful.com/store/variants/${v.id}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${PF_TOKEN}`,
      "X-PF-Store-Id": PF_STORE,
      "Content-Type": "application/json",
      "User-Agent": "POD-AI-Store/1.0",
    },
    body: JSON.stringify({ files }),
  });
  const updateData = await updateRes.json();
  if (updateRes.status >= 400) {
    console.error(`  ✗ ${v.name}:`, updateData.error?.message || updateData);
  } else {
    // Verify the back file was updated
    const backFile = updateData.result.files.find(f => f.type === "back");
    console.log(`  ✓ ${v.name} — back file_id: ${backFile?.id}`);
  }
}

console.log("\nDone!");
