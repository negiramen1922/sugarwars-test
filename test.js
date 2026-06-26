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
  setMyDeck:(d)=>{ myDeck = d; }, getMyDeck:()=>myDeck,
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
for (let g = 0; g < 40; g++) {
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

console.log(`\n==== RESULT: ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
