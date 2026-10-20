// Headless smoke test for raid.html（SUGAR RAID・クラクラ風）
// 使い方: node build_raid.js && node raid.smoke.js
const fs = require('fs'), vm = require('vm');
const html = fs.readFileSync(require('path').join(__dirname, 'raid.html'), 'utf8');
const code = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/)[1];

const store = {};
const sandbox = {
  console, Math, Date, JSON, __HEADLESS: true,
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
  location: { search: '' }, setTimeout: () => 0, clearTimeout() {}, requestAnimationFrame: () => 0, cancelAnimationFrame() {},
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
try { vm.runInContext(code, sandbox); } catch (e) { console.error('BOOT ERROR:', e.message); process.exit(1); }
const A = sandbox.__RAID;
if (!A) { console.error('no __RAID'); process.exit(1); }

let pass = 0, fail = 0;
function ok(c, msg) { if (c) pass++; else { fail++; console.error('FAIL:', msg); } }

// 決まった乱数で再現性を持たせる
let seed = 12345;
sandbox.Math = Object.create(Math);
Math.random = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

// 外周のマスを順番に返す（出撃位置）
function edgePoints(b) {
  const pts = [];
  for (let i = 0; i < A.COLS; i++) { pts.push([i + 0.5, 0.5], [i + 0.5, A.ROWS - 0.5], [0.5, i + 0.5], [A.COLS - 0.5, i + 0.5]); }
  return pts.filter(([x, y]) => A.canDeploy(b, x, y));
}
// 部隊を全部出して最後まで回す
function sim(idx, army, lv, spread) {
  const b = A.makeBattle(idx, army, lv || {});
  const pts = edgePoints(b);
  let pi = 0;
  for (const k of A.TROOP_ORDER) while ((b.left[k] || 0) > 0) {
    const p = spread ? pts[(pi++ * 7) % pts.length] : pts[0];
    A.deploy(b, k, p[0], p[1]);
  }
  let guard = 0;
  while (!b.ended && guard++ < 20000) A.step(b, 1 / 30);
  return b;
}

// 1) 全ステージが作れる（建物の重なり・はみ出しなし）
A.STAGES.forEach((s, i) => {
  try { const b = A.makeBattle(i, {}); ok(b.total > 0, `stage${i} has buildings`); ok(b.builds.some(x => x.type === 'th'), `stage${i} has th`); }
  catch (e) { ok(false, `stage${i} build error: ${e.message}`); }
});

// 2) 出撃できる場所：建物の上・となりは不可、外周は可
{
  const b = A.makeBattle(0, { cookie: 1 });
  ok(!A.canDeploy(b, 11, 11), 'cannot deploy on town hall');
  ok(!A.canDeploy(b, 9.5, 11), 'cannot deploy next to town hall');
  ok(A.canDeploy(b, 0.5, 0.5), 'can deploy at corner');
  ok(!A.canDeploy(b, -1, 3), 'cannot deploy outside map');
  ok(A.deploy(b, 'cookie', 0.5, 0.5) && b.left.cookie === 0, 'deploy consumes troop');
  ok(A.deploy(b, 'cookie', 0.5, 0.5) === null, 'cannot deploy without troops left');
}

// 3) 経路：壁で囲まれた城へは壁をこわして進む（経路が壁マスを通る）
{
  const b = A.makeBattle(1, { cookie: 1 });
  const th = b.builds.find(x => x.type === 'th');
  const path = A.findPath(b, 0.5, 11.5, th, 0.8);
  ok(path.length > 0, 'path to walled TH found');
  const throughWall = path.some(i => { const o = b.builds[b.occ[i]]; return b.occ[i] >= 0 && o.kind === 'wall'; });
  ok(throughWall, 'path goes through a wall when TH is enclosed');
}

// 4) 目標えらび：チョコ＝防衛、ゴースト＝資源、TNT＝壁
{
  const b = A.makeBattle(2, { choco: 1, ghost: 1, bomb: 1 });
  const c = A.deploy(b, 'choco', 0.5, 0.5), g = A.deploy(b, 'ghost', 0.5, 0.5), t = A.deploy(b, 'bomb', 0.5, 0.5);
  ok(A.pickTarget(b, c).kind === 'def', 'choco targets defense');
  ok(A.pickTarget(b, g).kind === 'res', 'ghost targets resource');
  ok(A.pickTarget(b, t).kind === 'wall', 'bomb targets wall');
}

// 5) TNT の爆発で壁がこわれる
{
  const b = A.makeBattle(1, { bomb: 2 });
  const walls0 = b.builds.filter(x => x.kind === 'wall' && !x.dead).length;
  A.deploy(b, 'bomb', 11.5, 0.5); A.deploy(b, 'bomb', 11.5, 0.5);
  for (let i = 0; i < 30 * 20 && !b.ended; i++) A.step(b, 1 / 30);
  const walls1 = b.builds.filter(x => x.kind === 'wall' && !x.dead).length;
  ok(walls1 < walls0, `bombs break walls (${walls0}→${walls1})`);
}

// 6) 何も出さずに時間切れ＝★0・破壊率0
{
  const b = A.makeBattle(0, { cookie: 5 });
  let g = 0; while (!b.ended && g++ < 10000) A.step(b, 0.1);
  ok(b.ended && A.starsOf(b) === 0 && A.pct(b) === 0, 'no deploy → 0 stars after timeout');
  ok(b.time <= 0, 'ended by timeout');
}

// 7) 村1：初期キャンプ(20)のおまかせ的編成で★1以上
{
  const b = sim(0, { cookie: 10, shoe: 10 }, {}, true);
  ok(A.starsOf(b) >= 1, `stage0 starter army gets ≥1 star (got ${A.starsOf(b)}, ${A.pct(b)}%)`);
  ok(b.loot > 0, 'loot gained on stage0');
}

// 8) 全滅すると終わる（時間切れ前）
{
  const b = sim(5, { cookie: 3 }, {}, false);
  ok(b.ended && b.time > 0, 'battle ends when all troops die');
  ok(A.starsOf(b) === 0, 'tiny army cannot star the capital');
}

// 9) 結果の反映：★はじめてボーナス・つぎの村の解放・部隊解放
{
  A.save = A.newSave();
  ok(A.stageOpen(0) && !A.stageOpen(1), 'only stage0 open at start');
  ok(!A.troopUnlocked('bomb'), 'bomb locked at start');
  const b = sim(0, { cookie: 10, shoe: 10 }, {}, true);
  const r = A.applyResult(b);
  ok(r.stars >= 1 && r.bonus > 0, 'first-star bonus granted');
  ok(A.save.coins === r.loot + r.bonus, 'coins = loot + bonus');
  ok(A.stageOpen(1), 'stage1 opens after starring stage0');
  ok(A.troopUnlocked('bomb'), 'bomb unlocks after 1 clear');
  // 同じ★でもう一度 → ボーナスなし
  const b2 = sim(0, { cookie: 10, shoe: 10 }, {}, true);
  const r2 = A.applyResult(b2);
  ok(r2.stars > r.stars || r2.bonus === 0, 'no bonus for already-earned stars');
}

// 10) 強化：🍬で部隊Lv・キャンプ容量が上がる
{
  A.save = A.newSave(); A.save.coins = 100000;
  const c0 = A.troopUpCost('cookie');
  ok(A.buyTroop('cookie') && A.save.lv.cookie === 2, 'troop level up');
  ok(A.troopUpCost('cookie') > c0, 'troop cost grows');
  const cap0 = A.campCap();
  ok(A.buyCamp() && A.campCap() > cap0, 'camp capacity up');
  A.save = A.newSave();
  ok(!A.buyTroop('cookie'), 'cannot buy without coins');
}

// 11) 部隊Lvでステータスが上がる
{
  const b = A.makeBattle(0, { cookie: 1 }, { cookie: 5 });
  const u = A.deploy(b, 'cookie', 0.5, 0.5);
  ok(u.max > A.TROOPS.cookie.hp, 'leveled troop has more hp');
}

// 12) 難易度の目安（試作バランス）：最終の村は最大キャンプ＋Lv5で★1以上取れる
{
  const army = { choco: 4, daifuku: 3, bomb: 4, shoe: 10, cookie: 8, ghost: 2 };   // 20+12+8+10+8+2 = 60
  const lv = {}; for (const k of A.TROOP_ORDER) lv[k] = 5;
  const b = sim(5, army, lv, true);
  ok(A.starsOf(b) >= 1, `capital beatable with max camp + Lv5 (got ${A.starsOf(b)}★ ${A.pct(b)}%)`);
  console.log(`  参考: 最終の村 Lv5/容量60 → ★${A.starsOf(b)} ${A.pct(b)}%`);
}

console.log(`raid smoke: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
