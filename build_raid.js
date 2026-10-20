// build_raid.js — index.html の SPRITE_DATA から必要なキーだけ抜き出し、
// raid.tpl.html のプレースホルダに差し込んで raid.html を生成する。
// 使い方: node build_raid.js
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');
const m = html.match(/const SPRITE_DATA\s*=\s*(\{[\s\S]*?\});\s*\n/);
if (!m) { console.error('SPRITE_DATA が index.html に見つかりません'); process.exit(1); }
const all = JSON.parse(m[1]);

// raid.html で使うスプライト（攻める側＝青／村の防衛施設＝赤）
const NEED = [
  'cookie_blue', 'shoe_aim_blue', 'shoe_walk1_blue', 'shoe_walk2_blue',
  'bomb_blue', 'bomb2_blue', 'ghost_blue', 'daifuku_blue', 'choco_blue',
  'cannon_red', 'shoe_aim_red', 'icewiz_red', 'bomb_red', 'bakery_red',
  'arrow_red', 'arrow_blue', 'ball_red', 'popcorn_mini', 'tut_gramps',
];
const subset = {};
const missing = [];
for (const k of NEED) {
  if (all[k]) subset[k] = all[k];
  else missing.push(k);
}
if (missing.length) { console.error('index.html に無いキー:', missing.join(', ')); process.exit(1); }

const tpl = fs.readFileSync('raid.tpl.html', 'utf8');
const out = tpl.replace('/*__SPRITES__*/ {}', JSON.stringify(subset));
fs.writeFileSync('raid.html', out);

const kb = (Buffer.byteLength(out) / 1024).toFixed(0);
console.log('raid.html を生成:', NEED.length, 'スプライト /', kb, 'KB');
