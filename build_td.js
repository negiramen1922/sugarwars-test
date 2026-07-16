// build_td.js — index.html の SPRITE_DATA から td.html で使うキーだけ抽出し、
// td.tpl.html のプレースホルダに差し込んで td.html を生成する。
// 使い方: node build_td.js
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');
const m = html.match(/const SPRITE_DATA\s*=\s*(\{[\s\S]*?\});\s*\n/);
if (!m) { console.error('SPRITE_DATA が index.html に見つかりません'); process.exit(1); }
const all = JSON.parse(m[1]);

// TD のタワー立ち絵＋弾（青＝味方のみでOK。敵カビは canvas 手描き＝スプライト不要）
const NEED = [
  'cookie_blue',    // クッキー（甘）
  'slime_blue',     // スライム（甘）
  'shoe_aim_blue',  // シューアーチャー（辛）
  'daifuku_blue',   // 大福サムライ（辛）
  'choco_blue',     // チョコナイト（苦）
  'icewiz_blue',    // アイス魔導士（苦）
  'arrow_blue',     // シューの矢
];
const REMAP = {}; // 現状リマップなし

const subset = {};
const missing = [];
for (const k of NEED) { if (all[k]) subset[k] = all[k]; else missing.push(k); }
for (const [src, dst] of Object.entries(REMAP)) { if (all[src]) subset[dst] = all[src]; else missing.push(src); }
if (missing.length) { console.error('index.html に無いキー:', missing.join(', ')); process.exit(1); }

const tpl = fs.readFileSync('td.tpl.html', 'utf8');
const out = tpl.replace('/*__SPRITES__*/ {}', JSON.stringify(subset));
fs.writeFileSync('td.html', out);

const kb = (Buffer.byteLength(out) / 1024).toFixed(0);
console.log('td.html を生成:', NEED.length, 'スプライト /', kb, 'KB');
