// td.test.js — SUGAR DEFENSE（td.html）のヘッドレステスト
// 使い方: node td.test.js
// index.html の test.js と同じく、<script> を抽出して vm サンドボックスで実行し、
// globalThis.__API 経由で純関数・ゲーム進行を検証する。
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
  const el = {
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
  return el;
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

console.log('\n=== 1) 属性（三すくみ 甘→辛→苦→甘） ===');
check('甘は辛に強い(×ADV)', API.attrMul('sweet', 'spicy') === API.ATTR_ADV);
check('辛は苦に強い(×ADV)', API.attrMul('spicy', 'bitter') === API.ATTR_ADV);
check('苦は甘に強い(×ADV)', API.attrMul('bitter', 'sweet') === API.ATTR_ADV);
check('不利は等倍(ペナルティなし)', API.attrMul('spicy', 'sweet') === 1.0);
check('同属性は等倍', API.attrMul('sweet', 'sweet') === 1.0);
check('ATTR_STRONG は三すくみの循環', API.ATTR_STRONG.sweet === 'spicy' && API.ATTR_STRONG.spicy === 'bitter' && API.ATTR_STRONG.bitter === 'sweet');
check('ADV は 1 より大きい', API.ATTR_ADV > 1);

console.log('\n=== 2) 経路 buildPath ===');
const P = API.PATH;
check('ウェイポイント数 = WAYPOINTS 数', P.px.length === API.WAYPOINTS.length, P.px.length);
check('入口(0,1)は経路', API.isPathCell(0, 1));
check('拠点(11,7)は経路', API.isPathCell(11, 7));
check('経路外(5,5)は非経路', !API.isPathCell(5, 5));
check('経路セルが連続している(隣接)', (() => {
  const cells = [...P.cells].map(s => s.split(',').map(Number));
  // 各ウェイポイント区間は直線なので、経路セル数はマンハッタン距離の和+1
  let manh = 0; for (let i = 1; i < API.WAYPOINTS.length; i++) {
    manh += Math.abs(API.WAYPOINTS[i][0] - API.WAYPOINTS[i - 1][0]) + Math.abs(API.WAYPOINTS[i][1] - API.WAYPOINTS[i - 1][1]);
  }
  return cells.length === manh + 1;
})(), P.cells.size);
check('cellCenter(0,0) = タイル中心', API.cellCenter(0, 0).x === API.CONF.TILE / 2 && API.cellCenter(0, 0).y === API.CONF.TILE / 2);
check('inBounds 範囲外を弾く', !API.inBounds(-1, 0) && !API.inBounds(API.CONF.COLS, 0) && API.inBounds(0, 0));

console.log('\n=== 3) タワー強化カーブ ===');
const cb = API.TOWERS.cookie;
check('Lv1 ダメージ = 基礎', API.towerDmgAt(cb, 1) === cb.dmg);
check('Lv2 > Lv1 ダメージ', API.towerDmgAt(cb, 2) > API.towerDmgAt(cb, 1));
check('Lv3 > Lv2 ダメージ', API.towerDmgAt(cb, 3) > API.towerDmgAt(cb, 2));
check('Lv1 射程 = 基礎', API.towerRangeAt(cb, 1) === cb.range);
check('Lv2 射程 > Lv1', API.towerRangeAt(cb, 2) > cb.range);
check('強化コストはLv上昇で増える', API.upgradeCost(cb, 2) > API.upgradeCost(cb, 1));

console.log('\n=== 4) ウェーブ ===');
check('waveCount は敵数の合計', API.waveCount([{ n: 3 }, { n: 5 }]) === 8);
check('全ウェーブに敵がいる', API.WAVES.every(w => API.waveCount(w) > 0));
check('ウェーブは後半ほど敵が増える傾向', API.waveCount(API.WAVES[API.WAVES.length - 1]) > API.waveCount(API.WAVES[0]));

console.log('\n=== 5) データ健全性 ===');
const attrs = new Set(Object.values(API.TOWERS).map(t => t.attr));
check('タワーは3属性すべてを含む', ['sweet', 'spicy', 'bitter'].every(a => attrs.has(a)), [...attrs]);
check('全タワーの属性が有効', Object.values(API.TOWERS).every(t => API.ATTR[t.attr]));
check('全タワーにスプライトキーがある', Object.values(API.TOWERS).every(t => typeof t.spr === 'string'));
check('全タワーがコスト正', Object.values(API.TOWERS).every(t => t.cost > 0));
check('TOWER_ORDER は全タワーを網羅', API.TOWER_ORDER.length === Object.keys(API.TOWERS).length && API.TOWER_ORDER.every(k => API.TOWERS[k]));
check('全カビの属性が有効', Object.values(API.ENEMIES).every(e => API.ATTR[e.attr]));
check('全カビが正のHP/速度', Object.values(API.ENEMIES).every(e => e.hp > 0 && e.speed > 0));

console.log('\n=== 6) 設置と経済 ===');
fresh();
const startC = API.state.coins;
check('初期コイン = ステージ設定', startC === S1.coins, startC);
check('経路には置けない', !API.isBuildable(0, 1));
check('空きマスには置ける', API.isBuildable(5, 5));
check('設置成功でコイン減少＋占有', (() => {
  const ok = API.placeTower('cookie', 5, 5);
  return ok && API.state.coins === startC - API.TOWERS.cookie.cost && !API.isBuildable(5, 5) && API.state.towers.length === 1;
})());
check('同じマスに二重設置は不可', !API.placeTower('slime', 5, 5));
check('経路上には設置不可', !API.placeTower('cookie', 0, 1));
check('コイン不足では設置不可', (() => {
  API.state.coins = 10; const before = API.state.towers.length;
  return !API.placeTower('shoe', 6, 6) && API.state.towers.length === before;
})());

console.log('\n=== 7) 強化と売却 ===');
fresh();
API.state.coins = 99999;
API.placeTower('choco', 4, 2);   // (4,2)=経路外
const t = API.state.towers[0];
check('強化でLv・ダメージ上昇', (() => {
  const d0 = t.dmg; const ok = API.upgradeTower(t); return ok && t.level === 2 && t.dmg > d0;
})());
check('最大Lvで打ち止め', (() => {
  API.state.coins = 99999; while (t.level < API.TOWER_MAX_LV) API.upgradeTower(t);
  return t.level === API.TOWER_MAX_LV && !API.upgradeTower(t);
})());
check('売却でコイン戻る＋マス解放', (() => {
  const c0 = API.state.coins; API.sellTower(t);
  return API.state.coins > c0 && API.isBuildable(4, 2) && API.state.towers.length === 0;
})());

console.log('\n=== 8) ターゲット選択（拠点に近い＝traveled最大） ===');
const en = [
  { id: 1, x: 100, y: 100, traveled: 10, dead: false },
  { id: 2, x: 110, y: 100, traveled: 50, dead: false }, // より前進
  { id: 3, x: 400, y: 400, traveled: 99, dead: false }, // 射程外
];
check('射程内で最も前進した敵を狙う', API.pickTarget(en, 100, 100, 60).id === 2);
check('射程外しかなければ null', API.pickTarget(en, 400, 400, 5) === null || API.pickTarget(en, 400, 400, 5).id === 3);
check('死亡敵は狙わない', (() => { const e2 = en.map(e => ({ ...e })); e2[1].dead = true; return API.pickTarget(e2, 100, 100, 60).id === 1; })());
check('shotDamage は属性補正込み', (() => {
  const tw = { dmg: 10, U: { attr: 'sweet' } };
  return API.shotDamage(tw, { attr: 'spicy' }) === 16 && API.shotDamage(tw, { attr: 'bitter' }) === 10;
})());

console.log('\n=== 9) 進行：湧き→移動→到達でライフ減 ===');
fresh();
API.startWave();
check('startWave で spawnQueue が積まれる', API.state.spawnQueue.length === API.waveCount(S1.waves[0]), API.state.spawnQueue.length);
check('waveActive になる', API.state.waveActive === true);
// 十分な時間を進めて全部湧かせる
for (let i = 0; i < 40; i++) API.step(0.5);
check('敵が湧いた（またはすでに到達/撃破で処理済み）', API.world.nextId > 1);
const lifeStart = S1.lives;
// タワー無し放置 → 全部拠点到達でライフが減る
for (let i = 0; i < 200; i++) { if (!API.state.waveActive) break; API.step(0.5); }
check('タワー無しならライフが減る', API.state.lives < lifeStart, API.state.lives);

console.log('\n=== 10) 進行：タワーが敵を倒すとコイン増 ===');
fresh();
// 経路(9,1)-(9,4) 付近の空きマス(8,2)に強力タワーを置く（射程内に経路が来る）
API.state.coins = 9999;
API.placeTower('choco', 8, 2);
const tw = API.state.towers[0]; tw.dmg = 9999; tw.range = 300; // 一撃必殺・広射程にして確実に
API.startWave();
const coinBefore = API.state.coins;
let killed = false;
for (let i = 0; i < 120; i++) {
  API.step(0.2);
  if (API.state.coins > coinBefore) { killed = true; break; }
}
check('タワーが敵を撃破してコインが増える', killed, { coins: API.state.coins, before: coinBefore });

console.log('\n=== 11) 鈍足付与（アイス魔導士） ===');
check('slow を持つタワーがある', Object.values(API.TOWERS).some(t => t.slow));
check('damageEnemy が slow を付与する', (() => {
  fresh();
  const ice = { U: { attr: 'bitter', slow: { mul: 0.5, dur: 1.4 }, splash: 0 }, dmg: 5 };
  const e = { hp: 100, maxHp: 100, U: API.ENEMIES.m_tank, attr: 'spicy', x: 0, y: 0, dead: false, slowT: 0, slowMul: 1 };
  API.world.enemies.push(e);
  API.damageEnemy(ice, e);
  return e.slowMul === 0.5 && e.slowT === 1.4;
})());

console.log(`\n==== RESULT: ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
