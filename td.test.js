// td.test.js — SUGAR DEFENSE（td.html）のヘッドレステスト
// 使い方: node td.test.js
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
// localStorage スタブ（セーブ機能を検証）
const store = {};
const localStorageStub = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };

const sandbox = {
  document: documentStub, window: windowStub, Image: ImageStub, localStorage: localStorageStub,
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
function grassCell() { for (let r = 0; r < API.CONF.ROWS; r++) for (let c = 0; c < API.CONF.COLS; c++) if (!API.isPathCell(c, r)) return [c, r]; }
function pathCells() {
  const last = API.WAYPOINTS[API.WAYPOINTS.length - 1];
  return [...API.PATH.cells].map(k => k.split(',').map(Number)).filter(([c, r]) => !(c === last[0] && r === last[1]));
}

console.log('\n=== 1) 属性 ===');
check('甘>辛>苦>甘', API.attrMul('sweet', 'spicy') === API.ATTR_ADV && API.attrMul('spicy', 'bitter') === API.ATTR_ADV && API.attrMul('bitter', 'sweet') === API.ATTR_ADV);
check('不利/同属性は等倍', API.attrMul('spicy', 'sweet') === 1 && API.attrMul('sweet', 'sweet') === 1);

console.log('\n=== 2) 経路 ===');
check('pointAt(0)=入口, pointAt(total)=拠点', (() => { const a = API.pointAt(0), b = API.pointAt(API.PATH.total), i = API.cellCenter(0, 1), g = API.cellCenter(11, 7);
  return Math.abs(a.x - i.x) < 1 && Math.abs(b.x - g.x) < 1; })());
check('cellDist に全経路セル', [...API.PATH.cells].every(k => API.PATH.cellDist[k] !== undefined));

console.log('\n=== 3) タワー分類・潜在能力データ ===');
check('ブロッカー class', API.BLOCKER_ORDER.every(k => API.TOWERS[k].class === 'blocker'));
check('レンジ class', API.RANGER_ORDER.every(k => API.TOWERS[k].class === 'ranger'));
check('全タワーに固有 latent(名前/コスト/効果情報)', Object.values(API.TOWERS).every(t => t.latent && t.latent.name && t.latent.matCost >= 1 && t.latent.info));
check('サポートあり', API.RANGER_ORDER.some(k => API.TOWERS[k].support));
check('3属性を含む', ['sweet', 'spicy', 'bitter'].every(a => Object.values(API.TOWERS).some(t => t.attr === a)));
check('覚醒カビ m_awaken は素材ドロップあり', API.ENEMIES.m_awaken && API.ENEMIES.m_awaken.drop > 0);
check('通常カビは素材ドロップなし', ['m_swarm', 'm_puff', 'm_phage', 'm_tank', 'm_big'].every(k => !API.ENEMIES[k].drop));

console.log('\n=== 4) 恒久レベル（共通EXP） ===');
check('levelMul は Lv1=1, 上昇で増える', API.levelMul(1) === 1 && API.levelMul(2) > 1 && API.levelMul(3) > API.levelMul(2));
check('expCost は Lv上昇で増える', API.expCostForLevel(2) > API.expCostForLevel(1));
check('canLevelUp: EXP不足=false, 十分=true', !API.canLevelUp(1, 0) && API.canLevelUp(1, 9999));
check('MAX_LEVEL で頭打ち', !API.canLevelUp(API.MAX_LEVEL, 999999));
check('レベルUPでタワー実効ステータスが上がる', (() => {
  fresh(); const cell = pathCells()[3]; API.state.coins = 99999;
  API.SAVE.levels = {}; API.placeTower('choco', cell[0], cell[1]); const lo = API.state.towers[0].maxHp;
  API.sellTower(API.state.towers[0]);
  API.SAVE.levels = { choco: 3 }; API.placeTower('choco', cell[0], cell[1]); const hi = API.state.towers[0].maxHp;
  return hi > lo;
})());

console.log('\n=== 5) 編成（最大6） ===');
check('既定編成は 1〜6 の範囲', API.SAVE.loadout.length >= 1 && API.SAVE.loadout.length <= API.LOADOUT_MAX);
check('編成に無いキャラを追加できる', (() => { API.setLoadout(['cookie']); API.toggleLoadout('shoe'); return API.SAVE.loadout.includes('shoe'); })());
check('6を超えて追加できない', (() => { API.setLoadout(API.TOWER_ORDER.slice(0, 6)); const before = API.SAVE.loadout.slice(); API.toggleLoadout(API.TOWER_ORDER[6]); return API.SAVE.loadout.length === 6 && !API.SAVE.loadout.includes(API.TOWER_ORDER[6]); })());
check('最後の1個は外せない', (() => { API.setLoadout(['cookie']); API.toggleLoadout('cookie'); return API.SAVE.loadout.length === 1; })());
check('編成キャラをトグルで外せる', (() => { API.setLoadout(['cookie', 'shoe']); API.toggleLoadout('shoe'); return !API.SAVE.loadout.includes('shoe') && API.SAVE.loadout.length === 1; })());

console.log('\n=== 6) 出撃上限（deployCap） ===');
check('ステージに deployCap がある', S1.deployCap > 0);
check('上限まで置くと atDeployCap=true', (() => {
  fresh(); API.state.coins = 999999; API.state.deployCap = 3;
  const gs = []; for (let r = 0; r < API.CONF.ROWS; r++) for (let c = 0; c < API.CONF.COLS; c++) if (!API.isPathCell(c, r)) gs.push([c, r]);
  let placed = 0; for (const [c, r] of gs) { if (API.placeTower('slime', c, r)) placed++; if (API.atDeployCap()) break; }
  return API.deployCount() === 3 && API.atDeployCap() && !API.placeTower('slime', gs[10][0], gs[10][1]);
})());

console.log('\n=== 7) 設置ルール ===');
fresh(); API.state.coins = 99999;
const [gc, gr] = grassCell(); const [pc, pr] = pathCells()[0];
check('レンジ=草地 / ブロッカー=通路', API.isBuildableRanger(gc, gr) && !API.isBuildableRanger(pc, pr) && API.isBuildableBlocker(pc, pr) && !API.isBuildableBlocker(gc, gr));
check('拠点マスにブロッカー不可', !API.isBuildableBlocker(11, 7));
check('ブロッカー設置で blockPoint/HP 付与', (() => { API.placeTower('choco', pc, pr); const t = API.state.towers[0]; return t.blockPoint !== undefined && t.hp > 0 && t.block >= 1; })());
check('コイン/上限を超えると不可', (() => { API.state.coins = 5; return !API.placeTower('donut', gc, gr); })());

console.log('\n=== 8) 覚醒（覚醒素材→潜在能力） ===');
fresh(); API.state.coins = 99999;
API.placeTower('cookie', pathCells()[2][0], pathCells()[2][1]);
const ct = API.state.towers[0];
check('素材不足では覚醒できない', (() => { API.state.mat = 0; return !API.awakenTower(ct) && !ct.awakened; })());
check('素材消費で覚醒し、潜在で強くなる', (() => {
  const cd0 = ct.cd, atk0 = ct.atk; API.state.mat = 9;
  const ok = API.awakenTower(ct);
  return ok && ct.awakened && API.state.mat === 9 - ct.U.latent.matCost && ct.cd < cd0 && ct.atk > atk0;
})());
check('覚醒は一度きり(二重不可)', !API.awakenTower(ct));
check('覚醒カビ撃破で覚醒素材が増える', (() => {
  fresh(); API.state.mat = 0;
  const e = { id: 1, key: 'm_awaken', U: API.ENEMIES.m_awaken, attr: 'sweet', hp: 1, maxHp: 180, x: 0, y: 0, dead: false, stopped: false, _eff: 0 };
  API.world.enemies.push(e); API.state.aliveEnemies = 1;
  const tw = { class: 'ranger', dmg: 9999, buffMul: 1, U: { attr: 'bitter', splash: 0 } };
  API.hitEnemyByTower(tw, e, true);
  return e.dead && API.state.mat === API.ENEMIES.m_awaken.drop;
})());

console.log('\n=== 9) 潜在能力：多段狙撃 pickTargets ===');
const en = [{ id: 1, x: 100, y: 100, traveled: 90, dead: false }, { id: 2, x: 105, y: 100, traveled: 80, dead: false }, { id: 3, x: 110, y: 100, traveled: 70, dead: false }, { id: 4, x: 400, y: 400, traveled: 60, dead: false }];
check('pickTargets は射程内上位N体', (() => { const r = API.pickTargets(en, 100, 100, 40, 3); return r.length === 3 && r[0].id === 1 && !r.some(e => e.id === 4); })());
check('shoe覚醒(三連矢)で multi>1', (() => { fresh(); API.state.coins = 99999; API.state.mat = 9;
  const gcell = grassCell(); API.placeTower('shoe', gcell[0], gcell[1]); const t = API.state.towers[0]; API.awakenTower(t); return t.multi >= 3; })());

console.log('\n=== 10) ダメージ・ブロック・進行（統合） ===');
check('rangerDamage は属性×buff×停止ボーナス', (() => { const t = { dmg: 10, buffMul: 1.35, U: { attr: 'bitter' } };
  return Math.abs(API.rangerDamage(t, { attr: 'sweet', stopped: true }) - 10 * 1.6 * 1.35 * API.BLOCK_BONUS) < 1e-9; })());
check('敵はブロッカーで停止し相互攻撃', (() => {
  fresh(); API.state.coins = 99999; const mid = pathCells()[Math.floor(pathCells().length / 2)];
  API.placeTower('cookie', mid[0], mid[1]); const blk = API.state.towers[0]; API.startWave();
  let stopped = false; for (let i = 0; i < 200; i++) { API.step(0.1); if (API.world.enemies.some(e => e.stopped && e.blockedBy === blk)) { stopped = true; break; } }
  const hp0 = blk.hp; for (let i = 0; i < 30; i++) API.step(0.1);
  return stopped && blk.engagedIds.size <= blk.block && blk.hp < hp0;
})());
check('ブロッカー無しでライフ減', (() => { fresh(); API.startWave(); const l0 = S1.lives;
  for (let i = 0; i < 400; i++) { if (!API.state.waveActive) break; API.step(0.2); } return API.state.lives < l0; })());

console.log('\n=== 11) クリアでEXP獲得＋保存 ===');
check('win() で共通EXPが増える', (() => { fresh(); const e0 = API.myExp(); API.win(); return API.myExp() === e0 + S1.exp; })());
check('セーブが localStorage に書かれる', (() => { API.SAVE.levels = { cookie: 2 }; sandbox.__API; return true; })() && (() => {
  // saveSave は win/レベルUP時に呼ばれる。win 済みなので td_save が入っているはず
  return typeof store['td_save'] === 'string' && store['td_save'].includes('exp');
})());

console.log('\n=== 12) 鈍足/凍結 ===');
check('slow を持つレンジがある', API.RANGER_ORDER.some(k => API.TOWERS[k].slow));
check('hitEnemyByTower(ranger) が slow を付与', (() => { fresh();
  const ice = { class: 'ranger', dmg: 5, buffMul: 1, slow: { mul: 0.5, dur: 1.4 }, U: { attr: 'bitter', splash: 0 } };
  const e = { hp: 100, maxHp: 100, U: API.ENEMIES.m_tank, attr: 'spicy', x: 0, y: 0, dead: false, slowT: 0, slowMul: 1, stopped: false };
  API.world.enemies.push(e); API.hitEnemyByTower(ice, e, true); return e.slowMul === 0.5 && e.slowT === 1.4; })());
check('icewiz覚醒(絶対零度)でほぼ停止のslow', (() => { fresh(); API.state.coins = 99999; API.state.mat = 9;
  const g = grassCell(); API.placeTower('icewiz', g[0], g[1]); const t = API.state.towers[0]; API.awakenTower(t);
  return t.slow && t.slow.mul <= 0.05; })());

console.log(`\n==== RESULT: ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
