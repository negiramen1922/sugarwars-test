// td.test.js — SUGAR DEFENSE（td.html）のヘッドレステスト
// 使い方: node td.test.js
// <script> を抽出して vm サンドボックスで実行し、globalThis.__API 経由で検証する。
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('td.html', 'utf-8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error('no script'); process.exit(1); }
const code = m[1];

// ---- DOM/環境スタブ ----
const ctxStub = new Proxy({}, { get: () => () => {} });
function makeEl(id) {
  const cls = new Set();
  return {
    id, _cls: cls, innerHTML: '', textContent: '', style: {}, dataset: {}, disabled: false,
    classList: {
      add: (...c) => c.forEach(x => cls.add(x)), remove: (...c) => c.forEach(x => cls.delete(x)),
      toggle: (c, on) => { if (on === undefined) { cls.has(c) ? cls.delete(c) : cls.add(c); } else { on ? cls.add(c) : cls.delete(c); } },
      contains: (c) => cls.has(c),
    },
    appendChild() {}, removeChild() {},
    querySelector() { return makeEl('q'); },
    getContext() { return ctxStub; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 720, height: 540 }; },
    addEventListener() {}, removeEventListener() {},
    set onclick(v) {}, get offsetWidth() { return 100; },
    parentElement: { clientWidth: 720, clientHeight: 540 },
    clientWidth: 720, clientHeight: 540, width: 720, height: 540, naturalWidth: 128, complete: true,
  };
}
const els = {};
const documentStub = {
  getElementById: (id) => (els[id] = els[id] || makeEl(id)),
  createElement: () => makeEl('new'),
  querySelector: () => makeEl('q'), querySelectorAll: () => [],
  addEventListener() {}, fonts: { ready: Promise.resolve() },
};
const windowStub = { addEventListener() {}, devicePixelRatio: 1, requestAnimationFrame() { return 0; }, innerWidth: 720, innerHeight: 540 };
function ImageStub() { this.src = ''; this.onload = null; this.width = 128; this.height = 128; this.naturalWidth = 128; this.complete = true; this.addEventListener = () => {}; }

const sandbox = {
  document: documentStub, window: windowStub, Image: ImageStub,
  performance: { now: () => Date.now() },
  requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
  setTimeout: () => 0, clearTimeout: () => {},
  console, Math, Object, Array, Set, Map, JSON, Date, parseInt, parseFloat,
  isNaN, isFinite, String, Number, Boolean,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const API = sandbox.__API;

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, extra !== undefined ? '-> ' + JSON.stringify(extra) : ''); }
}
const S1 = API.STAGES[0];
function fresh() { API.setStage(S1); API.resetState(S1); }
// 経路外(草地)セルと経路セルを探すヘルパ
function grassCell() { for (let r = 0; r < API.CONF.ROWS; r++) for (let c = 0; c < API.CONF.COLS; c++) if (!API.isPathCell(c, r)) return [c, r]; }
function pathCell() { // 拠点以外の経路セル
  const last = API.WAYPOINTS[API.WAYPOINTS.length - 1];
  for (const k of API.PATH.cells) { const [c, r] = k.split(',').map(Number); if (!(c === last[0] && r === last[1])) return [c, r]; }
}

console.log('\n=== 1) 属性（三すくみ 甘→辛→苦→甘） ===');
check('甘は辛に強い', API.attrMul('sweet', 'spicy') === API.ATTR_ADV);
check('辛は苦に強い', API.attrMul('spicy', 'bitter') === API.ATTR_ADV);
check('苦は甘に強い', API.attrMul('bitter', 'sweet') === API.ATTR_ADV);
check('不利は等倍', API.attrMul('spicy', 'sweet') === 1.0);
check('同属性は等倍', API.attrMul('sweet', 'sweet') === 1.0);
check('ATTR_STRONG は三すくみ循環', API.ATTR_STRONG.sweet === 'spicy' && API.ATTR_STRONG.spicy === 'bitter' && API.ATTR_STRONG.bitter === 'sweet');

console.log('\n=== 2) 経路 buildPath / pointAt ===');
const P = API.PATH;
check('ウェイポイント数 = WAYPOINTS 数', P.px.length === API.WAYPOINTS.length);
check('入口(0,1)は経路', API.isPathCell(0, 1));
check('拠点(11,7)は経路', API.isPathCell(11, 7));
check('経路外(5,5)は非経路', !API.isPathCell(5, 5));
check('total は正の距離', P.total > 0);
check('cellDist に全経路セルがある', [...P.cells].every(k => P.cellDist[k] !== undefined));
check('pointAt(0) は入口セル中心', (() => { const p = API.pointAt(0), c = API.cellCenter(0, 1); return Math.abs(p.x - c.x) < 1 && Math.abs(p.y - c.y) < 1; })());
check('pointAt(total) は拠点セル中心', (() => { const p = API.pointAt(P.total), c = API.cellCenter(11, 7); return Math.abs(p.x - c.x) < 1 && Math.abs(p.y - c.y) < 1; })());
check('pointAt は距離とともに前進', API.pointAt(50).x !== undefined && API.pointAt(0).x <= API.pointAt(50).x);

console.log('\n=== 3) タワー分類・データ健全性 ===');
check('ブロッカーは class=blocker', API.BLOCKER_ORDER.every(k => API.TOWERS[k].class === 'blocker'));
check('レンジは class=ranger', API.RANGER_ORDER.every(k => API.TOWERS[k].class === 'ranger'));
check('全ブロッカーに hp/atk/block', API.BLOCKER_ORDER.every(k => { const t = API.TOWERS[k]; return t.hp > 0 && t.atk >= 0 && t.block >= 1; }));
check('全レンジに range/cd', API.RANGER_ORDER.every(k => { const t = API.TOWERS[k]; return t.range > 0 && t.cd >= 0; }));
check('サポートが1体以上いる', API.RANGER_ORDER.some(k => API.TOWERS[k].support));
check('遠距離アタッカーがいる', API.RANGER_ORDER.some(k => API.TOWERS[k].dmg > 0 && !API.TOWERS[k].support));
check('全タワーが3属性を含む', ['sweet', 'spicy', 'bitter'].every(a => Object.values(API.TOWERS).some(t => t.attr === a)));
check('全カビに atk/cd/hp/speed', Object.values(API.ENEMIES).every(e => e.atk >= 0 && e.cd > 0 && e.hp > 0 && e.speed > 0));

console.log('\n=== 4) 強化カーブ ===');
const cb = API.TOWERS.cookie, rb = API.TOWERS.shoe;
check('ブロッカー Lv2 HP > Lv1', API.blockerHpAt(cb, 2) > API.blockerHpAt(cb, 1));
check('ブロッカー Lv2 ATK > Lv1', API.blockerAtkAt(cb, 2) > API.blockerAtkAt(cb, 1));
check('レンジ Lv2 DMG > Lv1', API.rangerDmgAt(rb, 2) > API.rangerDmgAt(rb, 1));
check('レンジ Lv2 射程 > Lv1', API.rangerRangeAt(rb, 2) > rb.range);
check('強化コストはLv上昇で増える', API.upgradeCost(cb, 2) > API.upgradeCost(cb, 1));

console.log('\n=== 5) 設置ルール（ブロッカー=通路 / レンジ=草地） ===');
fresh(); API.state.coins = 99999;
const [gc, gr] = grassCell(), [pc, pr] = pathCell();
check('レンジは草地に置ける', API.isBuildableRanger(gc, gr));
check('レンジは通路に置けない', !API.isBuildableRanger(pc, pr));
check('ブロッカーは通路に置ける', API.isBuildableBlocker(pc, pr));
check('ブロッカーは草地に置けない', !API.isBuildableBlocker(gc, gr));
check('拠点マスにブロッカー不可', !API.isBuildableBlocker(11, 7));
check('レンジ設置でコイン減＋占有', (() => { const c0 = API.state.coins; const ok = API.placeTower('shoe', gc, gr);
  return ok && API.state.coins === c0 - API.TOWERS.shoe.cost && !API.isBuildableRanger(gc, gr); })());
check('ブロッカー設置で blockPoint 付与', (() => { API.placeTower('choco', pc, pr);
  const t = API.state.towers.find(x => x.class === 'blocker'); return t && t.blockPoint !== undefined && t.hp > 0 && t.block >= 1; })());
check('同じ通路マスに二重ブロッカー不可', !API.placeTower('cookie', pc, pr));
check('コイン不足では設置不可', (() => { API.state.coins = 5; const n = API.state.towers.length; return !API.placeTower('donut', grassCell()[0], grassCell()[1]) && API.state.towers.length === n; })());

console.log('\n=== 6) 強化と売却 ===');
fresh(); API.state.coins = 99999;
API.placeTower('choco', pc, pr);
const bt = API.state.towers[0];
check('ブロッカー強化で HP/ATK 上昇', (() => { const h = bt.maxHp, a = bt.atk; const ok = API.upgradeTower(bt); return ok && bt.maxHp > h && bt.atk > a; })());
check('最大Lvで打ち止め', (() => { while (bt.level < API.TOWER_MAX_LV) API.upgradeTower(bt); return bt.level === API.TOWER_MAX_LV && !API.upgradeTower(bt); })());
check('売却でコイン戻る＋通路マス解放', (() => { const c0 = API.state.coins; API.sellTower(bt); return API.state.coins > c0 && API.isBuildableBlocker(pc, pr); })());

console.log('\n=== 7) ダメージ計算（属性・サポート・ブロック追加） ===');
check('rangerDamage は属性補正込み', (() => { const t = { dmg: 10, buffMul: 1, U: { attr: 'sweet' } };
  return API.rangerDamage(t, { attr: 'spicy', stopped: false }) === 16 && API.rangerDamage(t, { attr: 'bitter', stopped: false }) === 10; })());
check('止まった敵にはBLOCK_BONUS', (() => { const t = { dmg: 10, buffMul: 1, U: { attr: 'bitter' } };
  return API.rangerDamage(t, { attr: 'sweet', stopped: true }) === 10 * API.ATTR_ADV * API.BLOCK_BONUS; })());
check('サポートbuffMulが乗る', (() => { const t = { dmg: 10, buffMul: 1.35, U: { attr: 'spicy' } };
  return Math.abs(API.rangerDamage(t, { attr: 'spicy', stopped: false }) - 13.5) < 1e-9; })());
check('blockerDamage は属性補正込み', (() => { const t = { atk: 10, buffMul: 1, U: { attr: 'spicy' } };
  return API.blockerDamage(t, { attr: 'bitter' }) === 16; })());
check('enemyDamageToBlocker は属性補正込み', (() => {
  return API.enemyDamageToBlocker({ atk: 10, attr: 'sweet' }, { U: { attr: 'spicy' } }) === 16; })());

console.log('\n=== 8) ターゲット選択 ===');
const en = [{ id: 1, x: 100, y: 100, traveled: 10, dead: false }, { id: 2, x: 110, y: 100, traveled: 50, dead: false }, { id: 3, x: 400, y: 400, traveled: 99, dead: false }];
check('射程内で最も前進した敵を狙う', API.pickTarget(en, 100, 100, 60).id === 2);
check('射程外しかなければ null', API.pickTarget(en, 700, 500, 5) === null);
check('死亡敵は狙わない', (() => { const e2 = en.map(e => ({ ...e })); e2[1].dead = true; return API.pickTarget(e2, 100, 100, 60).id === 1; })());

console.log('\n=== 9) ブロック挙動（受け止め・相互攻撃・崩れ） ===');
fresh(); API.state.coins = 99999;
// 経路の中ほどにブロッカーを置く
const [bpc, bpr] = (() => { const arr = [...API.PATH.cells].map(k => k.split(',').map(Number)); return arr[Math.floor(arr.length / 2)]; })();
API.placeTower('cookie', bpc, bpr);
const blk = API.state.towers.find(t => t.class === 'blocker');
API.startWave();
// 敵が到達してブロックされるまで進める
let gotStopped = false;
for (let i = 0; i < 200; i++) { API.step(0.1); if (API.world.enemies.some(e => e.stopped && e.blockedBy === blk)) { gotStopped = true; break; } }
check('敵がブロッカーで停止する', gotStopped);
check('停止した敵は blockPoint 付近で止まる', API.world.enemies.filter(e => e.stopped).every(e => Math.abs(e.traveled - blk.blockPoint) < 2));
check('ブロック数を超える敵は待機（engaged<=block）', blk.engagedIds.size <= blk.block);
const hp0 = blk.hp;
for (let i = 0; i < 30; i++) API.step(0.1);
check('敵の反撃でブロッカーHPが減る', blk.hp < hp0, { hp: blk.hp, hp0 });
// ブロッカーが崩れると通路占有が解放される（HPを削って確認）
check('ブロッカーは崩れて崩壊する（HP0で除去）', (() => {
  blk.hp = 1; for (let i = 0; i < 60; i++) { API.step(0.2); if (!API.state.towers.includes(blk)) return API.isBuildableBlocker(bpc, bpr); } return false;
})());

console.log('\n=== 10) レンジがブロック中の敵を倒すとコイン増 ===');
fresh(); API.state.coins = 99999;
API.placeTower('choco', bpc, bpr);       // 受け止め役
const rc = grassCell();
API.placeTower('shoe', rc[0], rc[1]);
const rng = API.state.towers.find(t => t.class === 'ranger'); rng.dmg = 9999; rng.range = 400;
API.startWave();
const coin0 = API.state.coins; let killed = false;
for (let i = 0; i < 200; i++) { API.step(0.15); if (API.state.coins > coin0) { killed = true; break; } }
check('レンジが敵を撃破してコイン増', killed, { coins: API.state.coins, before: coin0 });

console.log('\n=== 11) タワー無しなら敵が拠点に到達してライフ減 ===');
fresh();
API.startWave();
const life0 = S1.lives;
for (let i = 0; i < 400; i++) { if (!API.state.waveActive) break; API.step(0.2); }
check('ブロッカー無しでライフが減る', API.state.lives < life0, API.state.lives);

console.log('\n=== 12) 鈍足（アイス魔導士） ===');
check('slow を持つレンジがある', API.RANGER_ORDER.some(k => API.TOWERS[k].slow));
check('hitEnemyByTower(ranger) が slow を付与', (() => { fresh();
  const ice = { class: 'ranger', dmg: 5, buffMul: 1, U: { attr: 'bitter', slow: { mul: 0.5, dur: 1.4 }, splash: 0 } };
  const e = { hp: 100, maxHp: 100, U: API.ENEMIES.m_tank, attr: 'spicy', x: 0, y: 0, dead: false, slowT: 0, slowMul: 1, stopped: false };
  API.world.enemies.push(e); API.hitEnemyByTower(ice, e, true); return e.slowMul === 0.5 && e.slowT === 1.4; })());

console.log(`\n==== RESULT: ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
