const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('index.html', 'utf-8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error('no script'); process.exit(1); }
let code = m[1];

// ---- DOM/環境スタブ ----
function makeEl(id) {
  const cls = new Set();
  return {
    id, _cls: cls, innerHTML: '', textContent: '', style: {},
    classList: {
      add: (...c) => c.forEach(x => cls.add(x)),
      remove: (...c) => c.forEach(x => cls.delete(x)),
      toggle: (c, on) => { if (on === undefined) { cls.has(c) ? cls.delete(c) : cls.add(c); } else { on ? cls.add(c) : cls.delete(c); } },
      contains: (c) => cls.has(c),
    },
    appendChild() {}, removeChild() {}, querySelector() { return null; },
    addEventListener() {}, removeEventListener() {}, getContext() { return ctxStub; },
    set onclick(v) {}, get offsetWidth() { return 100; },
    parentElement: { clientWidth: 440 },
    width: 440, height: 760,
  };
}
const els = {};
const ctxStub = new Proxy({}, { get: () => () => {} });
const documentStub = {
  getElementById: (id) => (els[id] = els[id] || makeEl(id)),
  createElement: () => makeEl('new'),
  querySelector: () => null, addEventListener() {},
  fonts: { ready: Promise.resolve() },
};
const windowStub = { addEventListener() {}, devicePixelRatio: 1, requestAnimationFrame() { return 0; } };
function ImageStub() { this.src = ''; this.onload = null; this.width = 128; this.height = 128; this.complete = true; }

const sandbox = {
  document: documentStub, window: windowStub, Image: ImageStub,
  performance: { now: () => Date.now() },
  requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
  setTimeout: (fn) => { if (typeof fn === 'function') fn(); return 0; }, // 即時実行（アニメ確定を進める）
  clearTimeout: () => {},
  console, Math, Object, Array, Set, Map, JSON, Date, parseInt, parseFloat,
  isNaN, isFinite, String, Number, Boolean,
};
sandbox.globalThis = sandbox;

// API露出
code += `
;globalThis.__API = {
  get CONFIG(){return CONFIG;}, get UNITS(){return UNITS;}, get UNIT_BY_KEY(){return UNIT_BY_KEY;},
  get SPECIALS(){return SPECIALS;}, get state(){return state;}, set state(v){state=v;},
  get world(){return world;}, set world(v){world=v;},
  resetState, createWorld, makeFighters, arrangeFormation,
  doubleUnitsOnBoard, applyX2Replay, eligibleX2Specials, eligibleSpecials,
  mergeAllSlimeGroups, countUnmergedSlimes, stepWorld, isSpecial, killUnit,
  evolvePancake, evolvedStep, nearestEnemy,
  beginDraft, nextPick, pickCard, lockAndFight, aiPicks, startGame,
  applyPartyFlag, applyCookieParty, playerCanParty, countSideKey,
  applyChocoBuff, applyBombSplit, applyDaifukuBuff, daifukuCleave, applyGhostClone, applyHit, applyCannonCluster, applySodaFizz, applyDonutWall, applyPancakeFast, applyShoeBuff, applyBakeryBuff, buffCountFor,
  setMyDeck:(d)=>{ myDeck = d; }, getMyDeck:()=>myDeck,
  endBattle, endGame, nextRound, resolveOverlaps,
  setupCanvas, CW_get:()=>CW, CH_get:()=>CH,
};
`;

const ctx = vm.createContext(sandbox);
vm.runInContext(code, ctx, { filename: 'game.js' });
const API = sandbox.globalThis.__API;

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, extra !== undefined ? '-> ' + JSON.stringify(extra) : ''); }
}

console.log('\n=== 1) SPECIALS 自動生成 ===');
const S = API.SPECIALS;
check('x2_choco 生成', !!S.x2_choco && S.x2_choco.x2 && S.x2_choco.target === 'choco');
check('x2_donut 生成', !!S.x2_donut);
check('x2_cannon 生成', !!S.x2_cannon);
check('slime はX2除外', !S.x2_slime);
check('ginger(召喚専用)はX2除外', !S.x2_ginger);
check('up_slime 健在', !!S.up_slime);
check('isSpecial(x2_choco)', API.isSpecial('x2_choco'));

console.log('\n=== 2) doubleUnitsOnBoard（8→16の倍増） ===');
API.resetState();
API.setupCanvas();
const W = API.CW_get() || 440, H = API.CH_get() || 760;
let w = API.createWorld(W, H);
API.world = w;
// chocoを8体（count2×4回ぶん）盤面に置く
for (let i = 0; i < 4; i++) API.makeFighters('choco', 'p', W, H, 'army').forEach(f => { f.appear = 1; w.units.push(f); });
let chocoBefore = w.units.filter(u => u.key === 'choco' && u.side === 'p').length;
check('複製前 choco=8', chocoBefore === 8, chocoBefore);
let added = API.doubleUnitsOnBoard(w, 'p', 'choco');
let chocoAfter = w.units.filter(u => u.key === 'choco' && u.side === 'p').length;
check('複製で +8 追加', added === 8, added);
check('複製後 choco=16', chocoAfter === 16, chocoAfter);
check('複製体は満タンHP', w.units.filter(u => u.key === 'choco').every(u => u.hp === u.maxHp));

console.log('\n=== 3) 軍上限(armyCap)を超えない ===');
let w2 = API.createWorld(W, H); API.world = w2;
// donutを20体置いてから倍増 → cap30で頭打ち
for (let i = 0; i < 20; i++) API.makeFighters('donut', 'p', W, H, 'army').forEach(f => { f.appear = 1; w2.units.push(f); });
let beforeN = w2.units.length;
let add2 = API.doubleUnitsOnBoard(w2, 'p', 'donut');
let totalN = w2.units.filter(u => u.side === 'p' && u.hp > 0).length;
check('X2上限(40)を超えない', totalN <= 40, totalN);
check('20体→倍増で+20(40以内)', add2 === 20, add2);

console.log('\n=== 4) 融合スライムの複製（強化ステータス維持） ===');
let w3 = API.createWorld(W, H); API.world = w3;
// slimeは1生成で3体。2回生成=6体→融合で巨大2体
for (let i = 0; i < 2; i++) API.makeFighters('slime', 'p', W, H, 'army').forEach(f => { f.appear = 1; w3.units.push(f); });
let slimeRaw = w3.units.filter(u => u.slime).length;
check('生成スライム6体', slimeRaw === 6, slimeRaw);
let merged = API.mergeAllSlimeGroups(w3, 'p'); // 6体→巨大2体
let bigs = w3.units.filter(u => u.slime && u.merged);
check('融合で巨大スライム2体', bigs.length === 2, bigs.length);
let bigHp = bigs[0].maxHp;
API.doubleUnitsOnBoard(w3, 'p', 'slime'); // 巨大含むスライムを倍増
let bigsAfter = w3.units.filter(u => u.slime && u.merged);
check('巨大スライムも倍に(2→4)', bigsAfter.length === 4, bigsAfter.length);
check('複製した巨大もmergedで同HP', bigsAfter.every(u => u.maxHp === bigHp));

console.log('\n=== 5) X2永続（applyX2Replay） ===');
let w4 = API.createWorld(W, H); API.world = w4;
for (let i = 0; i < 3; i++) API.makeFighters('cookie', 'p', W, H, 'army').forEach(f => { f.appear = 1; w4.units.push(f); });
let cookieBase = w4.units.filter(u => u.key === 'cookie').length; // 15
API.applyX2Replay(w4, 'p', { cookie: 1 });
let cookieX2 = w4.units.filter(u => u.key === 'cookie').length;
check('replay1回で倍(15→30相当, cap内)', cookieX2 === Math.min(30, cookieBase * 2), { cookieBase, cookieX2 });

console.log('\n=== 6) eligibleX2Specials の出現条件 ===');
let w5 = API.createWorld(W, H); API.world = w5;
API.makeFighters('cannon', 'p', W, H, 'army').forEach(f => { f.appear = 1; w5.units.push(f); }); // 1体
API.makeFighters('cannon', 'p', W, H, 'army').forEach(f => { f.appear = 1; w5.units.push(f); }); // 2体
let elig1 = API.eligibleX2Specials();
check('2体ではX2候補に出ない(X2_MIN=3)', !elig1.includes('x2_cannon'), elig1);
API.makeFighters('cannon', 'p', W, H, 'army').forEach(f => { f.appear = 1; w5.units.push(f); }); // 3体に
let elig2 = API.eligibleX2Specials();
check('3体でX2候補に出る(cannon)', elig2.includes('x2_cannon'), elig2);

console.log('\n=== 7) pickCardでX2取得→永続カウンタ更新 ===');
// フルなドラフト状態を作る
API.resetState();
API.setMyDeck(['choco', 'cookie', 'donut', 'shoe']);
API.startGame(); // beginDraftまで走る
let st = API.state;
let wd = API.world;
// 盤面にchocoを足してX2を直接ピック（pickCardはisSpecialを直接処理）
for (let i = 0; i < 3; i++) API.makeFighters('choco', 'p', wd.W, wd.H, 'army').forEach(f => { f.appear = 1; wd.units.push(f); });
let chBefore = wd.units.filter(u => u.key === 'choco' && u.side === 'p').length;
st.pickTotal = 5; st.pickStep = 1; // 余裕を持たせる
API.pickCard('x2_choco');
let chAfter = API.world.units.filter(u => u.key === 'choco' && u.side === 'p').length;
check('pickCard(x2_choco)で倍増', chAfter === Math.min(30, chBefore * 2), { chBefore, chAfter });
check('state.youX2.choco がカウントされた', API.state.youX2.choco === 1, API.state.youX2);

console.log('\n=== 8) 戦闘が詰まらず決着する（10戦） ===');
let results = { win: 0, lose: 0, draw: 0, stuck: 0 };
for (let g = 0; g < 10; g++) {
  API.resetState();
  API.setMyDeck(['choco', 'cookie', 'donut', 'shoe']);
  API.startGame();
  let st = API.state; let wd = API.world;
  // ドラフトを自動消化：毎回1枚目を選ぶ（special含む）
  let guard = 0;
  while (st.pickStep < st.pickTotal && guard++ < 50) {
    const key = st.offer3[0];
    API.pickCard(key);
  }
  API.lockAndFight();
  wd = API.world;
  // 戦闘ループ
  let t = 0, frames = 0;
  wd.intro = 0;
  while (!wd.done && frames < 60 * 40) { // 最大40秒ぶん
    API.stepWorld(wd, 1 / 60); frames++; t += 1 / 60;
  }
  if (wd.done) { results[wd.result] = (results[wd.result] || 0) + 1; }
  else { results.stuck++; }
}
check('全戦が決着（詰まりゼロ）', results.stuck === 0, results);
console.log('  戦績:', JSON.stringify(results));

console.log('\n=== 9) 戦闘エンジンの左右対称性（同一軍を直接配置, 40戦） ===');
function runBattleSym(buildArmy) {
  let wd = API.createWorld(W, H); API.world = wd;
  buildArmy(wd);
  API.arrangeFormation(wd, 'p', true);
  API.arrangeFormation(wd, 'e', true);
  wd.phase = 'battle'; wd.intro = 0; wd.t = 0; wd.done = false;
  let frames = 0;
  while (!wd.done && frames < 60 * 45) { API.stepWorld(wd, 1 / 60); frames++; }
  return wd.done ? wd.result : 'stuck';
}
let sym = { win: 0, lose: 0, draw: 0, stuck: 0 };
const symKeys = ['cookie', 'choco', 'shoe', 'bomb', 'donut'];
for (let g = 0; g < 60; g++) {   // 試行数を増やして勝率の分散を抑える（左右対称はエンジンの毎フレームshuffleで担保）
  const r = runBattleSym((wd) => {
    symKeys.forEach(k => {
      API.makeFighters(k, 'p', W, H, 'army').forEach(f => { f.appear = 1; wd.units.push(f); });
      API.makeFighters(k, 'e', W, H, 'army').forEach(f => { f.appear = 1; wd.units.push(f); });
    });
  });
  sym[r] = (sym[r] || 0) + 1;
}
console.log('  対称戦績:', JSON.stringify(sym));
check('対称戦で詰まりゼロ', sym.stuck === 0, sym);
const swr = sym.win / (sym.win + sym.lose || 1);
check('左右対称：勝率がほぼ五分(0.30〜0.70)', swr >= 0.30 && swr <= 0.70, swr.toFixed(2));

console.log('\n=== 10) X2が効いている（X2軍 vs 無強化軍, 30戦） ===');
let x2res = { win: 0, lose: 0, draw: 0, stuck: 0 };
for (let g = 0; g < 30; g++) {
  let wd = API.createWorld(W, H); API.world = wd;
  // 自分(p)はchocoをX2、敵(e)は同数の素のchoco… ではなく、両者choco4体、自分だけX2で8体
  for (let i = 0; i < 2; i++) {
    API.makeFighters('choco', 'p', W, H, 'army').forEach(f => { f.appear = 1; wd.units.push(f); });
    API.makeFighters('choco', 'e', W, H, 'army').forEach(f => { f.appear = 1; wd.units.push(f); });
  }
  API.doubleUnitsOnBoard(wd, 'p', 'choco'); // 自分だけ倍
  API.arrangeFormation(wd, 'p', true); API.arrangeFormation(wd, 'e', true);
  wd.phase = 'battle'; wd.intro = 0; wd.done = false;
  let frames = 0;
  while (!wd.done && frames < 60 * 45) { API.stepWorld(wd, 1 / 60); frames++; }
  x2res[wd.done ? wd.result : 'stuck']++;
}
console.log('  X2有利戦績:', JSON.stringify(x2res));
check('X2側が有意に勝ち越す(win率>0.7)', x2res.win / (x2res.win + x2res.lose || 1) > 0.7, x2res);

console.log('\n=== 11) ランニングソーダ＆炭酸沼 ===');
// UNITS定義
const sodaDef = API.UNITS.find(u => u.key === 'soda');
check('soda が UNITS にある', !!sodaDef);
check('soda は suicide+puddle', sodaDef && sodaDef.suicide && sodaDef.puddle);
check('x2_soda 自動生成（非召喚・非スライム）', !!API.SPECIALS.x2_soda);
// makeFightersがpuddleフラグをコピー
let sf = API.makeFighters('soda', 'p', W, H, 'army')[0];
check('fighterにpuddleフラグ', sf.puddle && sf.puddleR > 0 && sf.puddleDps > 0 && sf.puddleSlow > 0);
check('fighterにslowMul初期値1', sf.slowMul === 1);

// killUnitで沼が発生し、blastも出る
let wp = API.createWorld(W, H); API.world = wp;
let soda = API.makeFighters('soda', 'p', W, H, 'army')[0];
soda.x = W / 2; soda.y = H / 2; soda.appear = 1; wp.units.push(soda);
// 近くに敵を置く（blast範囲内）
let foe = API.makeFighters('cookie', 'e', W, H, 'army');
foe.forEach((f, i) => { f.x = W / 2 + (i - 2) * 8; f.y = H / 2 + 6; f.appear = 1; wp.units.push(f); });
let foeHpBefore = foe[0].hp;
API.killUnit(wp, soda);
check('爆発で沼が1つ発生', wp.puddles.length === 1, wp.puddles.length);
check('沼はプレイヤー側(side=p, 敵に効く)', wp.puddles[0] && wp.puddles[0].side === 'p');
check('blastで近くの敵にダメージ', foe[0].hp < foeHpBefore, { before: foeHpBefore, after: foe[0].hp });

// 沼のDoT＆スローを数フレーム回して検証（近接攻撃の影響を排除するためcoolを大きくする）
let wd2 = API.createWorld(W, H); API.world = wd2;
wd2.phase = 'battle'; wd2.intro = 0;
let target = API.makeFighters('cookie', 'e', W, H, 'army')[0];
target.x = W / 2; target.y = H / 2; target.appear = 1; target.cool = 999; wd2.units.push(target);
let ally = API.makeFighters('cookie', 'p', W, H, 'army')[0];
ally.x = W / 2; ally.y = H / 2 + 4; ally.appear = 1; ally.cool = 999; wd2.units.push(ally); // 同じ場所の味方
wd2.puddles.push({ x: W / 2, y: H / 2, r: 70, life: 2.0, maxLife: 2.0, side: 'p', dps: 16, slow: 0.45, bub: 0 });
let tHp0 = target.hp, aHp0 = ally.hp;
let slowSeen = false;
for (let i = 0; i < 4; i++) {
  API.stepWorld(wd2, 1 / 60);
  if (target.slowMul && target.slowMul < 1) slowSeen = true;
}
check('沼の上の敵がDoTで減少', target.hp < tHp0, { before: tHp0, after: target.hp });
check('沼上の敵にスロー(slowMul<1)', slowSeen, target.slowMul);
check('味方(同側)はDoTを受けない', ally.hp === aHp0, { a0: aHp0, a: ally.hp });

// 沼が消えたらスローが解除される
let wd3 = API.createWorld(W, H); API.world = wd3;
wd3.phase = 'battle'; wd3.intro = 0;
let e2 = API.makeFighters('cookie', 'e', W, H, 'army')[0]; e2.x = W / 2; e2.y = H / 2; e2.appear = 1; wd3.units.push(e2);
let p2 = API.makeFighters('cookie', 'p', W, H, 'army')[0]; p2.x = W / 2; p2.y = H - 30; p2.appear = 1; wd3.units.push(p2);
wd3.puddles.push({ x: W / 2, y: H / 2, r: 70, life: 1 / 30, maxLife: 1 / 30, side: 'p', dps: 16, slow: 0.45, bub: 0 });
API.stepWorld(wd3, 1 / 60); // 沼有効
API.stepWorld(wd3, 1 / 60); // 沼寿命切れ
API.stepWorld(wd3, 1 / 60); // 解除後
check('沼消滅後にスロー解除(slowMul=1)', e2.slowMul === 1, e2.slowMul);
check('沼は寿命切れで除去された', wd3.puddles.length === 0, wd3.puddles.length);

console.log('\n=== 12) ソーダ入りデッキで戦闘が詰まらない（10戦） ===');
let sodaRes = { win: 0, lose: 0, draw: 0, stuck: 0 };
for (let g = 0; g < 10; g++) {
  API.resetState();
  API.setMyDeck(['soda', 'choco', 'shoe', 'cookie']);
  API.startGame();
  let st = API.state;
  let guard = 0;
  while (st.pickStep < st.pickTotal && guard++ < 50) {
    // 強化カードでない実ユニットを優先して選ぶ（軍を確実に育てる）
    let key = st.offer3.find(k => !API.isSpecial(k)) || st.offer3[0];
    API.pickCard(key);
  }
  API.lockAndFight();
  let wd = API.world; wd.intro = 0;
  let frames = 0;
  while (!wd.done && frames < 60 * 45) { API.stepWorld(wd, 1 / 60); frames++; }
  sodaRes[wd.done ? wd.result : 'stuck']++;
}
console.log('  ソーダ戦績:', JSON.stringify(sodaRes));
check('ソーダ戦で詰まりゼロ', sodaRes.stuck === 0, sodaRes);

console.log('\n=== 13) パンケーキキング（時間進化＆ジャンプ衝撃波） ===');
const pkDef = API.UNITS.find(u => u.key === 'pancake');
check('pancake が UNITS にある', !!pkDef);
check('pancake は evolve フラグ持ち', pkDef && pkDef.evolve === true);
check('stage1 はやや脆い(約150)', pkDef && pkDef.hp >= 120 && pkDef.hp <= 180);
check('x2_pancake 自動生成', !!API.SPECIALS.x2_pancake);
let pf = API.makeFighters('pancake', 'p', W, H, 'army')[0];
check('fighter初期は未進化', pf.evolve && pf.evolved === false);
check('evolveAt が約10秒', pf.evolveAt === 10);

// 進化前は普通の前衛として動く（generic path）。world.t<evolveAtでは進化しない
let wpk = API.createWorld(W, H); API.world = wpk;
wpk.phase = 'battle'; wpk.intro = 0; wpk.t = 5;
let pk = API.makeFighters('pancake', 'p', W, H, 'army')[0];
pk.x = W / 2; pk.y = H - 60; pk.appear = 1; wpk.units.push(pk);
let foeP = API.makeFighters('cookie', 'e', W, H, 'army');
foeP.forEach(f => { f.x = W / 2; f.y = 60; f.appear = 1; wpk.units.push(f); });
API.stepWorld(wpk, 1 / 60);
check('t=5秒では未進化', pk.evolved === false, { t: wpk.t, evolved: pk.evolved });
let hpStage1 = pk.maxHp;

// 進化関数：HP大幅増＆全回復、進化フラグ
let pre = pk.maxHp;
API.evolvePancake(wpk, pk);
check('進化でmaxHp大幅増(>=1.8倍)', pk.maxHp >= pre * 1.8, { pre, post: pk.maxHp });
check('進化で全回復(hp==maxHp)', pk.hp === pk.maxHp);
check('進化フラグon', pk.evolved === true);

// 進化後：ジャンプ→着地で衝撃波が敵に範囲ダメージ
let wj = API.createWorld(W, H); API.world = wj;
wj.phase = 'battle'; wj.intro = 0; wj.t = 11;
let king = API.makeFighters('pancake', 'p', W, H, 'army')[0];
king.x = W / 2; king.y = H / 2; king.appear = 1;
API.evolvePancake(wj, king); king.cool = 0; // すぐジャンプできる状態
wj.units.push(king);
// 衝撃波範囲内に敵を密集
let victims = [];
for (let i = 0; i < 5; i++) { let c = API.makeFighters('cookie', 'e', W, H, 'army')[0]; c.x = W / 2 + (i - 2) * 6; c.y = H / 2 + 10; c.appear = 1; wj.units.push(c); victims.push(c); }
let vHp0 = victims.map(v => v.hp);
// ジャンプ開始→着地まで十分なフレームを回す
let landed = false;
for (let i = 0; i < 120 && !landed; i++) {
  API.stepWorld(wj, 1 / 60);
  if (king.jumpT > 0) { /* ジャンプ中 */ }
  // 着地検知：誰かがダメージを受けたら
  if (victims.some((v, idx) => v.hp < vHp0[idx])) landed = true;
}
check('ジャンプ衝撃波で範囲ダメージが入った', landed, { sample: victims[2] && victims[2].hp });

console.log('\n=== 14) 進化が戦闘中に自然発火する（時間経過テスト） ===');
let wevo = API.createWorld(W, H); API.world = wevo;
wevo.phase = 'battle'; wevo.intro = 0; wevo.t = 0;
let solo = API.makeFighters('pancake', 'p', W, H, 'army')[0];
solo.x = W / 2; solo.y = H - 50; solo.appear = 1; solo.hp = 99999; wevo.units.push(solo); // 進化タイマー検証なので戦闘で死なないようHPを盛る
// 遠くに敵（すぐ決着しないように硬めのを1体）
let far = API.makeFighters('choco', 'e', W, H, 'army')[0]; far.x = W / 2; far.y = 50; far.appear = 1; far.hp = far.maxHp = 9999; wevo.units.push(far);
let evolvedAtT = null;
for (let i = 0; i < 60 * 13 && !evolvedAtT; i++) {
  API.stepWorld(wevo, 1 / 60);
  if (solo.evolved) evolvedAtT = wevo.t;
}
check('約10秒前後で進化が発火', evolvedAtT !== null && evolvedAtT >= 9.5 && evolvedAtT <= 11.5, evolvedAtT);

console.log('\n=== 15) パンケーキ入りデッキで戦闘が詰まらない（10戦, 長め） ===');
let pkRes = { win: 0, lose: 0, draw: 0, stuck: 0 };
for (let g = 0; g < 10; g++) {
  API.resetState();
  API.setMyDeck(['pancake', 'choco', 'shoe', 'cookie']);
  API.startGame();
  let st = API.state;
  let guard = 0;
  while (st.pickStep < st.pickTotal && guard++ < 50) {
    let key = st.offer3.find(k => !API.isSpecial(k)) || st.offer3[0];
    API.pickCard(key);
  }
  API.lockAndFight();
  let wd = API.world; wd.intro = 0;
  let frames = 0;
  while (!wd.done && frames < 60 * 50) { API.stepWorld(wd, 1 / 60); frames++; }
  pkRes[wd.done ? wd.result : 'stuck']++;
}
console.log('  パンケーキ戦績:', JSON.stringify(pkRes));
check('パンケーキ戦で詰まりゼロ', pkRes.stuck === 0, pkRes);

console.log('\n=== 16) クッキーパーティー（固有強化カード） ===');
check('party_cookie が SPECIALS にある', !!API.SPECIALS.party_cookie);
check('party_cookie は upgrade+party, target=cookie', API.SPECIALS.party_cookie && API.SPECIALS.party_cookie.upgrade && API.SPECIALS.party_cookie.party && API.SPECIALS.party_cookie.target === 'cookie');
check('isSpecial(party_cookie)', API.isSpecial('party_cookie'));
check('cookie は x2 も生成される(party と併存)', !!API.SPECIALS.x2_cookie);

// 出現条件：クッキーが PARTY_MIN(3) 未満では出ない、3以上で出る（未取得時）
API.resetState();
let wcp = API.createWorld(W, H); API.world = wcp;
API.makeFighters('cookie', 'p', W, H, 'army').forEach(f => { f.appear = 1; wcp.units.push(f); }); // 5体
check('クッキー5体・未取得ならパーティー候補に出る', API.eligibleSpecials().includes('party_cookie'));
API.state.youParty = true;
check('取得済みなら候補に出ない', !API.eligibleSpecials().includes('party_cookie'));
API.state.youParty = false;
// 2体だけの状況では出ない
let wcp2 = API.createWorld(W, H); API.world = wcp2;
let two = API.makeFighters('cookie', 'p', W, H, 'army').slice(0, 2);
two.forEach(f => { f.appear = 1; wcp2.units.push(f); });
check('クッキー2体(<3)では候補に出ない', !API.eligibleSpecials().includes('party_cookie'));

// applyPartyFlag：味方クッキーだけに party が付く
let wcp3 = API.createWorld(W, H); API.world = wcp3;
API.makeFighters('cookie', 'p', W, H, 'army').forEach(f => { f.appear = 1; wcp3.units.push(f); });
API.makeFighters('cookie', 'e', W, H, 'army').forEach(f => { f.appear = 1; wcp3.units.push(f); });
API.makeFighters('choco', 'p', W, H, 'army').forEach(f => { f.appear = 1; wcp3.units.push(f); });
API.applyPartyFlag(wcp3, 'p');
check('味方クッキーに party 付与', wcp3.units.filter(u => u.side === 'p' && u.key === 'cookie').every(u => u.party));
check('敵クッキーには付かない', wcp3.units.filter(u => u.side === 'e' && u.key === 'cookie').every(u => !u.party));
check('味方チョコには付かない', wcp3.units.filter(u => u.key === 'choco').every(u => !u.party));

// 近接段階バフ：密集したパーティークッキーは攻撃が上がる／孤立クッキーは素のまま
let wcp4 = API.createWorld(W, H); API.world = wcp4;
wcp4.phase = 'battle'; wcp4.intro = 0;
let cluster = API.makeFighters('cookie', 'p', W, H, 'army'); // 5体
cluster.forEach((f, i) => { f.x = W / 2 + (i - 2) * 6; f.y = H / 2; f.appear = 1; f.party = true; wcp4.units.push(f); }); // 密集
let lone = API.makeFighters('cookie', 'p', W, H, 'army')[0];
lone.x = 10; lone.y = 10; lone.appear = 1; lone.party = true; wcp4.units.push(lone); // 遠く離して孤立
let baseAtk = cluster[0].baseAtk;
API.applyCookieParty(wcp4, 1 / 60);
let clusterMid = cluster[2]; // 中央のクッキーは近接数が最大
check('密集クッキーは段階>0', clusterMid.partyStage > 0, clusterMid.partyStage);
check('密集クッキーの攻撃が素より上がる', clusterMid.atk > baseAtk, { base: baseAtk, now: clusterMid.atk });
check('孤立クッキーは段階0・素の攻撃', lone.partyStage === 0 && lone.atk === baseAtk, { stage: lone.partyStage, atk: lone.atk });
check('密集クッキーは速度も上がる', clusterMid.speed > clusterMid.baseSpeed, { base: clusterMid.baseSpeed, now: clusterMid.speed });

// party 無しのクッキーはバフを受けない
let wcp5 = API.createWorld(W, H); API.world = wcp5;
let plain = API.makeFighters('cookie', 'p', W, H, 'army');
plain.forEach((f, i) => { f.x = W / 2 + (i - 2) * 6; f.y = H / 2; f.appear = 1; wcp5.units.push(f); }); // party=false
API.applyCookieParty(wcp5, 1 / 60);
check('party未取得クッキーはバフ無し(atk=base)', plain.every(u => u.atk === u.baseAtk && u.partyStage === 0));

// pickCard('party_cookie') で state.youParty が立ち、盤面クッキーに付与される
API.resetState();
API.setMyDeck(['cookie', 'choco', 'shoe', 'donut']);
API.startGame();
let stp = API.state; let wdp = API.world;
API.makeFighters('cookie', 'p', wdp.W, wdp.H, 'army').forEach(f => { f.appear = 1; wdp.units.push(f); });
stp.pickTotal = 5; stp.pickStep = 1;
API.pickCard('party_cookie');
check('pickCardでstate.youParty=true', API.state.youParty === true);
check('盤面クッキーがparty状態に', API.world.units.filter(u => u.side === 'p' && u.key === 'cookie').every(u => u.party));

// パーティー軍は無強化クッキー軍に勝ち越す（密度バフの実効性, 30戦）
let partyRes = { win: 0, lose: 0, draw: 0, stuck: 0 };
for (let g = 0; g < 30; g++) {
  let wd = API.createWorld(W, H); API.world = wd;
  for (let i = 0; i < 3; i++) {
    API.makeFighters('cookie', 'p', W, H, 'army').forEach(f => { f.appear = 1; wd.units.push(f); });
    API.makeFighters('cookie', 'e', W, H, 'army').forEach(f => { f.appear = 1; wd.units.push(f); });
  }
  API.applyPartyFlag(wd, 'p'); // 自分だけパーティー
  API.arrangeFormation(wd, 'p', true); API.arrangeFormation(wd, 'e', true);
  wd.phase = 'battle'; wd.intro = 0; wd.done = false;
  let frames = 0;
  while (!wd.done && frames < 60 * 45) { API.stepWorld(wd, 1 / 60); frames++; }
  partyRes[wd.done ? wd.result : 'stuck']++;
}
console.log('  パーティー有利戦績:', JSON.stringify(partyRes));
check('パーティー側が詰まりゼロ', partyRes.stuck === 0, partyRes);
check('パーティー側が勝ち越す(win率>0.6)', partyRes.win / (partyRes.win + partyRes.lose || 1) > 0.6, partyRes);

// クッキーパーティー入りデッキで戦闘が詰まらない（10戦）
let cpRes = { win: 0, lose: 0, draw: 0, stuck: 0 };
for (let g = 0; g < 10; g++) {
  API.resetState();
  API.setMyDeck(['cookie', 'choco', 'shoe', 'bomb']);
  API.startGame();
  let st = API.state;
  let guard = 0;
  while (st.pickStep < st.pickTotal && guard++ < 50) {
    const key = st.offer3[0];
    API.pickCard(key);
  }
  API.lockAndFight();
  let wd = API.world; wd.intro = 0;
  let frames = 0;
  while (!wd.done && frames < 60 * 45) { API.stepWorld(wd, 1 / 60); frames++; }
  cpRes[wd.done ? wd.result : 'stuck']++;
}
console.log('  クッキーデッキ戦績:', JSON.stringify(cpRes));
check('クッキーパーティー入りデッキで詰まりゼロ', cpRes.stuck === 0, cpRes);

console.log('\n=== 17) ビター装甲（チョコレートナイト固有強化・1回限り） ===');
check('buff_choco が SPECIALS にある', !!API.SPECIALS.buff_choco);
check('buff_choco は upgrade+chocoBuff, target=choco', API.SPECIALS.buff_choco && API.SPECIALS.buff_choco.upgrade && API.SPECIALS.buff_choco.chocoBuff && API.SPECIALS.buff_choco.target === 'choco');
check('isSpecial(buff_choco)', API.isSpecial('buff_choco'));
check('choco は x2 も生成される(装甲と併存)', !!API.SPECIALS.x2_choco);

// 出現条件：チョコが CHOCO_MIN(2) 以上で出る／未満では出ない。1回限りなので取得済みでは出ない
API.resetState();
let wbc = API.createWorld(W, H); API.world = wbc;
API.makeFighters('choco', 'p', W, H, 'army').forEach(f => { f.appear = 1; wbc.units.push(f); }); // 2体
check('チョコ2体で装甲候補に出る', API.eligibleSpecials().includes('buff_choco'));
API.state.youChocoBuff = true;
check('取得済みなら候補に出ない', !API.eligibleSpecials().includes('buff_choco'));
API.state.youChocoBuff = false;
let wbc0 = API.createWorld(W, H); API.world = wbc0;
let one = API.makeFighters('choco', 'p', W, H, 'army').slice(0, 1);
one.forEach(f => { f.appear = 1; wbc0.units.push(f); });
check('チョコ1体(<2)では候補に出ない', !API.eligibleSpecials().includes('buff_choco'));

// applyChocoBuff：HP・攻撃が基準から上昇し、見た目(spriteScale)と当たり判定(r)が増す。味方チョコのみ。
let wbc2 = API.createWorld(W, H); API.world = wbc2;
let cs = API.makeFighters('choco', 'p', W, H, 'army');
cs.forEach(f => { f.appear = 1; wbc2.units.push(f); });
API.makeFighters('choco', 'e', W, H, 'army').forEach(f => { f.appear = 1; wbc2.units.push(f); });
API.makeFighters('cookie', 'p', W, H, 'army').forEach(f => { f.appear = 1; wbc2.units.push(f); });
const baseHp = cs[0].baseMaxHp, baseAtk2 = cs[0].baseAtk, baseScale = cs[0].spriteScale, baseR = cs[0].baseR;
API.applyChocoBuff(wbc2, 'p');
const me = wbc2.units.find(u => u.side === 'p' && u.key === 'choco');
check('HPが上がる', me.maxHp > baseHp && me.hp === me.maxHp, { base: baseHp, now: me.maxHp });
check('攻撃が上がる', me.atk > baseAtk2, { base: baseAtk2, now: me.atk });
check('見た目が大きくなる', me.spriteScale > baseScale, { base: baseScale, now: me.spriteScale });
check('当たり判定も増す', me.r > baseR, { base: baseR, now: me.r });
check('chocoBuff フラグが立つ', me.chocoBuff === true);
check('敵チョコには適用されない', wbc2.units.filter(u => u.side === 'e' && u.key === 'choco').every(u => !u.chocoBuff && u.maxHp === u.baseMaxHp));
check('味方クッキーには適用されない', wbc2.units.filter(u => u.key === 'cookie').every(u => !u.chocoBuff));

// 冪等性：2回呼んでも1回ぶんの強化のまま（重ねがけしない）
let wbc3 = API.createWorld(W, H); API.world = wbc3;
let cs1 = API.makeFighters('choco', 'p', W, H, 'army'); cs1.forEach(f => { f.appear = 1; wbc3.units.push(f); });
API.applyChocoBuff(wbc3, 'p'); const hp1 = cs1[0].maxHp, atk1 = cs1[0].atk;
API.applyChocoBuff(wbc3, 'p'); const hp2 = cs1[0].maxHp, atk2 = cs1[0].atk;
check('2回適用しても重ねがけしない(HP不変)', hp2 === hp1, { hp1, hp2 });
check('2回適用しても重ねがけしない(攻撃不変)', atk2 === atk1, { atk1, atk2 });

// pickCard('buff_choco') で state.youChocoBuff が立ち、盤面チョコが強化される
API.resetState();
API.setMyDeck(['choco', 'cookie', 'shoe', 'donut']);
API.startGame();
let stc = API.state; let wdc = API.world;
API.makeFighters('choco', 'p', wdc.W, wdc.H, 'army').forEach(f => { f.appear = 1; wdc.units.push(f); });
const chHp0 = wdc.units.find(u => u.side === 'p' && u.key === 'choco').baseMaxHp;
stc.pickTotal = 5; stc.pickStep = 1;
API.pickCard('buff_choco');
check('pickCardでstate.youChocoBuff=true', API.state.youChocoBuff === true);
check('盤面チョコが強化された', API.world.units.filter(u => u.side === 'p' && u.key === 'choco').every(u => u.chocoBuff === true && u.maxHp > chHp0));

// 装甲チョコ軍 vs 無強化チョコ軍：強化側が勝ち越す（30戦）
let bcRes = { win: 0, lose: 0, draw: 0, stuck: 0 };
for (let g = 0; g < 30; g++) {
  let wd = API.createWorld(W, H); API.world = wd;
  for (let i = 0; i < 2; i++) {
    API.makeFighters('choco', 'p', W, H, 'army').forEach(f => { f.appear = 1; wd.units.push(f); });
    API.makeFighters('choco', 'e', W, H, 'army').forEach(f => { f.appear = 1; wd.units.push(f); });
  }
  API.applyChocoBuff(wd, 'p'); // 自分だけ装甲
  API.arrangeFormation(wd, 'p', true); API.arrangeFormation(wd, 'e', true);
  wd.phase = 'battle'; wd.intro = 0; wd.done = false;
  let frames = 0;
  while (!wd.done && frames < 60 * 45) { API.stepWorld(wd, 1 / 60); frames++; }
  bcRes[wd.done ? wd.result : 'stuck']++;
}
console.log('  ビター装甲有利戦績:', JSON.stringify(bcRes));
check('装甲側が詰まりゼロ', bcRes.stuck === 0, bcRes);
check('装甲側が勝ち越す(win率>0.7)', bcRes.win / (bcRes.win + bcRes.lose || 1) > 0.7, bcRes);

// チョコ装甲入りデッキで戦闘が詰まらない（10戦）
let chDeck = { win: 0, lose: 0, draw: 0, stuck: 0 };
for (let g = 0; g < 10; g++) {
  API.resetState();
  API.setMyDeck(['choco', 'cookie', 'shoe', 'bomb']);
  API.startGame();
  let st = API.state;
  let guard = 0;
  while (st.pickStep < st.pickTotal && guard++ < 50) {
    const key = st.offer3[0];
    API.pickCard(key);
  }
  API.lockAndFight();
  let wd = API.world; wd.intro = 0;
  let frames = 0;
  while (!wd.done && frames < 60 * 45) { API.stepWorld(wd, 1 / 60); frames++; }
  chDeck[wd.done ? wd.result : 'stuck']++;
}
console.log('  チョコデッキ戦績:', JSON.stringify(chDeck));
check('チョコ装甲入りデッキで詰まりゼロ', chDeck.stuck === 0, chDeck);

console.log('\n=== 18) おかわりポップコーン（ポップコーンTNT固有強化・1回限り） ===');
check('split_bomb が SPECIALS にある', !!API.SPECIALS.split_bomb);
check('split_bomb は upgrade+bombSplit, target=bomb', API.SPECIALS.split_bomb && API.SPECIALS.split_bomb.upgrade && API.SPECIALS.split_bomb.bombSplit && API.SPECIALS.split_bomb.target === 'bomb');
check('isSpecial(split_bomb)', API.isSpecial('split_bomb'));
const miniDef = API.UNIT_BY_KEY['popcorn_mini'];
check('popcorn_mini が UNITS にある', !!miniDef);
check('popcorn_mini は summonOnly（ドラフト/X2に出ない）', miniDef && miniDef.summonOnly === true);
check('popcorn_mini は suicide+blast', miniDef && miniDef.suicide && miniDef.blast > 0);
check('popcorn_mini は X2自動生成されない', !API.SPECIALS.x2_popcorn_mini);
check('小型は本体より弱い（HP/爆発）', miniDef.hp < API.UNIT_BY_KEY['bomb'].hp && miniDef.blast < API.UNIT_BY_KEY['bomb'].blast);

// 出現条件：ポップコーンが BOMB_MIN(2) 以上で出る／未満では出ない／取得済みでは出ない
API.resetState();
let wsb = API.createWorld(W, H); API.world = wsb;
API.makeFighters('bomb', 'p', W, H, 'army').forEach(f => { f.appear = 1; wsb.units.push(f); }); // 2体
check('ポップコーン2体で候補に出る', API.eligibleSpecials().includes('split_bomb'));
API.state.youBombSplit = true;
check('取得済みなら候補に出ない', !API.eligibleSpecials().includes('split_bomb'));
API.state.youBombSplit = false;
let wsb0 = API.createWorld(W, H); API.world = wsb0;
API.makeFighters('bomb', 'p', W, H, 'army').slice(0, 1).forEach(f => { f.appear = 1; wsb0.units.push(f); });
check('ポップコーン1体(<2)では候補に出ない', !API.eligibleSpecials().includes('split_bomb'));

// applyBombSplit：味方ポップコーンに spawnMini フラグが付く（敵・他キャラには付かない）
let wsb2 = API.createWorld(W, H); API.world = wsb2;
API.makeFighters('bomb', 'p', W, H, 'army').forEach(f => { f.appear = 1; wsb2.units.push(f); });
API.makeFighters('bomb', 'e', W, H, 'army').forEach(f => { f.appear = 1; wsb2.units.push(f); });
API.makeFighters('cookie', 'p', W, H, 'army').forEach(f => { f.appear = 1; wsb2.units.push(f); });
API.applyBombSplit(wsb2, 'p');
check('味方ポップコーンに spawnMini 付与', wsb2.units.filter(u => u.side === 'p' && u.key === 'bomb').every(u => u.spawnMini));
check('敵ポップコーンには付かない', wsb2.units.filter(u => u.side === 'e' && u.key === 'bomb').every(u => !u.spawnMini));
check('味方クッキーには付かない', wsb2.units.filter(u => u.key === 'cookie').every(u => !u.spawnMini));

// killUnit：spawnMini付きが死ぬと小型が1体出現／フラグ無しでは出ない
let wsb3 = API.createWorld(W, H); API.world = wsb3;
let bomb1 = API.makeFighters('bomb', 'p', W, H, 'army')[0];
bomb1.x = W / 2; bomb1.y = H / 2; bomb1.appear = 1; bomb1.spawnMini = true; wsb3.units.push(bomb1);
API.killUnit(wsb3, bomb1);
let minis = wsb3.units.filter(u => u.key === 'popcorn_mini');
check('おかわりで小型が1体出る', minis.length === 1, minis.length);
check('小型は味方側', minis[0] && minis[0].side === 'p');
check('小型は spawnMini を持たない（再分裂しない）', minis[0] && !minis[0].spawnMini);

let wsb4 = API.createWorld(W, H); API.world = wsb4;
let bomb2 = API.makeFighters('bomb', 'p', W, H, 'army')[0];
bomb2.x = W / 2; bomb2.y = H / 2; bomb2.appear = 1; wsb4.units.push(bomb2); // spawnMini無し
API.killUnit(wsb4, bomb2);
check('フラグ無しでは小型が出ない', wsb4.units.filter(u => u.key === 'popcorn_mini').length === 0);

// 小型ポップコーンも自爆して敵にダメージを与える（killUnitで爆発）
let wsb5 = API.createWorld(W, H); API.world = wsb5;
let mini = API.makeFighters('popcorn_mini', 'p', W, H, 'army')[0];
mini.x = W / 2; mini.y = H / 2; mini.appear = 1; wsb5.units.push(mini);
let near = API.makeFighters('cookie', 'e', W, H, 'army');
near.forEach((f, i) => { f.x = W / 2 + (i - 2) * 6; f.y = H / 2 + 4; f.appear = 1; wsb5.units.push(f); });
let nHp0 = near[0].hp;
API.killUnit(wsb5, mini);
check('小型の自爆で近くの敵にダメージ', near[0].hp < nHp0, { before: nHp0, after: near[0].hp });

// pickCard('split_bomb') で state.youBombSplit が立ち、盤面ポップコーンに付与
API.resetState();
API.setMyDeck(['bomb', 'cookie', 'shoe', 'donut']);
API.startGame();
let stb = API.state; let wdb = API.world;
API.makeFighters('bomb', 'p', wdb.W, wdb.H, 'army').forEach(f => { f.appear = 1; wdb.units.push(f); });
stb.pickTotal = 5; stb.pickStep = 1;
API.pickCard('split_bomb');
check('pickCardでstate.youBombSplit=true', API.state.youBombSplit === true);
check('盤面ポップコーンに spawnMini 付与', API.world.units.filter(u => u.side === 'p' && u.key === 'bomb').every(u => u.spawnMini));

// おかわり側 vs 無強化側：おかわり側が勝ち越す（30戦）。詰まりゼロも確認。
let sbRes = { win: 0, lose: 0, draw: 0, stuck: 0 };
for (let g = 0; g < 30; g++) {
  let wd = API.createWorld(W, H); API.world = wd;
  for (let i = 0; i < 3; i++) {
    API.makeFighters('bomb', 'p', W, H, 'army').forEach(f => { f.appear = 1; wd.units.push(f); });
    API.makeFighters('bomb', 'e', W, H, 'army').forEach(f => { f.appear = 1; wd.units.push(f); });
  }
  API.applyBombSplit(wd, 'p'); // 自分だけおかわり
  API.arrangeFormation(wd, 'p', true); API.arrangeFormation(wd, 'e', true);
  wd.phase = 'battle'; wd.intro = 0; wd.done = false;
  let frames = 0;
  while (!wd.done && frames < 60 * 45) { API.stepWorld(wd, 1 / 60); frames++; }
  sbRes[wd.done ? wd.result : 'stuck']++;
}
console.log('  おかわり有利戦績:', JSON.stringify(sbRes));
check('おかわり側が詰まりゼロ', sbRes.stuck === 0, sbRes);
check('おかわり側が勝ち越す(win率>0.6)', sbRes.win / (sbRes.win + sbRes.lose || 1) > 0.6, sbRes);

// おかわりポップコーン入りデッキで戦闘が詰まらない（10戦）
let bombDeck = { win: 0, lose: 0, draw: 0, stuck: 0 };
for (let g = 0; g < 10; g++) {
  API.resetState();
  API.setMyDeck(['bomb', 'cookie', 'shoe', 'choco']);
  API.startGame();
  let st = API.state;
  let guard = 0;
  while (st.pickStep < st.pickTotal && guard++ < 50) {
    const key = st.offer3[0];
    API.pickCard(key);
  }
  API.lockAndFight();
  let wd = API.world; wd.intro = 0;
  let frames = 0;
  while (!wd.done && frames < 60 * 45) { API.stepWorld(wd, 1 / 60); frames++; }
  bombDeck[wd.done ? wd.result : 'stuck']++;
}
console.log('  ポップコーンデッキ戦績:', JSON.stringify(bombDeck));
check('おかわり入りデッキで詰まりゼロ', bombDeck.stuck === 0, bombDeck);

console.log('\n=== 19) 大福サムライ：突撃のみ前方薙ぎ払い・通常攻撃は単体＋固有強化「特大大福」 ===');
// (A) デフォルト：突撃ヒットは前方の複数の敵をまとめて斬る（通常攻撃は単体）
const dfDef = API.UNIT_BY_KEY['daifuku'];
check('daifuku は cleave フラグ持ち', dfDef.cleave === true);
let cf = API.makeFighters('daifuku', 'p', W, H, 'army')[0];
check('fighterに cleave フラグ', cf.cleave === true);
check('fighterに baseDashDamage', cf.baseDashDamage > 0);

// daifukuCleave：前方に並べた複数の敵を1回でまとめて斬る（後方の敵は斬らない）
let wcl = API.createWorld(W, H); API.world = wcl;
wcl.phase = 'battle'; wcl.intro = 0;
const cx0 = W / 2, cy0 = H / 2;
const dd = API.makeFighters('daifuku', 'p', W, H, 'army')[0];
dd.x = cx0; dd.y = cy0; dd.appear = 1; wcl.units.push(dd);
const front = []; // 前方(上方向 fy<0)に3体
[[-12, -18], [0, -22], [12, -18]].forEach(([dx, dy]) => { const f = API.makeFighters('cookie', 'e', W, H, 'army')[0]; f.x = cx0 + dx; f.y = cy0 + dy; f.appear = 1; f.hp = f.maxHp = 9999; wcl.units.push(f); front.push(f); });
const back = API.makeFighters('cookie', 'e', W, H, 'army')[0]; back.x = cx0; back.y = cy0 + 40; back.appear = 1; back.hp = back.maxHp = 9999; wcl.units.push(back); // 後方
const fh0 = front.map(f => f.hp), bh0 = back.hp;
API.daifukuCleave(wcl, dd, dd.atk, dd.range * 2.4, 0, -1); // 前方=上向き
check('前方の複数の敵をまとめて斬る(3体ヒット)', front.every((f, i) => f.hp < fh0[i]), front.map(f => f.hp));
check('後方(逆向き)の敵は斬らない', back.hp === bh0);

// 通常攻撃は単体：前方に複数の敵がいても1体だけ削れる（数フレーム）
function walkCleaveHits() {
  let wd = API.createWorld(W, H); API.world = wd;
  wd.phase = 'battle'; wd.intro = 0;
  const d = API.makeFighters('daifuku', 'p', W, H, 'army')[0];
  d.x = cx0; d.y = cy0; d.appear = 1; d.cstate = 'walk'; d.cool = 0; d.hp = d.maxHp = 9999; wd.units.push(d);
  const foes = [];
  [[-10, -16], [0, -16], [10, -16]].forEach(([dx, dy]) => { const f = API.makeFighters('cookie', 'e', W, H, 'army')[0]; f.x = cx0 + dx; f.y = cy0 + dy; f.appear = 1; f.cool = 999; f.hp = f.maxHp = 9999; wd.units.push(f); foes.push(f); });
  const h0 = foes.map(f => f.hp);
  for (let i = 0; i < 3; i++) API.stepWorld(wd, 1 / 60);
  return foes.filter((f, i) => f.hp < h0[i]).length;
}
check('通常攻撃は単体（1体だけに当たる）', walkCleaveHits() === 1);

// (B) 固有強化「特大大福」：HP＆攻撃（突撃威力も）アップ
check('buff_daifuku が SPECIALS にある', !!API.SPECIALS.buff_daifuku);
check('buff_daifuku は upgrade+daifukuBuff, target=daifuku', API.SPECIALS.buff_daifuku && API.SPECIALS.buff_daifuku.upgrade && API.SPECIALS.buff_daifuku.daifukuBuff && API.SPECIALS.buff_daifuku.target === 'daifuku');
check('isSpecial(buff_daifuku)', API.isSpecial('buff_daifuku'));

API.resetState();
let wds = API.createWorld(W, H); API.world = wds;
API.makeFighters('daifuku', 'p', W, H, 'army').forEach(f => { f.appear = 1; wds.units.push(f); });
check('大福がいれば候補に出る', API.eligibleSpecials().includes('buff_daifuku'));
API.state.youDaifukuBuff = true;
check('取得済みなら候補に出ない', !API.eligibleSpecials().includes('buff_daifuku'));
API.state.youDaifukuBuff = false;
let wds0 = API.createWorld(W, H); API.world = wds0;
API.makeFighters('cookie', 'p', W, H, 'army').forEach(f => { f.appear = 1; wds0.units.push(f); });
check('大福が居なければ候補に出ない', !API.eligibleSpecials().includes('buff_daifuku'));

let wds2 = API.createWorld(W, H); API.world = wds2;
const db = API.makeFighters('daifuku', 'p', W, H, 'army')[0]; db.appear = 1; wds2.units.push(db);
API.makeFighters('daifuku', 'e', W, H, 'army').forEach(f => { f.appear = 1; wds2.units.push(f); });
const dfHp = db.baseMaxHp, dfAtk = db.baseAtk, dfDash = db.baseDashDamage;
API.applyDaifukuBuff(wds2, 'p');
check('HPが上がる', db.maxHp > dfHp && db.hp === db.maxHp, { base: dfHp, now: db.maxHp });
check('攻撃が上がる', db.atk > dfAtk, { base: dfAtk, now: db.atk });
check('突撃の威力も上がる', db.dashDamage > dfDash, { base: dfDash, now: db.dashDamage });
check('daifukuBuff フラグが立つ', db.daifukuBuff === true);
check('敵大福には適用されない', wds2.units.filter(u => u.side === 'e' && u.key === 'daifuku').every(u => !u.daifukuBuff && u.maxHp === u.baseMaxHp));
API.applyDaifukuBuff(wds2, 'p'); // 冪等
check('2回適用しても重ねがけしない', db.maxHp === Math.round(dfHp * (1 + 0.6)));

// pickCard で state.youDaifukuBuff が立ち、盤面大福が強化
API.resetState();
API.setMyDeck(['daifuku', 'cookie', 'shoe', 'choco']);
API.startGame();
let stds = API.state; let wdds = API.world;
API.makeFighters('daifuku', 'p', wdds.W, wdds.H, 'army').forEach(f => { f.appear = 1; wdds.units.push(f); });
const dHp0 = wdds.units.find(u => u.side === 'p' && u.key === 'daifuku').baseMaxHp;
stds.pickTotal = 5; stds.pickStep = 1;
API.pickCard('buff_daifuku');
check('pickCardでstate.youDaifukuBuff=true', API.state.youDaifukuBuff === true);
check('盤面大福が強化された', API.world.units.filter(u => u.side === 'p' && u.key === 'daifuku').every(u => u.daifukuBuff === true && u.maxHp > dHp0));

// 特大大福入りデッキで戦闘が詰まらない（10戦）
let dfDeck = { win: 0, lose: 0, draw: 0, stuck: 0 };
for (let g = 0; g < 10; g++) {
  API.resetState();
  API.setMyDeck(['daifuku', 'cookie', 'shoe', 'choco']);
  API.startGame();
  let st = API.state;
  let guard = 0;
  while (st.pickStep < st.pickTotal && guard++ < 50) {
    const key = st.offer3[0];
    API.pickCard(key);
  }
  API.lockAndFight();
  let wd = API.world; wd.intro = 0;
  let frames = 0;
  while (!wd.done && frames < 60 * 50) { API.stepWorld(wd, 1 / 60); frames++; }
  dfDeck[wd.done ? wd.result : 'stuck']++;
}
console.log('  大福デッキ戦績:', JSON.stringify(dfDeck));
check('大福入りデッキで詰まりゼロ', dfDeck.stuck === 0, dfDeck);

console.log('\n=== 20) 分身（わたあめゴースト固有強化・1回限り） ===');
check('clone_ghost が SPECIALS にある', !!API.SPECIALS.clone_ghost);
check('clone_ghost は upgrade+ghostClone, target=ghost', API.SPECIALS.clone_ghost && API.SPECIALS.clone_ghost.upgrade && API.SPECIALS.clone_ghost.ghostClone && API.SPECIALS.clone_ghost.target === 'ghost');
check('isSpecial(clone_ghost)', API.isSpecial('clone_ghost'));

// 出現条件：ゴーストがいれば出る／取得済みでは出ない／居なければ出ない
API.resetState();
let wg = API.createWorld(W, H); API.world = wg;
API.makeFighters('ghost', 'p', W, H, 'army').forEach(f => { f.appear = 1; wg.units.push(f); });
check('ゴーストがいれば候補に出る', API.eligibleSpecials().includes('clone_ghost'));
API.state.youGhostClone = true;
check('取得済みなら候補に出ない', !API.eligibleSpecials().includes('clone_ghost'));
API.state.youGhostClone = false;
let wg0 = API.createWorld(W, H); API.world = wg0;
API.makeFighters('cookie', 'p', W, H, 'army').forEach(f => { f.appear = 1; wg0.units.push(f); });
check('ゴーストが居なければ候補に出ない', !API.eligibleSpecials().includes('clone_ghost'));

// applyGhostClone：味方ゴーストにだけ cloneOn
let wg2 = API.createWorld(W, H); API.world = wg2;
API.makeFighters('ghost', 'p', W, H, 'army').forEach(f => { f.appear = 1; wg2.units.push(f); });
API.makeFighters('ghost', 'e', W, H, 'army').forEach(f => { f.appear = 1; wg2.units.push(f); });
API.applyGhostClone(wg2, 'p');
check('味方ゴーストに cloneOn 付与', wg2.units.filter(u => u.side === 'p' && u.key === 'ghost').every(u => u.cloneOn));
check('敵ゴーストには付かない', wg2.units.filter(u => u.side === 'e' && u.key === 'ghost').every(u => !u.cloneOn));

// 被弾で分身が1体でる（HP1・おとり）／2回目の被弾では増えない
let wg3 = API.createWorld(W, H); API.world = wg3;
wg3.phase = 'battle'; wg3.intro = 0;
const gho = API.makeFighters('ghost', 'p', W, H, 'army')[0];
gho.x = W / 2; gho.y = H / 2; gho.appear = 1; gho.invuln = 0; gho.cloneOn = true; gho.hp = gho.maxHp = 500;
wg3.units.push(gho);
const atkr = API.makeFighters('shoe', 'e', W, H, 'army')[0]; atkr.x = W / 2; atkr.y = H / 2 + 20; atkr.appear = 1; wg3.units.push(atkr);
API.applyHit(wg3, atkr, gho, 10);
let decoys = wg3.units.filter(u => u.key === 'ghost' && u.isDecoy);
check('被弾で分身が1体でる', decoys.length === 1, decoys.length);
check('分身はHP1（1撃で消える）', decoys[0] && decoys[0].maxHp === 1 && decoys[0].hp === 1);
check('分身は味方側', decoys[0] && decoys[0].side === 'p');
check('分身はワープしない・再分身しない', decoys[0] && decoys[0].warper === false && !decoys[0].cloneOn);
API.applyHit(wg3, atkr, gho, 10);   // 2回目
check('2回目の被弾では分身は増えない', wg3.units.filter(u => u.key === 'ghost' && u.isDecoy).length === 1);

// 分身は1撃で消える
const dec = decoys[0];
API.applyHit(wg3, atkr, dec, 1);
check('分身は1ダメージで死ぬ', dec.hp <= 0);

// pickCard で state.youGhostClone が立ち、盤面ゴーストに付与
API.resetState();
API.setMyDeck(['ghost', 'cookie', 'shoe', 'choco']);
API.startGame();
let stg = API.state; let wdg = API.world;
API.makeFighters('ghost', 'p', wdg.W, wdg.H, 'army').forEach(f => { f.appear = 1; wdg.units.push(f); });
stg.pickTotal = 5; stg.pickStep = 1;
API.pickCard('clone_ghost');
check('pickCardでstate.youGhostClone=true', API.state.youGhostClone === true);
check('盤面ゴーストに cloneOn 付与', API.world.units.filter(u => u.side === 'p' && u.key === 'ghost').every(u => u.cloneOn));

// 分身入りデッキで戦闘が詰まらない（10戦）
let ghDeck = { win: 0, lose: 0, draw: 0, stuck: 0 };
for (let g = 0; g < 10; g++) {
  API.resetState();
  API.setMyDeck(['ghost', 'cookie', 'shoe', 'choco']);
  API.startGame();
  let st = API.state;
  let guard = 0;
  while (st.pickStep < st.pickTotal && guard++ < 50) {
    const key = st.offer3[0];
    API.pickCard(key);
  }
  API.lockAndFight();
  let wd = API.world; wd.intro = 0;
  let frames = 0;
  while (!wd.done && frames < 60 * 45) { API.stepWorld(wd, 1 / 60); frames++; }
  ghDeck[wd.done ? wd.result : 'stuck']++;
}
console.log('  ゴーストデッキ戦績:', JSON.stringify(ghDeck));
check('分身入りデッキで詰まりゼロ', ghDeck.stuck === 0, ghDeck);

console.log('\n=== 21) クラスター花火弾（キャンディキャノン固有強化・1回限り） ===');
check('cluster_cannon が SPECIALS にある', !!API.SPECIALS.cluster_cannon);
check('cluster_cannon は upgrade+cannonCluster, target=cannon', API.SPECIALS.cluster_cannon && API.SPECIALS.cluster_cannon.upgrade && API.SPECIALS.cluster_cannon.cannonCluster && API.SPECIALS.cluster_cannon.target === 'cannon');
check('isSpecial(cluster_cannon)', API.isSpecial('cluster_cannon'));

// 出現条件：キャノンがいれば出る／取得済みでは出ない／居なければ出ない
API.resetState();
let wc = API.createWorld(W, H); API.world = wc;
API.makeFighters('cannon', 'p', W, H, 'army').forEach(f => { f.appear = 1; wc.units.push(f); });
check('キャノンがいれば候補に出る', API.eligibleSpecials().includes('cluster_cannon'));
API.state.youCannonCluster = true;
check('取得済みなら候補に出ない', !API.eligibleSpecials().includes('cluster_cannon'));
API.state.youCannonCluster = false;
let wc0 = API.createWorld(W, H); API.world = wc0;
API.makeFighters('cookie', 'p', W, H, 'army').forEach(f => { f.appear = 1; wc0.units.push(f); });
check('キャノンが居なければ候補に出ない', !API.eligibleSpecials().includes('cluster_cannon'));

// applyCannonCluster：味方キャノンにだけ cluster
let wc2 = API.createWorld(W, H); API.world = wc2;
API.makeFighters('cannon', 'p', W, H, 'army').forEach(f => { f.appear = 1; wc2.units.push(f); });
API.makeFighters('cannon', 'e', W, H, 'army').forEach(f => { f.appear = 1; wc2.units.push(f); });
API.applyCannonCluster(wc2, 'p');
check('味方キャノンに cluster 付与', wc2.units.filter(u => u.side === 'p' && u.key === 'cannon').every(u => u.cluster));
check('敵キャノンには付かない', wc2.units.filter(u => u.side === 'e' && u.key === 'cannon').every(u => !u.cluster));

// 効果：クラスター弾は通常砲撃より広範囲・高ダメージ（密集した敵への総ダメージで比較）
function cannonVolleyDamage(cluster) {
  let wd = API.createWorld(W, H); API.world = wd;
  wd.phase = 'battle'; wd.intro = 0;
  // 円盤状に敵を密集配置（動かず・高HPで生存）→ 砲撃の総ダメージを測る
  const cx = W / 2, cy = H * 0.35, foes = [];
  for (let gx = -90; gx <= 90; gx += 22) for (let gy = -90; gy <= 90; gy += 22) {
    if (gx * gx + gy * gy > 90 * 90) continue;
    const f = API.makeFighters('cookie', 'e', W, H, 'army')[0];
    f.x = cx + gx; f.y = cy + gy; f.appear = 1; f.speed = 0; f.cool = 999; f.hp = f.maxHp = 99999;
    wd.units.push(f); foes.push(f);
  }
  const cannon = API.makeFighters('cannon', 'p', W, H, 'army')[0];
  cannon.x = cx; cannon.y = H * 0.9; cannon.appear = 1; cannon.cool = 0; cannon.hp = cannon.maxHp = 99999;
  if (cluster) cannon.cluster = true;
  wd.units.push(cannon);
  // 複数回の砲撃を撃たせて累積ダメージで比較（1発だと着弾点のブレでクラスターの差が出ないことがあるため）
  for (let i = 0; i < 600; i++) API.stepWorld(wd, 1 / 60);
  return foes.reduce((s, f) => s + (f.maxHp - f.hp), 0);
}
const baseVol = cannonVolleyDamage(false);
const clusterVol = cannonVolleyDamage(true);
check('通常砲撃でダメージが入る（基準）', baseVol > 0, baseVol);
check('クラスター弾は総ダメージが増える', clusterVol > baseVol, { base: baseVol, cluster: clusterVol });

// pickCard で state.youCannonCluster が立ち、盤面キャノンに付与
API.resetState();
API.setMyDeck(['cannon', 'cookie', 'shoe', 'choco']);
API.startGame();
let stc2 = API.state; let wdc2 = API.world;
API.makeFighters('cannon', 'p', wdc2.W, wdc2.H, 'army').forEach(f => { f.appear = 1; wdc2.units.push(f); });
stc2.pickTotal = 5; stc2.pickStep = 1;
API.pickCard('cluster_cannon');
check('pickCardでstate.youCannonCluster=true', API.state.youCannonCluster === true);
check('盤面キャノンに cluster 付与', API.world.units.filter(u => u.side === 'p' && u.key === 'cannon').every(u => u.cluster));

// クラスター花火弾入りデッキで戦闘が詰まらない（10戦）
let cnDeck = { win: 0, lose: 0, draw: 0, stuck: 0 };
for (let g = 0; g < 10; g++) {
  API.resetState();
  API.setMyDeck(['cannon', 'cookie', 'shoe', 'choco']);
  API.startGame();
  let st = API.state;
  let guard = 0;
  while (st.pickStep < st.pickTotal && guard++ < 50) {
    const key = st.offer3[0];
    API.pickCard(key);
  }
  API.lockAndFight();
  let wd = API.world; wd.intro = 0;
  let frames = 0;
  while (!wd.done && frames < 60 * 45) { API.stepWorld(wd, 1 / 60); frames++; }
  cnDeck[wd.done ? wd.result : 'stuck']++;
}
console.log('  キャノンデッキ戦績:', JSON.stringify(cnDeck));
check('クラスター入りデッキで詰まりゼロ', cnDeck.stuck === 0, cnDeck);

console.log('\n=== 22) メガ炭酸沼（ランニングソーダ固有強化・1回限り） ===');
check('fizz_soda が SPECIALS にある', !!API.SPECIALS.fizz_soda);
check('fizz_soda は upgrade+sodaFizz, target=soda', API.SPECIALS.fizz_soda && API.SPECIALS.fizz_soda.upgrade && API.SPECIALS.fizz_soda.sodaFizz && API.SPECIALS.fizz_soda.target === 'soda');
check('isSpecial(fizz_soda)', API.isSpecial('fizz_soda'));

// 出現条件：ソーダが SODA_MIN(2) 以上で出る／取得済みでは出ない／1体では出ない
API.resetState();
let wf = API.createWorld(W, H); API.world = wf;
API.makeFighters('soda', 'p', W, H, 'army').forEach(f => { f.appear = 1; wf.units.push(f); }); // 2体
check('ソーダ2体で候補に出る', API.eligibleSpecials().includes('fizz_soda'));
API.state.youSodaFizz = true;
check('取得済みなら候補に出ない', !API.eligibleSpecials().includes('fizz_soda'));
API.state.youSodaFizz = false;
let wf0 = API.createWorld(W, H); API.world = wf0;
API.makeFighters('soda', 'p', W, H, 'army').slice(0, 1).forEach(f => { f.appear = 1; wf0.units.push(f); });
check('ソーダ1体(<2)では候補に出ない', !API.eligibleSpecials().includes('fizz_soda'));

// applySodaFizz：味方ソーダの沼の半径とダメージが基準より上がる。敵には付かない
let wf2 = API.createWorld(W, H); API.world = wf2;
const sBase = API.UNIT_BY_KEY['soda'];
API.makeFighters('soda', 'p', W, H, 'army').forEach(f => { f.appear = 1; wf2.units.push(f); });
API.makeFighters('soda', 'e', W, H, 'army').forEach(f => { f.appear = 1; wf2.units.push(f); });
API.applySodaFizz(wf2, 'p');
const ps = wf2.units.find(u => u.side === 'p' && u.key === 'soda');
check('沼の半径が基準より拡大', ps.puddleR > sBase.puddleR, { base: sBase.puddleR, now: ps.puddleR });
check('沼のダメージが基準より増加', ps.puddleDps > sBase.puddleDps, { base: sBase.puddleDps, now: ps.puddleDps });
check('fizz フラグが立つ', ps.fizz === true);
check('敵ソーダには適用されない', wf2.units.filter(u => u.side === 'e' && u.key === 'soda').every(u => !u.fizz && u.puddleR === sBase.puddleR));
// 冪等性：2回適用しても基準ベース計算で同じ値
API.applySodaFizz(wf2, 'p');
const ps2 = wf2.units.find(u => u.side === 'p' && u.key === 'soda');
check('2回適用しても同じ値（冪等）', ps2.puddleR === ps.puddleR && ps2.puddleDps === ps.puddleDps);

// 実際の沼：強化ソーダが自爆すると、より大きく強い沼ができる（killUnit経由）
function sodaPuddle(fizz) {
  let wd = API.createWorld(W, H); API.world = wd;
  const s = API.makeFighters('soda', 'p', W, H, 'army')[0];
  s.x = W / 2; s.y = H / 2; s.appear = 1;
  if (fizz) { s.puddleR = Math.round(sBase.puddleR * 1.6); s.puddleDps = Math.round(sBase.puddleDps * 1.8); }
  wd.units.push(s);
  API.killUnit(wd, s);
  return wd.puddles[0];
}
const basePud = sodaPuddle(false), fizzPud = sodaPuddle(true);
check('強化で沼の半径が大きい', fizzPud.r > basePud.r, { base: basePud.r, fizz: fizzPud.r });
check('強化で沼のDPSが高い', fizzPud.dps > basePud.dps, { base: basePud.dps, fizz: fizzPud.dps });

// pickCard で state.youSodaFizz が立ち、盤面ソーダに付与
API.resetState();
API.setMyDeck(['soda', 'cookie', 'shoe', 'choco']);
API.startGame();
let stf = API.state; let wdf = API.world;
API.makeFighters('soda', 'p', wdf.W, wdf.H, 'army').forEach(f => { f.appear = 1; wdf.units.push(f); });
stf.pickTotal = 5; stf.pickStep = 1;
API.pickCard('fizz_soda');
check('pickCardでstate.youSodaFizz=true', API.state.youSodaFizz === true);
check('盤面ソーダに fizz 付与', API.world.units.filter(u => u.side === 'p' && u.key === 'soda').every(u => u.fizz));

// メガ炭酸沼入りデッキで戦闘が詰まらない（10戦）
let sdDeck = { win: 0, lose: 0, draw: 0, stuck: 0 };
for (let g = 0; g < 10; g++) {
  API.resetState();
  API.setMyDeck(['soda', 'cookie', 'shoe', 'choco']);
  API.startGame();
  let st = API.state;
  let guard = 0;
  while (st.pickStep < st.pickTotal && guard++ < 50) {
    const key = st.offer3.find(k => !API.isSpecial(k)) || st.offer3[0];
    API.pickCard(key);
  }
  API.lockAndFight();
  let wd = API.world; wd.intro = 0;
  let frames = 0;
  while (!wd.done && frames < 60 * 45) { API.stepWorld(wd, 1 / 60); frames++; }
  sdDeck[wd.done ? wd.result : 'stuck']++;
}
console.log('  ソーダデッキ戦績:', JSON.stringify(sdDeck));
check('メガ炭酸沼入りデッキで詰まりゼロ', sdDeck.stuck === 0, sdDeck);

console.log('\n=== 23) 鉄壁ドーナッツ（バキュームドーナッツ固有強化・1回限り） ===');
check('wall_donut が SPECIALS にある', !!API.SPECIALS.wall_donut);
check('wall_donut は upgrade+donutWall, target=donut', API.SPECIALS.wall_donut && API.SPECIALS.wall_donut.upgrade && API.SPECIALS.wall_donut.donutWall && API.SPECIALS.wall_donut.target === 'donut');
check('isSpecial(wall_donut)', API.isSpecial('wall_donut'));

// 出現条件：ドーナッツがいれば出る／取得済みでは出ない／居なければ出ない
API.resetState();
let wn = API.createWorld(W, H); API.world = wn;
API.makeFighters('donut', 'p', W, H, 'army').forEach(f => { f.appear = 1; wn.units.push(f); });
check('ドーナッツがいれば候補に出る', API.eligibleSpecials().includes('wall_donut'));
API.state.youDonutWall = true;
check('取得済みなら候補に出ない', !API.eligibleSpecials().includes('wall_donut'));
API.state.youDonutWall = false;
let wn0 = API.createWorld(W, H); API.world = wn0;
API.makeFighters('cookie', 'p', W, H, 'army').forEach(f => { f.appear = 1; wn0.units.push(f); });
check('ドーナッツが居なければ候補に出ない', !API.eligibleSpecials().includes('wall_donut'));

// applyDonutWall：HPと見た目・当たり判定が基準から増す。敵には付かない
let wn2 = API.createWorld(W, H); API.world = wn2;
const dn = API.makeFighters('donut', 'p', W, H, 'army')[0];
dn.appear = 1; wn2.units.push(dn);
API.makeFighters('donut', 'e', W, H, 'army').forEach(f => { f.appear = 1; wn2.units.push(f); });
const dHp = dn.baseMaxHp, dScale = dn.spriteScale, dR = dn.baseR;
API.applyDonutWall(wn2, 'p');
check('HPが大幅に上がる', dn.maxHp > dHp && dn.hp === dn.maxHp, { base: dHp, now: dn.maxHp });
check('見た目が大きくなる', dn.spriteScale > dScale, { base: dScale, now: dn.spriteScale });
check('当たり判定も増す', dn.r > dR, { base: dR, now: dn.r });
check('donutWall フラグが立つ', dn.donutWall === true);
check('敵ドーナッツには適用されない', wn2.units.filter(u => u.side === 'e' && u.key === 'donut').every(u => !u.donutWall && u.maxHp === u.baseMaxHp));
// 冪等性
API.applyDonutWall(wn2, 'p');
check('2回適用しても重ねがけしない（HP不変）', dn.maxHp === Math.round(dHp * (1 + 0.9)));

// pickCard で state.youDonutWall が立ち、盤面ドーナッツが鉄壁化
API.resetState();
API.setMyDeck(['donut', 'cookie', 'shoe', 'choco']);
API.startGame();
let stn = API.state; let wdn = API.world;
API.makeFighters('donut', 'p', wdn.W, wdn.H, 'army').forEach(f => { f.appear = 1; wdn.units.push(f); });
const dnHp0 = wdn.units.find(u => u.side === 'p' && u.key === 'donut').baseMaxHp;
stn.pickTotal = 5; stn.pickStep = 1;
API.pickCard('wall_donut');
check('pickCardでstate.youDonutWall=true', API.state.youDonutWall === true);
check('盤面ドーナッツが鉄壁化', API.world.units.filter(u => u.side === 'p' && u.key === 'donut').every(u => u.donutWall === true && u.maxHp > dnHp0));

// 鉄壁ドーナッツ vs 通常ドーナッツ：硬い側が勝ち越す（40戦）。攻撃が弱いタンクなので
// 効果量はHP/サイズの決定論テストで担保し、ここは「勝ち越す傾向」を緩めに確認する。
let dwRes = { win: 0, lose: 0, draw: 0, stuck: 0 };
for (let g = 0; g < 40; g++) {
  let wd = API.createWorld(W, H); API.world = wd;
  // 同数のクッキー＋ドーナッツ。自分のドーナッツだけ鉄壁
  for (let i = 0; i < 2; i++) {
    API.makeFighters('cookie', 'p', W, H, 'army').forEach(f => { f.appear = 1; wd.units.push(f); });
    API.makeFighters('cookie', 'e', W, H, 'army').forEach(f => { f.appear = 1; wd.units.push(f); });
  }
  API.makeFighters('donut', 'p', W, H, 'army').forEach(f => { f.appear = 1; wd.units.push(f); });
  API.makeFighters('donut', 'e', W, H, 'army').forEach(f => { f.appear = 1; wd.units.push(f); });
  API.applyDonutWall(wd, 'p'); // 自分のドーナッツだけ鉄壁
  API.arrangeFormation(wd, 'p', true); API.arrangeFormation(wd, 'e', true);
  wd.phase = 'battle'; wd.intro = 0; wd.done = false;
  let frames = 0;
  while (!wd.done && frames < 60 * 50) { API.stepWorld(wd, 1 / 60); frames++; }
  dwRes[wd.done ? wd.result : 'stuck']++;
}
console.log('  鉄壁有利戦績:', JSON.stringify(dwRes));
check('鉄壁側が詰まりゼロ', dwRes.stuck === 0, dwRes);
check('鉄壁側が勝ち越す傾向(win率>0.5)', dwRes.win / (dwRes.win + dwRes.lose || 1) > 0.5, dwRes);

console.log('\n=== 24) はや焼きパンケーキ（パンケーキキング固有強化・1回限り） ===');
check('fast_pancake が SPECIALS にある', !!API.SPECIALS.fast_pancake);
check('fast_pancake は upgrade+pancakeFast, target=pancake', API.SPECIALS.fast_pancake && API.SPECIALS.fast_pancake.upgrade && API.SPECIALS.fast_pancake.pancakeFast && API.SPECIALS.fast_pancake.target === 'pancake');
check('isSpecial(fast_pancake)', API.isSpecial('fast_pancake'));

// 出現条件：パンケーキがいれば出る／取得済みでは出ない／居なければ出ない
API.resetState();
let wp2 = API.createWorld(W, H); API.world = wp2;
API.makeFighters('pancake', 'p', W, H, 'army').forEach(f => { f.appear = 1; wp2.units.push(f); });
check('パンケーキがいれば候補に出る', API.eligibleSpecials().includes('fast_pancake'));
API.state.youPancakeFast = true;
check('取得済みなら候補に出ない', !API.eligibleSpecials().includes('fast_pancake'));
API.state.youPancakeFast = false;
let wp0 = API.createWorld(W, H); API.world = wp0;
API.makeFighters('cookie', 'p', W, H, 'army').forEach(f => { f.appear = 1; wp0.units.push(f); });
check('パンケーキが居なければ候補に出ない', !API.eligibleSpecials().includes('fast_pancake'));

// applyPancakeFast：味方パンケーキの evolveAt が25%短縮（10→7.5）。敵には付かない
let wp3 = API.createWorld(W, H); API.world = wp3;
const pkBase = API.UNIT_BY_KEY['pancake'].evolveAt;
API.makeFighters('pancake', 'p', W, H, 'army').forEach(f => { f.appear = 1; wp3.units.push(f); });
API.makeFighters('pancake', 'e', W, H, 'army').forEach(f => { f.appear = 1; wp3.units.push(f); });
API.applyPancakeFast(wp3, 'p');
const myPk = wp3.units.find(u => u.side === 'p' && u.key === 'pancake');
check('進化時間が短縮(10→7.5)', Math.abs(myPk.evolveAt - pkBase * 0.75) < 1e-6, { base: pkBase, now: myPk.evolveAt });
check('fastEvo フラグが立つ', myPk.fastEvo === true);
check('敵パンケーキは据え置き(10)', wp3.units.filter(u => u.side === 'e' && u.key === 'pancake').every(u => u.evolveAt === pkBase));

// 実際に早く進化する：t=8秒で強化版は進化済み・通常版はまだ
function evolvedByTime(fast, T) {
  let wd = API.createWorld(W, H); API.world = wd;
  wd.phase = 'battle'; wd.intro = 0; wd.t = 0;
  const pk = API.makeFighters('pancake', 'p', W, H, 'army')[0];
  pk.x = W / 2; pk.y = H - 50; pk.appear = 1; pk.hp = pk.maxHp = 99999; wd.units.push(pk);
  if (fast) pk.evolveAt = pkBase * 0.75;
  const foe = API.makeFighters('choco', 'e', W, H, 'army')[0]; foe.x = W / 2; foe.y = 50; foe.appear = 1; foe.hp = foe.maxHp = 99999; wd.units.push(foe);
  for (let i = 0; i < 60 * T && !pk.evolved; i++) API.stepWorld(wd, 1 / 60);
  return pk.evolved;
}
check('はや焼きはt=8秒までに進化済み', evolvedByTime(true, 8) === true);
check('通常はt=8秒ではまだ未進化', evolvedByTime(false, 8) === false);

// pickCard で state.youPancakeFast が立ち、盤面パンケーキに付与
API.resetState();
API.setMyDeck(['pancake', 'cookie', 'shoe', 'choco']);
API.startGame();
let stpf = API.state; let wdpf = API.world;
API.makeFighters('pancake', 'p', wdpf.W, wdpf.H, 'army').forEach(f => { f.appear = 1; wdpf.units.push(f); });
stpf.pickTotal = 5; stpf.pickStep = 1;
API.pickCard('fast_pancake');
check('pickCardでstate.youPancakeFast=true', API.state.youPancakeFast === true);
check('盤面パンケーキが短縮された', API.world.units.filter(u => u.side === 'p' && u.key === 'pancake').every(u => u.fastEvo === true && u.evolveAt < pkBase));

// はや焼きパンケーキ入りデッキで戦闘が詰まらない（10戦）
let pfDeck = { win: 0, lose: 0, draw: 0, stuck: 0 };
for (let g = 0; g < 10; g++) {
  API.resetState();
  API.setMyDeck(['pancake', 'cookie', 'shoe', 'choco']);
  API.startGame();
  let st = API.state;
  let guard = 0;
  while (st.pickStep < st.pickTotal && guard++ < 50) {
    const key = st.offer3.find(k => !API.isSpecial(k)) || st.offer3[0];
    API.pickCard(key);
  }
  API.lockAndFight();
  let wd = API.world; wd.intro = 0;
  let frames = 0;
  while (!wd.done && frames < 60 * 50) { API.stepWorld(wd, 1 / 60); frames++; }
  pfDeck[wd.done ? wd.result : 'stuck']++;
}
console.log('  パンケーキデッキ戦績:', JSON.stringify(pfDeck));
check('はや焼き入りデッキで詰まりゼロ', pfDeck.stuck === 0, pfDeck);

console.log('\n=== 25) 特盛りシュークリーム（シュークリームアーチャー固有強化・1回限り） ===');
check('buff_shoe が SPECIALS にある', !!API.SPECIALS.buff_shoe);
check('buff_shoe は upgrade+shoeBuff, target=shoe', API.SPECIALS.buff_shoe && API.SPECIALS.buff_shoe.upgrade && API.SPECIALS.buff_shoe.shoeBuff && API.SPECIALS.buff_shoe.target === 'shoe');
check('isSpecial(buff_shoe)', API.isSpecial('buff_shoe'));

// 出現条件：シューが SHOE_MIN(2) 以上で出る／取得済みでは出ない／1体では出ない
API.resetState();
let wsh = API.createWorld(W, H); API.world = wsh;
API.makeFighters('shoe', 'p', W, H, 'army').forEach(f => { f.appear = 1; wsh.units.push(f); }); // 2体
check('シュー2体で候補に出る', API.eligibleSpecials().includes('buff_shoe'));
API.state.youShoeBuff = true;
check('取得済みなら候補に出ない', !API.eligibleSpecials().includes('buff_shoe'));
API.state.youShoeBuff = false;
let wsh0 = API.createWorld(W, H); API.world = wsh0;
API.makeFighters('shoe', 'p', W, H, 'army').slice(0, 1).forEach(f => { f.appear = 1; wsh0.units.push(f); });
check('シュー1体(<2)では候補に出ない', !API.eligibleSpecials().includes('buff_shoe'));

// applyShoeBuff：HPと攻撃が基準から増す。敵には付かない
let wsh2 = API.createWorld(W, H); API.world = wsh2;
const sh = API.makeFighters('shoe', 'p', W, H, 'army')[0];
sh.appear = 1; wsh2.units.push(sh);
API.makeFighters('shoe', 'e', W, H, 'army').forEach(f => { f.appear = 1; wsh2.units.push(f); });
const shHp = sh.baseMaxHp, shAtk = sh.baseAtk;
API.applyShoeBuff(wsh2, 'p');
check('HPが上がる', sh.maxHp > shHp && sh.hp === sh.maxHp, { base: shHp, now: sh.maxHp });
check('攻撃が上がる', sh.atk > shAtk, { base: shAtk, now: sh.atk });
check('shoeBuff フラグが立つ', sh.shoeBuff === true);
check('敵シューには適用されない', wsh2.units.filter(u => u.side === 'e' && u.key === 'shoe').every(u => !u.shoeBuff && u.maxHp === u.baseMaxHp));
// 冪等性
API.applyShoeBuff(wsh2, 'p');
check('2回適用しても重ねがけしない（HP不変）', sh.maxHp === Math.round(shHp * (1 + 0.6)));

// pickCard で state.youShoeBuff が立ち、盤面シューが強化
API.resetState();
API.setMyDeck(['shoe', 'cookie', 'choco', 'donut']);
API.startGame();
let stsh = API.state; let wdsh = API.world;
API.makeFighters('shoe', 'p', wdsh.W, wdsh.H, 'army').forEach(f => { f.appear = 1; wdsh.units.push(f); });
const shHp0 = wdsh.units.find(u => u.side === 'p' && u.key === 'shoe').baseMaxHp;
stsh.pickTotal = 5; stsh.pickStep = 1;
API.pickCard('buff_shoe');
check('pickCardでstate.youShoeBuff=true', API.state.youShoeBuff === true);
check('盤面シューが強化された', API.world.units.filter(u => u.side === 'p' && u.key === 'shoe').every(u => u.shoeBuff === true && u.maxHp > shHp0));

// 特盛りシュー vs 通常シュー：強化側が勝ち越す（30戦）
let shRes = { win: 0, lose: 0, draw: 0, stuck: 0 };
for (let g = 0; g < 30; g++) {
  let wd = API.createWorld(W, H); API.world = wd;
  for (let i = 0; i < 2; i++) {
    API.makeFighters('shoe', 'p', W, H, 'army').forEach(f => { f.appear = 1; wd.units.push(f); });
    API.makeFighters('shoe', 'e', W, H, 'army').forEach(f => { f.appear = 1; wd.units.push(f); });
  }
  API.applyShoeBuff(wd, 'p'); // 自分のシューだけ特盛り
  API.arrangeFormation(wd, 'p', true); API.arrangeFormation(wd, 'e', true);
  wd.phase = 'battle'; wd.intro = 0; wd.done = false;
  let frames = 0;
  while (!wd.done && frames < 60 * 45) { API.stepWorld(wd, 1 / 60); frames++; }
  shRes[wd.done ? wd.result : 'stuck']++;
}
console.log('  特盛り有利戦績:', JSON.stringify(shRes));
check('特盛り側が詰まりゼロ', shRes.stuck === 0, shRes);
check('特盛り側が勝ち越す(win率>0.7)', shRes.win / (shRes.win + shRes.lose || 1) > 0.7, shRes);

console.log('\n=== 26) ラストベイク（ジンジャーベーカリー固有強化・1回限り） ===');
check('last_bake が SPECIALS にある', !!API.SPECIALS.last_bake);
check('last_bake は upgrade+bakeryBuff, target=bakery', API.SPECIALS.last_bake && API.SPECIALS.last_bake.upgrade && API.SPECIALS.last_bake.bakeryBuff && API.SPECIALS.last_bake.target === 'bakery');
check('isSpecial(last_bake)', API.isSpecial('last_bake'));

// 出現条件：ベーカリーがいれば出る／取得済みでは出ない／居なければ出ない
API.resetState();
let wb = API.createWorld(W, H); API.world = wb;
API.makeFighters('bakery', 'p', W, H, 'army').forEach(f => { f.appear = 1; wb.units.push(f); });
check('ベーカリーがいれば候補に出る', API.eligibleSpecials().includes('last_bake'));
API.state.youBakeryBuff = true;
check('取得済みなら候補に出ない', !API.eligibleSpecials().includes('last_bake'));
API.state.youBakeryBuff = false;
let wb0 = API.createWorld(W, H); API.world = wb0;
API.makeFighters('cookie', 'p', W, H, 'army').forEach(f => { f.appear = 1; wb0.units.push(f); });
check('ベーカリーが居なければ候補に出ない', !API.eligibleSpecials().includes('last_bake'));

// applyBakeryBuff：HPが基準から増し、deathSpawn が付く。敵には付かない
let wb2 = API.createWorld(W, H); API.world = wb2;
const bk = API.makeFighters('bakery', 'p', W, H, 'army')[0];
bk.appear = 1; wb2.units.push(bk);
API.makeFighters('bakery', 'e', W, H, 'army').forEach(f => { f.appear = 1; wb2.units.push(f); });
const bkHp = bk.baseMaxHp;
API.applyBakeryBuff(wb2, 'p');
check('HPが上がる', bk.maxHp > bkHp && bk.hp === bk.maxHp, { base: bkHp, now: bk.maxHp });
check('deathSpawn が設定される', bk.deathSpawn > 0, bk.deathSpawn);
check('bakeryBuff フラグが立つ', bk.bakeryBuff === true);
check('敵ベーカリーには適用されない', wb2.units.filter(u => u.side === 'e' && u.key === 'bakery').every(u => !u.bakeryBuff && u.maxHp === u.baseMaxHp));

// 死亡時召喚：強化ベーカリーが倒れると、ジンジャーがまとめて湧く（通常ベーカリーは湧かない）
function gingersOnDeath(buff) {
  let wd = API.createWorld(W, H); API.world = wd;
  const b = API.makeFighters('bakery', 'p', W, H, 'army')[0];
  b.x = W / 2; b.y = H * 0.85; b.appear = 1; wd.units.push(b);
  if (buff) API.applyBakeryBuff(wd, 'p');
  const before = wd.units.filter(u => u.key === 'ginger').length;
  API.killUnit(wd, b);
  return wd.units.filter(u => u.key === 'ginger').length - before;
}
check('強化ベーカリーの死亡でジンジャーが湧く', gingersOnDeath(true) === 5, gingersOnDeath(true));
check('通常ベーカリーの死亡では湧かない', gingersOnDeath(false) === 0);
// 湧いたジンジャーは味方側
let wb3 = API.createWorld(W, H); API.world = wb3;
const b3 = API.makeFighters('bakery', 'p', W, H, 'army')[0]; b3.x = W / 2; b3.y = H * 0.85; b3.appear = 1; wb3.units.push(b3);
API.applyBakeryBuff(wb3, 'p'); API.killUnit(wb3, b3);
check('湧いたジンジャーは味方側', wb3.units.filter(u => u.key === 'ginger').every(u => u.side === 'p'));

// pickCard で state.youBakeryBuff が立ち、盤面ベーカリーが強化
API.resetState();
API.setMyDeck(['bakery', 'cookie', 'choco', 'shoe']);
API.startGame();
let stb2 = API.state; let wdb2 = API.world;
API.makeFighters('bakery', 'p', wdb2.W, wdb2.H, 'army').forEach(f => { f.appear = 1; wdb2.units.push(f); });
const bkHp0 = wdb2.units.find(u => u.side === 'p' && u.key === 'bakery').baseMaxHp;
stb2.pickTotal = 5; stb2.pickStep = 1;
API.pickCard('last_bake');
check('pickCardでstate.youBakeryBuff=true', API.state.youBakeryBuff === true);
check('盤面ベーカリーが強化された', API.world.units.filter(u => u.side === 'p' && u.key === 'bakery').every(u => u.bakeryBuff === true && u.maxHp > bkHp0 && u.deathSpawn > 0));

// ラストベイク入りデッキで戦闘が詰まらない（10戦）
let bkDeck = { win: 0, lose: 0, draw: 0, stuck: 0 };
for (let g = 0; g < 10; g++) {
  API.resetState();
  API.setMyDeck(['bakery', 'cookie', 'choco', 'shoe']);
  API.startGame();
  let st = API.state;
  let guard = 0;
  while (st.pickStep < st.pickTotal && guard++ < 50) {
    const key = st.offer3.find(k => !API.isSpecial(k)) || st.offer3[0];
    API.pickCard(key);
  }
  API.lockAndFight();
  let wd = API.world; wd.intro = 0;
  let frames = 0;
  while (!wd.done && frames < 60 * 50) { API.stepWorld(wd, 1 / 60); frames++; }
  bkDeck[wd.done ? wd.result : 'stuck']++;
}
console.log('  ベーカリーデッキ戦績:', JSON.stringify(bkDeck));
check('ラストベイク入りデッキで詰まりゼロ', bkDeck.stuck === 0, bkDeck);

console.log('\n=== 27) CPUの強化はプレイヤーの取得数を超えない（自動強化バグ防止） ===');
// プレイヤーが強化を一切取らなければ、CPUは何戦やっても強化0（以前は1戦目から勝手に強化されていた）
API.resetState();
API.setMyDeck(['choco', 'cookie', 'shoe', 'bomb']);
API.startGame();
{
  const wd = API.world;
  // 敵盤面に各種強化の条件を満たすユニットを用意（choco2/bomb2/cookie5/donut1）
  ['choco', 'choco', 'bomb', 'bomb', 'cookie', 'donut'].forEach(k => API.makeFighters(k, 'e', wd.W, wd.H, 'army').forEach(f => { f.appear = 1; wd.units.push(f); }));
}
check('開始時は両者とも強化0', API.buffCountFor('p') === 0 && API.buffCountFor('e') === 0);
let foeMax = 0;
for (let r = 0; r < 8; r++) { API.lockAndFight(); foeMax = Math.max(foeMax, API.buffCountFor('e')); }
check('プレイヤー強化0なら8戦してもCPU強化0', foeMax === 0, { foeMax, p: API.buffCountFor('p') });

// プレイヤーが強化を持っていれば、CPUはそれを上限に追従できる（超えない）
API.resetState();
API.setMyDeck(['choco', 'cookie', 'shoe', 'bomb']);
API.startGame();
{
  const wd = API.world;
  ['choco', 'choco', 'bomb', 'bomb'].forEach(k => API.makeFighters(k, 'e', wd.W, wd.H, 'army').forEach(f => { f.appear = 1; wd.units.push(f); }));
}
// プレイヤーが3つ強化を持っている体にする
API.state.youChocoBuff = true; API.state.youParty = true; API.state.youBombSplit = true;
let foeAfter = 0;
for (let r = 0; r < 12; r++) { API.lockAndFight(); }
foeAfter = API.buffCountFor('e');
check('CPUはプレイヤーの強化数を超えない', foeAfter <= API.buffCountFor('p'), { foe: foeAfter, p: API.buffCountFor('p') });
check('プレイヤーが強化を持てばCPUも追従して取得できる', foeAfter >= 1, { foe: foeAfter });

// 敵味方同時：プレイヤーが強化カードを取った瞬間にCPUも1つ強化される（同数になる）
API.resetState();
API.setMyDeck(['choco', 'cookie', 'shoe', 'bomb']);
API.startGame();
{
  const wd = API.world;
  // 両陣にchocoを2体ずつ（装甲条件）。CPUが同時取得できる候補を用意
  ['choco', 'choco'].forEach(k => {
    API.makeFighters(k, 'p', wd.W, wd.H, 'army').forEach(f => { f.appear = 1; wd.units.push(f); });
    API.makeFighters(k, 'e', wd.W, wd.H, 'army').forEach(f => { f.appear = 1; wd.units.push(f); });
  });
}
API.state.pickTotal = 5; API.state.pickStep = 1;
const pPre = API.buffCountFor('p'), ePre = API.buffCountFor('e');
API.pickCard('buff_choco');   // プレイヤーが強化を取得
check('取得前は両者0', pPre === 0 && ePre === 0);
check('プレイヤー強化取得と同時にCPUも+1（同数）', API.buffCountFor('p') === 1 && API.buffCountFor('e') === 1, { p: API.buffCountFor('p'), e: API.buffCountFor('e') });

console.log('\n=== 28) 2倍カードの「同キャラ」連打クールダウン ===');
API.resetState();
let wcd = API.createWorld(W, H); API.world = wcd;
// cannon 3体・cookie 5体 → 両方x2対象
for (let i = 0; i < 3; i++) API.makeFighters('cannon', 'p', W, H, 'army').forEach(f => { f.appear = 1; wcd.units.push(f); });
API.makeFighters('cookie', 'p', W, H, 'army').forEach(f => { f.appear = 1; wcd.units.push(f); });
API.state.round = 1; API.state.x2Block = {};
check('クールダウン前は両方のX2候補に出る', API.eligibleX2Specials().includes('x2_cannon') && API.eligibleX2Specials().includes('x2_cookie'));
// cannonのX2を取得（cannonだけクールダウン、cookieは出る）
API.state.x2Block.cannon = API.state.round + 1;
check('取得した同キャラ(cannon)のX2は出ない', !API.eligibleX2Specials().includes('x2_cannon'));
check('別キャラ(cookie)のX2は引き続き出る', API.eligibleX2Specials().includes('x2_cookie'));
API.state.round = 2;
check('次の1ラウンドも同キャラ(cannon)は出ない', !API.eligibleX2Specials().includes('x2_cannon'));
API.state.round = 3;
check('クールダウン明けで同キャラ(cannon)が再び出る', API.eligibleX2Specials().includes('x2_cannon'));

// pickCard(x2)でそのキャラのクールダウンが設定される
API.resetState();
API.setMyDeck(['cannon', 'cookie', 'shoe', 'choco']);
API.startGame();
{
  const wd = API.world;
  for (let i = 0; i < 3; i++) API.makeFighters('cannon', 'p', wd.W, wd.H, 'army').forEach(f => { f.appear = 1; wd.units.push(f); });
  API.makeFighters('cookie', 'p', wd.W, wd.H, 'army').forEach(f => { f.appear = 1; wd.units.push(f); });
}
API.state.round = 1; API.state.pickTotal = 5; API.state.pickStep = 1;
API.pickCard('x2_cannon');
check('X2取得でそのキャラのx2Blockが設定される', (API.state.x2Block.cannon || 0) >= API.state.round + 1, API.state.x2Block);
check('取得後そのキャラのX2は出ない（連打不可）', !API.eligibleX2Specials().includes('x2_cannon'));
check('別キャラのX2はまだ出る（キャラは増やせる）', API.eligibleX2Specials().includes('x2_cookie'));

console.log('\n=== 29) 強化後に同じキャラを追加しても全員強化される（混在防止） ===');
API.resetState();
API.setMyDeck(['choco', 'cookie', 'shoe', 'bomb']);
API.startGame();
{
  const wd = API.world;
  API.makeFighters('choco', 'p', wd.W, wd.H, 'army').forEach(f => { f.appear = 1; wd.units.push(f); }); // choco 2体
}
API.state.pickTotal = 8; API.state.pickStep = 1;
API.pickCard('buff_choco');
check('装甲取得で既存chocoが全員強化', API.world.units.filter(u => u.key === 'choco' && u.side === 'p').every(u => u.chocoBuff));
const nBefore = API.world.units.filter(u => u.key === 'choco' && u.side === 'p').length;
API.pickCard('choco');   // 同じキャラを追加ピック（通常ユニット）
const chocos = API.world.units.filter(u => u.key === 'choco' && u.side === 'p');
check('chocoが増えている（追加ピック成功）', chocos.length > nBefore, { before: nBefore, after: chocos.length });
check('追加した同種chocoも全員その場で強化される（未強化が混じらない）', chocos.every(u => u.chocoBuff === true && u.maxHp > u.baseMaxHp), chocos.map(u => !!u.chocoBuff));

console.log('\n=== 30) カードの短い説明文（short）===');
{
  const roster = API.UNITS.filter(u => !u.summonOnly);
  check('全ロスターに short がある', roster.every(u => typeof u.short === 'string' && u.short.length > 0), roster.filter(u => !u.short).map(u => u.key));
  check('short は十分に簡潔（30文字以内）', roster.every(u => u.short.length <= 30), roster.filter(u => u.short.length > 30).map(u => [u.key, u.short.length]));
  const bomb = API.UNIT_BY_KEY['bomb'];
  check('ポップコーンTNTの short が想定どおり', bomb.short === '敵に近づいて自爆するクレイジーなポップコーン', bomb.short);
}

console.log('\n=== 31) ラウンド自動進行（ボタン不要）＆最終ライフで決着 ===');
// 非決着の勝敗 → ボタンを押さずに自動で次ラウンドへ（beginDraft）
API.resetState();
API.setMyDeck(['choco', 'cookie', 'shoe', 'bomb']);
API.startGame();
{
  const r0 = API.state.round, fl0 = API.state.foeLives;
  API.endBattle('win');   // setTimeout は即時実行スタブ → 自動で nextRound
  check('勝利でライバルのライフが減る', API.state.foeLives === fl0 - 1, { before: fl0, after: API.state.foeLives });
  check('まだ決着でなければ自動で次ラウンドへ進む', API.state.round === r0 + 1, { r0, now: API.state.round });
}
// 最終ライフを削り切ったら自動進行せず決着画面へ
API.resetState();
API.setMyDeck(['choco', 'cookie', 'shoe', 'bomb']);
API.startGame();
{
  API.state.foeLives = 1;
  const r0 = API.state.round;
  API.endBattle('win');   // foeLives 0 → endGame（次ラウンドへは進まない）
  check('最終ライフを削り切ったらライフ0', API.state.foeLives === 0);
  check('決着時は自動で次ラウンドへ進まない', API.state.round === r0, { r0, now: API.state.round });
}

console.log('\n=== 32) ドラフト完了で自動開戦（開戦ボタン不要）===');
API.resetState();
API.setMyDeck(['choco', 'cookie', 'shoe', 'bomb']);
API.startGame();
{
  check('ドラフト中はまだ戦闘前（phase=muster）', API.world.phase === 'muster');
  let guard = 0;
  while (API.state.pickStep < API.state.pickTotal && guard++ < 50) {
    const k = (API.state.offer3 && API.state.offer3[0]) || 'cookie';
    API.pickCard(k);   // lockAndFight は呼ばない（自動で始まるはず）
  }
  check('全ピック完了で自動的に開戦している（phase=battle）', API.world.phase === 'battle');
  // 多重呼び出しに対する保護（既に戦闘中なら no-op）
  const armyLen = API.world.units.filter(u => u.side === 'p').length;
  API.lockAndFight();
  check('開戦後にlockAndFightを呼んでも二重展開しない', API.world.units.filter(u => u.side === 'p').length === armyLen);
}

console.log('\n=== 33) 攻撃モーション（攻撃したのが分かる）===');
{
  let wa = API.createWorld(W, H); API.world = wa; wa.phase = 'battle'; wa.intro = 0;
  const A = API.makeFighters('cookie', 'p', W, H, 'army')[0]; A.x = W / 2; A.y = H / 2; A.appear = 1; A.cool = 0; wa.units.push(A);
  const B = API.makeFighters('cookie', 'e', W, H, 'army')[0]; B.x = W / 2; B.y = H / 2 - 10; B.appear = 1; B.cool = 999; B.hp = B.maxHp = 9999; wa.units.push(B);
  API.stepWorld(wa, 1 / 60);
  check('攻撃するとatkAnimが立つ', A.atkAnim > 0, A.atkAnim);
  check('攻撃方向(atkDx/atkDy)が記録される', typeof A.atkDx === 'number' && (A.atkDx !== 0 || A.atkDy !== 0));
}

console.log('\n=== 34) やられた立ち絵を横倒し→消す演出 ===');
{
  let wd2 = API.createWorld(W, H); API.world = wd2; wd2.phase = 'battle'; wd2.intro = 0;
  const ally = API.makeFighters('cookie', 'p', W, H, 'army')[0]; ally.x = W * 0.3; ally.y = H * 0.7; ally.appear = 1; ally.cool = 999; ally.hp = ally.maxHp = 9999; wd2.units.push(ally);
  const foe = API.makeFighters('cookie', 'e', W, H, 'army')[0]; foe.x = W * 0.7; foe.y = H * 0.3; foe.appear = 1; foe.cool = 999; foe.hp = foe.maxHp = 9999; wd2.units.push(foe);
  const victim = API.makeFighters('cookie', 'e', W, H, 'army')[0]; victim.x = W / 2; victim.y = H / 2; victim.appear = 1; wd2.units.push(victim);
  API.killUnit(wd2, victim);
  check('やられると dying フラグが立つ', victim.dying === true);
  check('やられた直後はまだ盤面に残る（演出中）', wd2.units.includes(victim));
  let g = 0;
  while (wd2.units.includes(victim) && g++ < 120 && wd2.phase === 'battle') API.stepWorld(wd2, 1 / 60);
  check('演出（約' + 0.5 + '秒）が終わると盤面から消える', !wd2.units.includes(victim), { frames: g, phase: wd2.phase });
}

console.log('\n=== 35) シュークリームの矢：山なりに飛ぶ ===');
{
  let ws = API.createWorld(W, H); API.world = ws; ws.phase = 'battle'; ws.intro = 0;
  const sh = API.makeFighters('shoe', 'p', W, H, 'army')[0]; sh.x = W / 2; sh.y = H * 0.7; sh.appear = 1; sh.cool = 0; ws.units.push(sh);
  const tg = API.makeFighters('cookie', 'e', W, H, 'army')[0]; tg.x = W / 2; tg.y = H * 0.7 - 60; tg.appear = 1; tg.cool = 999; tg.hp = tg.maxHp = 9999; ws.units.push(tg);
  API.stepWorld(ws, 1 / 60);
  const arrow = ws.shots.find(s => s.sprite === 'arrow');
  check('シューが矢(sprite=arrow)を放つ', !!arrow);
  check('矢は山なり（arcH>0・total>0）', !!arrow && arrow.arcH > 0 && arrow.total > 0, arrow && { arcH: arrow.arcH, total: arrow.total });
  check('矢に発射地点(sx,sy)が記録される', !!arrow && typeof arrow.sx === 'number' && typeof arrow.sy === 'number');
  check('矢はちゃんと敵に当たる（着弾でダメージ）', (() => {
    let g = 0; const h0 = tg.hp; while (g++ < 200 && tg.hp === h0 && ws.shots.length) API.stepWorld(ws, 1 / 60); return tg.hp < h0;
  })());
}

console.log('\n=== 36) 強化の画面揺れがドラフト中(muster)に残り続けない ===');
{
  let wm = API.createWorld(W, H); API.world = wm; wm.phase = 'muster';
  wm.shake = 6;                                  // 強化（例：ビター装甲）で揺れがセットされた状態
  check('揺れがセットされている', wm.shake > 0);
  for (let i = 0; i < 60; i++) API.stepWorld(wm, 1 / 60);   // muster のまま1秒ぶんステップ
  check('muster中でも揺れが減衰してゼロになる', wm.shake === 0, wm.shake);
}

console.log('\n=== 37) ユニット同士が重ならない（位置ベースの分離）===');
{
  // 重なった味方同士はほどけて rr 以上離れる
  let wo = API.createWorld(W, H); API.world = wo;
  const a = API.makeFighters('cookie', 'p', W, H, 'army')[0]; a.x = 100; a.y = 100; a.appear = 1; wo.units.push(a);
  const b = API.makeFighters('cookie', 'p', W, H, 'army')[0]; b.x = 101; b.y = 100; b.appear = 1; wo.units.push(b);
  const before = Math.hypot(a.x - b.x, a.y - b.y);
  for (let k = 0; k < 4; k++) API.resolveOverlaps(wo);
  const after = Math.hypot(a.x - b.x, a.y - b.y), need = a.r + b.r;
  check('重なりが解消され rr 以上離れる', after >= need - 0.5, { before, after, need });
  check('分離後の距離は分離前より広い', after > before);

  // 不動ユニット（キャノン=speed0）は押されず、相手側がよける
  let wa = API.createWorld(W, H); API.world = wa;
  const can = API.makeFighters('cannon', 'p', W, H, 'army')[0]; can.x = 200; can.y = 200; can.appear = 1; wa.units.push(can);
  const ck = API.makeFighters('cookie', 'e', W, H, 'army')[0]; ck.x = 201; ck.y = 200; ck.appear = 1; wa.units.push(ck);
  const cx0 = can.x, cy0 = can.y;
  for (let k = 0; k < 4; k++) API.resolveOverlaps(wa);
  check('不動ユニット(キャノン)は動かない', can.x === cx0 && can.y === cy0);
  check('相手側がよけて重ならない', Math.hypot(can.x - ck.x, can.y - ck.y) >= (can.r + ck.r) - 0.5);

  // 戦闘中に多数を密集させても、最終的にどのペアも重ならない
  let wb = API.createWorld(W, H); API.world = wb; wb.phase = 'battle'; wb.intro = 0;
  for (let i = 0; i < 10; i++) { const f = API.makeFighters('cookie', 'p', W, H, 'army')[0]; f.x = W / 2 + (i % 3); f.y = H / 2 + (i % 2); f.appear = 1; f.cool = 999; wb.units.push(f); }
  const far = API.makeFighters('cookie', 'e', W, H, 'army')[0]; far.x = W * 0.92; far.y = H * 0.08; far.appear = 1; far.cool = 999; far.speed = 0; far.hp = far.maxHp = 9999; wb.units.push(far);
  for (let i = 0; i < 30 && wb.phase === 'battle'; i++) API.stepWorld(wb, 1 / 60);
  let worstOverlap = 0;
  const us = wb.units.filter(u => u.hp > 0 && u.side === 'p');
  for (let i = 0; i < us.length; i++) for (let j = i + 1; j < us.length; j++) {
    const d = Math.hypot(us[i].x - us[j].x, us[i].y - us[j].y), rr = us[i].r + us[j].r;
    if (rr - d > worstOverlap) worstOverlap = rr - d;
  }
  check('密集しても重なり(めり込み)がほぼゼロ', worstOverlap < 1.5, { worstOverlap });
}

console.log(`\n==== RESULT: ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
