import fs from 'fs';
import path from 'path';

const key = process.env.NVIDIA_API_KEY || fs.readFileSync('.env','utf8').match(/NVIDIA_API_KEY=(.+)/)?.[1]?.trim();
if (!key) { console.error('No NVIDIA key'); process.exit(1); }
const model = 'meta/llama-3.1-8b-instruct';
const en = JSON.parse(fs.readFileSync('messages/en.json','utf8'));

function flatten(obj, prefix='', out={}) {
  for (const [k,v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else out[key]=v;
  }
  return out;
}
function unflatten(flat) {
  const out={};
  for (const [k,v] of Object.entries(flat)) {
    const parts=k.split('.');
    let cur=out;
    for (let i=0;i<parts.length-1;i++) { cur[parts[i]] ??= {}; cur=cur[parts[i]]; }
    cur[parts.at(-1)]=v;
  }
  return out;
}

const flatEn = flatten(en);
const allKeys = Object.keys(flatEn);
console.log(`EN keys: ${allKeys.length}`);

const targets = {
  fr: { name: 'French (Français) — neutral', model: 'meta/llama-3.1-8b-instruct' },
};

async function translateBatch(batch, langName, langCode, modelOverride) {
  const useModel = modelOverride || model;
  const payload = batch.map(([k,v]) => [k, String(v)]).reduce((a,[k,v])=>(a[k]=v,a),{});
  const prompt = `Translate the following JSON string values to ${langName}. Preserve JSON keys exactly. Preserve placeholders like {count}, {name}, {value} exactly — do not translate them. Keep "METARDU" unchanged. Return ONLY valid JSON object with same keys, translated values. No explanations.

${JSON.stringify(payload, null, 2)}`;
  const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: useModel,
      messages: [
        { role: 'system', content: 'You are a professional translator for a land surveying platform. Output only valid JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 4096,
    })
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`NVIDIA ${res.status}: ${t.slice(0,500)}`);
  }
  const j = await res.json();
  const content = j.choices[0]?.message?.content || '';
  // Extract JSON block
  const m = content.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('No JSON in response: ' + content.slice(0,300));
  return JSON.parse(m[0]);
}

for (const [code, cfg] of Object.entries(targets)) {
  const name = typeof cfg === 'string' ? cfg : cfg.name;
  const tgtModel = typeof cfg === 'object' && cfg.model ? cfg.model : model;
  console.log(`\n=== ${code} → ${name} [${tgtModel}] ===`);
  const existing = JSON.parse(fs.readFileSync(`messages/${code}.json`,'utf8'));
  const flatExisting = flatten(existing);
  const outFlat = {};
  const batchSize = 30;
  for (let i=0;i<allKeys.length;i+=batchSize) {
    const batchKeys = allKeys.slice(i, i+batchSize);
    const batch = batchKeys.map(k=>[k, flatEn[k]]);
    process.stdout.write(`  batch ${i/batchSize+1}/${Math.ceil(allKeys.length/batchSize)} (${batchKeys.length})... `);
    let translated;
    let retries=6;
    while (retries--) {
      try { translated = await translateBatch(batch, name, code, tgtModel); break; }
      catch(e){
        const msg = e.message.slice(0,120);
        const isRateLimit = /429|rate limit/i.test(msg);
        if (!retries || !isRateLimit && retries < 2) {
          console.log(`fail: ${msg}`);
          if (!retries) throw e;
        }
        // Rate limits need much longer backoff than transient errors
        const wait = isRateLimit ? 20000 * (7 - retries) : 1500;
        console.log(`retry (${retries} left, waiting ${Math.round(wait/1000)}s): ${msg}`);
        await new Promise(r=>setTimeout(r, wait));
      }
    }
    for (const k of batchKeys) outFlat[k] = translated[k] ?? flatEn[k];
    console.log('ok');
    await new Promise(r=>setTimeout(r,150));
  }
  // Verify all keys present
  const missing = allKeys.filter(k=>!(k in outFlat));
  if (missing.length) console.warn(`Missing after translate: ${missing.slice(0,5)}`);
  const out = unflatten(outFlat);
  fs.writeFileSync(`messages/${code}.json`, JSON.stringify(out, null, 2)+'\n', 'utf8');
  console.log(`Wrote messages/${code}.json (${Object.keys(outFlat).length} keys)`);
}
console.log('\nDone. Running i18n-sync --check');
