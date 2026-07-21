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
  'cookie_body_blue','cookie_body_red',     // クッキー：槍なし本体（歩行1）
  'cookie_body2_blue','cookie_body2_red',   // クッキー：槍なし本体（歩行2）
  'cookie_spear_blue','cookie_spear_red',   // クッキー：槍
  'choco_body_blue','choco_body_red',       // チョコ：本体
  'choco_sword_blue','choco_sword_red',     // チョコ：剣
  'choco_shield_blue','choco_shield_red',   // チョコ：盾
  'daifuku_body_blue','daifuku_body_red',   // 大福：本体（武器なし）
  'daifuku_buff_body_blue','daifuku_buff_body_red',   // ちょんまげ大福：本体（武器なし・サムライ用）
  'daifuku_buff_blue','daifuku_buff_red',   // ちょんまげ大福：カード用（武器つき立ち絵）
  'daifuku_katana',                          // 大福：刀（陣営共通）
  'daifuku_sheath',                          // 大福：鞘（陣営共通）
  'slime_blue','slime_red',
  'slime_squash_blue','slime_squash_red',   // スライムのぽよん（潰れ）
  'slime_up_blue','slime_up_red',           // スライムのぽよん（伸び）
  'daifuku_blue','daifuku_red',
  'choco_blue','choco_red',
  'donut_blue','donut_red',
  'icewiz_blue','icewiz_red',               // アイスウィザード（鈍足の後衛）
  'macaron_blue','macaron_red',             // シェルマカロン（速い前衛）
  'shoe_aim_blue','shoe_aim_red',           // シュー：構え（攻撃）
  'shoe_idle_blue','shoe_idle_red',         // シュー：待機
  'shoe_walk1_blue','shoe_walk1_red',       // シュー：歩行1
  'shoe_walk2_blue','shoe_walk2_red',       // シュー：歩行2
  'bomb_blue','bomb_red',                   // ポップコーン：歩行1
  'bomb2_blue','bomb2_red',                 // ポップコーン：歩行2
  'arrow_blue','arrow_red',
];
// spr名を drawUnit の "spr+'_blue'/'_red'" 規則に合わせるリマップ（元キー→出力キー）
const REMAP = {
  'slime_blue_big':'slimebig_blue',   // 巨大スライム（3つ目の融合立ち絵）
  'slime_red_big' :'slimebig_red',
  'slime_bigsquash_blue':'slimebigsquash_blue',   // 巨大スライムのぽよん（潰れ）
  'slime_bigsquash_red' :'slimebigsquash_red',
  'slime_bigup_blue':'slimebigup_blue',           // 巨大スライムのぽよん（伸び）
  'slime_bigup_red' :'slimebigup_red',
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
