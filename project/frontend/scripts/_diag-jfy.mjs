#!/usr/bin/env node
import fs from 'fs';
const env = fs.readFileSync('.env.local','utf8');
const get = k => env.match(new RegExp(k+'=(.+)'))?.[1]?.trim();
const SB=get('SUPABASE_URL')||get('NEXT_PUBLIC_SUPABASE_URL');
const SK=get('SUPABASE_SERVICE_KEY');
const PID='4fff5d51-0b07-4fed-98f6-455d5c4e3d28';

async function q(url){
  const r=await fetch(url,{headers:{apikey:SK,Authorization:`Bearer ${SK}`}});
  return r.json();
}

// Images
const imgs=((await q(`${SB}/rest/v1/products?select=images&id=eq.${PID}`))[0]?.images)||[];
console.log('=== IMAGES ===',imgs.length,'total');
imgs.forEach((im,i)=>console.log(` [${i}] alt="${im.alt}" => ${im.src?.split('/').pop()}`));

// Variants
const vs=await q(`${SB}/rest/v1/product_variants?select=color,size,is_enabled,image_url,external_variant_id&product_id=eq.${PID}&order=color,size`);
console.log('\n=== VARIANTS ===',vs.length,'total');
const bc={};
for(const v of vs){
  if(!(v.color in bc)) bc[v.color]={n:0,en:0,img:0,sizes:[],iu:v.image_url};
  bc[v.color].n++;bc[v.color].sizes.push(v.size);
  if(v.is_enabled) bc[v.color].en++;
  if(v.image_url) bc[v.color].img++;
}
for(const [c,d] of Object.entries(bc)){
  console.log(`  ${c}: ${d.n} variants, ${d.en} enabled, ${d.img} withImg, imgUrl=${d.iu?'...'+d.iu.split('/').pop():'NULL'}`);
}

// Storage
const r=await fetch(`${SB}/storage/v1/object/list/designs`,{
  method:'POST',headers:{apikey:SK,Authorization:`Bearer ${SK}`,'Content-Type':'application/json'},
  body:JSON.stringify({prefix:'mockups/just-for-you',limit:100,sortBy:{column:'name',order:'asc'}})
});
const files=await r.json();
console.log('\n=== STORAGE mockups/just-for-you/ ===');
files.forEach(f=>console.log(`  ${f.name} (${Math.round((f.metadata?.size||0)/1024)}KB)`));
