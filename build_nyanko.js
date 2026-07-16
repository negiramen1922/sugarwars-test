// build_nyanko.js — index.html の SPRITE_DATA から必要なキーだけ抜き出し、
// nyanko.tpl.html のプレースホルダに差し込んで nyanko.html を生成する。
// 使い方: node build_nyanko.js
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');
const m = html.match(/const SPRITE_DATA\s*=\s*(\{[\s\S]*?\});\s*\n/);
if (!m) { console.error('SPRITE_DATA が index.html に見つかりません'); process.exit(1); }
const all = JSON.parse(m[1]);

// nyanko.html で使うスプライトだけ（青/赤）
const NEED = [
  'cookie_blue','cookie_red',
  'cookie_party_blue','cookie_party_red',   // パーティークッキー（サングラス）
  'slime_blue','slime_red',
  'daifuku_blue','daifuku_red',
  'choco_blue','choco_red',
  'donut_blue','donut_red',
  'shoe_aim_blue','shoe_aim_red',
  'bomb_blue','bomb_red',
  'arrow_blue','arrow_red',
];
// spr名を drawUnit の "spr+'_blue'/'_red'" 規則に合わせるリマップ（元キー→出力キー）
const REMAP = {
  'slime_blue_big':'slimebig_blue',   // 巨大スライム（3つ目の融合立ち絵）
  'slime_red_big' :'slimebig_red',
};
const subset = {};
let missing = [];
for (const k of NEED) {
  if (all[k]) subset[k] = all[k];
  else missing.push(k);
}
for (const [src,dst] of Object.entries(REMAP)) {
  if (all[src]) subset[dst] = all[src];
  else missing.push(src);
}
if (missing.length) { console.error('index.html に無いキー:', missing.join(', ')); process.exit(1); }

const tpl = fs.readFileSync('nyanko.tpl.html', 'utf8');
const out = tpl.replace('/*__SPRITES__*/ {}', JSON.stringify(subset));
fs.writeFileSync('nyanko.html', out);

const kb = (Buffer.byteLength(out) / 1024).toFixed(0);
console.log('nyanko.html を生成:', NEED.length, 'スプライト /', kb, 'KB');
