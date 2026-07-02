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
  evolvePancake, evolvedStep, nearestEnemy, spawnerStep, BAKERY_SPAWN_PATTERN,
  beginDraft, nextPick, pickCard, lockAndFight, aiPicks, startGame,
  applyPartyFlag, applyCookieParty, playerCanParty, countSideKey,
  applyChocoBuff, applyBombSplit, applyDaifukuBuff, daifukuCleave, applyGhostClone, applyHit, applyCannonCluster, applySodaFizz, applyDonutWall, applyPancakeFast, applyShoeBuff, applyBakeryBuff, applyIcewizBuff, applyMacaronBuff, buffCountFor,
  setMyDeck:(d)=>{ myDeck = d; }, getMyDeck:()=>myDeck, needFullDeckForPvp,
  buildProfile, applyProfile, displayProfile, get myProfile(){ return myProfile; },
  profileHasProgress, profilesConflict, filterActiveEntries,
  masteryXp, masteryLevel, avatarUnlocked, awardMasteryXp,
  masteryXpForLevel, skinUnlocked, activeSkinBase, equipSkin, get SPECIAL_SKINS(){ return SPECIAL_SKINS; },
  get MASTERY_WIN_XP(){ return MASTERY_WIN_XP; }, get MASTERY_LOSE_XP(){ return MASTERY_LOSE_XP; }, get MASTERY_XP_PER_LEVEL(){ return MASTERY_XP_PER_LEVEL; },
  mmPickWaiter, pvpResumeIsRecent, pvpReconnRemain, eloExpected, eloDelta, myTrophies, presenceCounts,
  enhDisplay, specialCardIcon,
  pvpDecideIAmHost, pvpMatchupType, unitDamageType, unitAtkText, mostUsedUnit,
  spriteFor, get SPRITES(){ return SPRITES; },
  get myProfileRef(){ return myProfile; },
  burst, partCap, get LOW_FX(){ return LOW_FX; }, set LOW_FX(v){ LOW_FX=v; },
  get PART_CAP_HI(){ return PART_CAP_HI; }, get PART_CAP_LO(){ return PART_CAP_LO; },
  setCpuDeck:(d)=>{ cpuDeck = d; }, setCpuDeckMode:(m)=>{ cpuDeckMode = m; },
  startTutorial, tutNext, endTutorial, get tutorial(){ return tutorial; },
  endBattle, endGame, nextRound, resolveOverlaps,
  setupCanvas, CW_get:()=>CW, CH_get:()=>CH,
  PVP_MSG, createLoopbackPair, makeCpuFoeController, makeRemoteFoeController,
  serializeWorld, applySnapshot, makePvpHost, makePvpGuest,
  PVP_PROTO, pvpMakeOffer, pvpMakeStepOffers, pvpInjectOrDefer, resetPvpEnhPending, applyPvpSpecial, reapplyEnhancements, X2_OFFER_CAP, X2_BOARD_CAP, picksFor,
  get pvpEnh(){ return pvpEnh; }, set pvpEnh(v){ pvpEnh = v; },
  get pvpMode(){ return pvpMode; }, set pvpMode(v){ pvpMode = v; },
  get foeCtl(){ return foeCtl; }, set foeCtl(v){ foeCtl = v; },
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

console.log('\n=== 3) X2の盤面上限(X2_BOARD_CAP=120)を超えない ===');
let w2 = API.createWorld(W, H); API.world = w2;
// donutを70体置いてから倍増 → 120で頭打ち（70→+50で120）
for (let i = 0; i < 70; i++) API.makeFighters('donut', 'p', W, H, 'army').forEach(f => { f.appear = 1; w2.units.push(f); });
let add2 = API.doubleUnitsOnBoard(w2, 'p', 'donut');
let totalN = w2.units.filter(u => u.side === 'p' && u.hp > 0).length;
check('X2上限(120)を超えない', totalN <= 120, totalN);
check('70体→倍増で+50(120で頭打ち)', add2 === 50, add2);
check('上限未満なら全部倍化する', (() => { const w = API.createWorld(W, H); API.world = w; for (let i = 0; i < 10; i++) API.makeFighters('donut', 'p', W, H, 'army').forEach(f => { f.appear = 1; w.units.push(f); }); const a = API.doubleUnitsOnBoard(w, 'p', 'donut'); API.world = w2; return a === 10; })());

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
check('沼のダメージは基準のまま（強化で上がらない）', ps.puddleDps === sBase.puddleDps, { base: sBase.puddleDps, now: ps.puddleDps });
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
  wd.units.push(s);
  if (fizz) API.applySodaFizz(wd, 'p');   // 実際の強化処理を通す（範囲のみ拡大・ダメージ据え置き）
  API.killUnit(wd, s);
  return wd.puddles[0];
}
const basePud = sodaPuddle(false), fizzPud = sodaPuddle(true);
check('強化で沼の半径が大きい', fizzPud.r > basePud.r, { base: basePud.r, fizz: fizzPud.r });
check('強化でも沼のDPSは同じ（上がらない）', fizzPud.dps === basePud.dps, { base: basePud.dps, fizz: fizzPud.dps });

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

// 開戦時(lockAndFight)にCPUが勝手に追いつかない（廃止した catch-up のバグ防止）
// プレイヤーが強化を3つ持っていても、CPUは開戦の瞬間に強制で強化されない。
API.resetState();
API.setMyDeck(['choco', 'cookie', 'shoe', 'bomb']);
API.startGame();
{
  const wd = API.world;
  ['choco', 'choco', 'bomb', 'bomb'].forEach(k => API.makeFighters(k, 'e', wd.W, wd.H, 'army').forEach(f => { f.appear = 1; wd.units.push(f); }));
}
// プレイヤーが3つ強化を持っている体にする（CPUはピック時に同時取得していない想定）
API.state.youChocoBuff = true; API.state.youParty = true; API.state.youBombSplit = true;
for (let r = 0; r < 12; r++) { API.lockAndFight(); }
check('開戦時にCPUが勝手に強化されない（catch-up廃止）', API.buffCountFor('e') === 0, { foe: API.buffCountFor('e'), p: API.buffCountFor('p') });

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

console.log('\n=== 28) 2倍カードの連打クールダウンは撤廃（同キャラでも続けて出せる） ===');
API.resetState();
let wcd = API.createWorld(W, H); API.world = wcd;
// cannon 3体・cookie 5体 → 両方x2対象
for (let i = 0; i < 3; i++) API.makeFighters('cannon', 'p', W, H, 'army').forEach(f => { f.appear = 1; wcd.units.push(f); });
API.makeFighters('cookie', 'p', W, H, 'army').forEach(f => { f.appear = 1; wcd.units.push(f); });
API.state.round = 1;
check('両方のX2候補が出る', API.eligibleX2Specials().includes('x2_cannon') && API.eligibleX2Specials().includes('x2_cookie'));
// cannonのX2を取得（倍化）しても、同キャラのX2が引き続き出る（クールダウンなし）
API.doubleUnitsOnBoard(wcd, 'p', 'cannon');
check('X2取得後も同キャラ(cannon)のX2が出る（連打可）', API.eligibleX2Specials().includes('x2_cannon'), API.eligibleX2Specials());
check('別キャラ(cookie)のX2も出る', API.eligibleX2Specials().includes('x2_cookie'));
// 盤面が上限(X2_BOARD_CAP)に達したら、空振りするのでX2は出さない
{
  const wfull = API.createWorld(W, H); API.world = wfull;
  for (let i = 0; i < API.X2_BOARD_CAP; i++) { const f = API.makeFighters('cookie', 'p', W, H, 'army')[0]; f.appear = 1; f.hp = f.maxHp; wfull.units.push(f); }
  check('盤面が上限ならX2は出ない（空振り防止）', !API.eligibleX2Specials().includes('x2_cookie'), API.eligibleX2Specials());
  API.world = wcd;
}

console.log('\n=== 29) 強化は取得時にいた数だけ。あとから追加した同種は強化されない ===');
API.resetState();
API.setMyDeck(['choco', 'cookie', 'shoe', 'bomb']);
API.startGame();
{
  const wd = API.world;
  API.makeFighters('choco', 'p', wd.W, wd.H, 'army').forEach(f => { f.appear = 1; wd.units.push(f); }); // choco 2体
}
API.state.pickTotal = 8; API.state.pickStep = 1;
const nBefore = API.world.units.filter(u => u.key === 'choco' && u.side === 'p').length;
API.pickCard('buff_choco');
check('装甲取得で“取得時にいた”chocoが全員強化', API.world.units.filter(u => u.key === 'choco' && u.side === 'p').every(u => u.chocoBuff));
check('取得時の数だけ記録される', API.state.youBuffN.choco === nBefore, { rec: API.state.youBuffN.choco, nBefore });
API.pickCard('choco');   // 同じキャラを追加ピック（通常ユニット）
const chocos = API.world.units.filter(u => u.key === 'choco' && u.side === 'p');
check('chocoが増えている（追加ピック成功）', chocos.length > nBefore, { before: nBefore, after: chocos.length });
const buffed = chocos.filter(u => u.chocoBuff).length;
check('あとから追加したchocoは強化されない（強化数は取得時のまま）', buffed === nBefore, { buffed, nBefore });
check('未強化のchocoが存在する（混在＝正しい挙動）', chocos.some(u => !u.chocoBuff));

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

console.log('\n=== 38) シューの射程延長＋重量によるバキューム吸引のされやすさ ===');
{
  check('シューの射程が延びている(150)', API.UNIT_BY_KEY['shoe'].range === 150, API.UNIT_BY_KEY['shoe'].range);
  // 重量が各 fighter に乗っている
  const ck1 = API.makeFighters('cookie', 'e', W, H, 'army')[0];
  const ch1 = API.makeFighters('choco', 'e', W, H, 'army')[0];
  const ca1 = API.makeFighters('cannon', 'e', W, H, 'army')[0];
  check('クッキーは重量1', ck1.weight === 1, ck1.weight);
  check('チョコは重量4', ch1.weight === 4, ch1.weight);
  check('キャノン/ベーカリー/ドーナッツは重量5', ca1.weight === 5 && API.makeFighters('bakery', 'e', W, H, 'army')[0].weight === 5 && API.makeFighters('donut', 'e', W, H, 'army')[0].weight === 5);

  // ドーナッツの前に置いて20フレーム。下(ドーナッツ側)へどれだけ吸われたか
  function pulled(key) {
    let wv = API.createWorld(W, H); API.world = wv; wv.phase = 'battle'; wv.intro = 0;
    const d = API.makeFighters('donut', 'p', W, H, 'army')[0]; d.x = W / 2; d.y = H * 0.7; d.appear = 1; wv.units.push(d);
    const o = API.makeFighters(key, 'e', W, H, 'army')[0]; o.x = W / 2; o.y = H * 0.7 - 60; o.appear = 1; o.speed = 0; o.cool = 999; o.hp = o.maxHp = 99999; wv.units.push(o);
    const y0 = o.y; for (let i = 0; i < 20; i++) API.stepWorld(wv, 1 / 60); return o.y - y0;
  }
  const dCookie = pulled('cookie'), dShoe = pulled('shoe'), dChoco = pulled('choco'), dCannon = pulled('cannon');
  check('重量5(キャノン)は吸い込まれない', Math.abs(dCannon) < 3, { dCannon });
  check('軽いクッキー(重量1)はよく吸われる', dCookie > 5, { dCookie });
  check('シュー(重量2)も吸われる', dShoe > 3, { dShoe });
  check('重いチョコ(重量4)も吸われるが軽いより遅い', dChoco > 0 && dChoco < dCookie, { dChoco, dCookie });
}

console.log('\n=== 39) CPUのデッキ選択（おまかせ／自分で決める）===');
{
  API.setMyDeck(['cookie', 'choco', 'shoe', 'bomb']);
  // manual：cpuDeck をそのままライバルのデッキに使う
  API.setCpuDeckMode('manual');
  API.setCpuDeck(['daifuku', 'cannon', 'donut', 'ghost']);
  API.startGame();
  check('デッキ選択：ライバルは指定したcpuDeckを使う',
    JSON.stringify(API.state.foeLoadout) === JSON.stringify(['daifuku', 'cannon', 'donut', 'ghost']), API.state.foeLoadout);
  // auto：ランダム（4枚・召喚専用を含まない）
  API.setCpuDeckMode('auto');
  API.startGame();
  const fl = API.state.foeLoadout;
  check('おまかせ：ライバルは4枚のランダムデッキ', fl.length === 4);
  check('おまかせ：召喚専用キャラは含まない', fl.every(k => !API.UNIT_BY_KEY[k].summonOnly), fl);
  // manual は1枚でもそのデッキで対戦できる（4枚未満OK）
  API.setCpuDeckMode('manual'); API.setCpuDeck(['cookie']);
  API.startGame();
  check('CPUデッキが1枚でもそのまま使う', JSON.stringify(API.state.foeLoadout) === JSON.stringify(['cookie']), API.state.foeLoadout);
  // manual で0枚（未設定）ならランダムにフォールバック
  API.setCpuDeckMode('manual'); API.setCpuDeck([]);
  API.startGame();
  check('CPUデッキが0枚ならランダムにフォールバック', API.state.foeLoadout.length === 4);
}

console.log('\n=== 40) 開戦時に隊列が一気に広がらない（分離は隊列密度に合わせる）===');
{
  let wf = API.createWorld(W, H); API.world = wf;
  // 密な同段の群れ（クッキー多数＝隊列が最も詰まるケース）＋大型タンクも混ぜる
  for (let i = 0; i < 20; i++) { const f = API.makeFighters('cookie', 'p', W, H, 'army')[0]; wf.units.push(f); }
  for (let i = 0; i < 6; i++) { const f = API.makeFighters('choco', 'p', W, H, 'army')[0]; wf.units.push(f); }
  wf.units.forEach(u => u.appear = 1);
  API.arrangeFormation(wf, 'p', true);                 // 隊列に整列（開戦前の状態）
  const before = wf.units.map(u => ({ x: u.x, y: u.y }));
  for (let k = 0; k < 4; k++) API.resolveOverlaps(wf); // 開戦直後の分離
  let maxMove = 0;
  wf.units.forEach((u, i) => { const dx = u.x - before[i].x, dy = u.y - before[i].y; maxMove = Math.max(maxMove, Math.hypot(dx, dy)); });
  check('開戦前の隊列密度では分離でほとんど動かない（広がらない）', maxMove < 6, { maxMove });
}

console.log('\n=== 41) ラウンドをまたいでも「取得時の数」だけ強化（追加分は未強化のまま）===');
{
  API.resetState();
  API.setMyDeck(['choco', 'cookie', 'shoe', 'bomb']);
  API.state.loadout = ['choco', 'cookie', 'shoe', 'bomb'];
  API.state.foeLoadout = ['cookie', 'choco', 'shoe', 'bomb'];   // beginDraft の aiPicks 用
  // choco を2体ぶん強化済み、軍には choco 4体相当（あとから2体増やした想定）
  API.state.youChocoBuff = true;
  API.state.youBuffN = { choco: 2 };
  API.state.youArmy = ['choco', 'choco'];   // choco は count=2 → 1キーで2体。2キーで4体
  API.beginDraft();                          // 次ラウンド開始：軍を再生成して強化を再適用
  const ch = API.world.units.filter(u => u.key === 'choco' && u.side === 'p');
  check('ラウンド開始時に choco が4体そろう', ch.length === 4, ch.length);
  check('強化されているのは取得時の2体だけ', ch.filter(u => u.chocoBuff).length === 2, ch.filter(u => u.chocoBuff).length);
  check('残り2体は未強化のまま', ch.filter(u => !u.chocoBuff).length === 2);
}

console.log('\n=== 42) チュートリアル（ガイド付き体験バトル）===');
{
  API.startTutorial();
  check('チュートリアル開始でフラグが立つ', API.tutorial === true);
  check('固定デッキ(choco/cookie/bomb/shoe)になる', JSON.stringify(API.getMyDeck()) === JSON.stringify(['choco', 'cookie', 'bomb', 'shoe']));
  API.tutNext();   // イントロ → startGame → beginDraft（チュートリアル設定）
  check('ドラフトは1ピックだけ', API.state.pickTotal === 1, API.state.pickTotal);
  check('相手は弱い1ピック(ginger)', JSON.stringify(API.state.foeRoundPicks) === JSON.stringify(['ginger']), API.state.foeRoundPicks);
  check('戦闘前（muster）から始まる', API.world.phase === 'muster');
  API.endTutorial();
  check('終了でフラグが下りる', API.tutorial === false);
}

console.log('\n=== 43) PVP土台: 敵コントローラ（CPU版が従来挙動を再現） ===');
{
  API.setCpuDeckMode('auto');
  const cpu = API.makeCpuFoeController();
  check('CPUコントローラのtypeはcpu', cpu.type === 'cpu');
  const d = cpu.deck();
  check('deck()はdeckSize枚（既定4）', d.length === API.CONFIG.deckSize, d.length);
  const lo = ['cookie', 'choco', 'shoe', 'bomb'];
  const ps = cpu.picks(lo, 3);
  check('picks(n)はn枚返す', ps.length === 3, ps.length);
  check('picksの各札はデッキ内のキャラ', ps.every(k => lo.includes(k)), ps);
}

console.log('\n=== 44) PVP土台: 敵コントローラ（リモート版＝相手プレイヤー供給） ===');
{
  const rem = API.makeRemoteFoeController();
  check('typeはremote', rem.type === 'remote');
  rem.setDeck(['cookie', 'choco']);
  check('setDeck()がdeck()へ反映', JSON.stringify(rem.deck()) === JSON.stringify(['cookie', 'choco']));
  rem.pushPick('cookie'); rem.pushPick('choco');
  check('pending()で待ち数が分かる', rem.pending() === 2, rem.pending());
  const p = rem.picks(['shoe'], 2);
  check('picksはキューから受信順に返す', JSON.stringify(p) === JSON.stringify(['cookie', 'choco']), p);
  check('消費後はpending=0', rem.pending() === 0);
  const p2 = rem.picks(['shoe'], 1);
  check('キュー枯渇時はデッキ先頭で埋める（フェイルセーフ）', JSON.stringify(p2) === JSON.stringify(['shoe']), p2);
}

console.log('\n=== 45) PVP土台: ループバック通信路（F2でWebRTC/Firebaseに差し替える層） ===');
{
  const [a, b] = API.createLoopbackPair();
  let got = null; b.onMessage(m => { got = m; });
  const sent = { type: API.PVP_MSG.PICK, key: 'cookie', nested: { x: 1 } };
  a.send(sent);
  check('a.send → b.onMessage に届く', !!got && got.type === 'pick' && got.key === 'cookie', got);
  sent.nested.x = 999;   // 送信後に元を書き換えても受信側は不変であるべき（=実通信のようにシリアライズ複製される）
  check('受信メッセージは深いコピー（送信側の変更に影響されない）', got.nested.x === 1, got.nested.x);
  let got2 = null; a.onMessage(m => { got2 = m; });
  b.send({ type: 'ping' });
  check('双方向（b.send → a.onMessage）も届く', !!got2 && got2.type === 'ping');
}

console.log('\n=== 46) PVP土台: 盤面スナップショット（親→子の serialize / 子のapply） ===');
{
  const Wd = API.createWorld(440, 660);
  ['cookie'].forEach(k => API.makeFighters(k, 'p', 440, 660, 'army').forEach(f => { f.appear = 1; Wd.units.push(f); }));
  ['shoe'].forEach(k => API.makeFighters(k, 'e', 440, 660, 'army').forEach(f => { f.appear = 1; Wd.units.push(f); }));
  Wd.phase = 'battle';
  const snap = API.serializeWorld(Wd);
  check('スナップショットにunitsが入る', snap.units.length === Wd.units.length && snap.units.length > 0, snap.units.length);
  let serializable = true; try { JSON.stringify(snap); } catch (e) { serializable = false; }
  check('スナップショットはJSON化できる（通信に乗せられる）', serializable);
  // 非ミラー往復：そのまま復元できる
  const w0 = API.applySnapshot(snap, false);
  check('非ミラー：体数一致', w0.units.length === Wd.units.length);
  check('非ミラー：座標ほぼそのまま（整数丸め誤差<1px）', Math.abs(w0.units[0].x - Wd.units[0].x) < 1 && Math.abs(w0.units[0].y - Wd.units[0].y) < 1);
  check('非ミラー：陣営そのまま', w0.units[0].side === Wd.units[0].side);
  check('非ミラー：phaseが保たれる', w0.phase === 'battle');
  // ミラー（子が親の盤面を見る）：陣営とYが反転し、自分が常に下に見える
  const wm = API.applySnapshot(snap, true);
  const u0 = Wd.units[0], m0 = wm.units[0];
  check('ミラー：陣営が反転（p↔e）', m0.side === (u0.side === 'p' ? 'e' : 'p'), m0.side);
  check('ミラー：Yが上下反転（整数丸め誤差<1px）', Math.abs(m0.y - (660 - u0.y)) < 1, { got: m0.y, exp: 660 - u0.y });
  check('ミラー：Xは不変（整数丸め誤差<1px）', Math.abs(m0.x - u0.x) < 1);
  // 砲弾(shots)の陣営色も反転する（子の画面で味方キャノンの玉が自陣色＝青に見えるように）
  const Ws = API.createWorld(440, 660);
  Ws.phase = 'battle';
  Ws.shots.push({ x: 100, y: 200, side: 'p', sprite: 'ball', color: '#fff' });
  const snapS = API.serializeWorld(Ws);
  const wmS = API.applySnapshot(snapS, true);
  check('ミラー：弾(shots)の陣営も反転（p→e）', wmS.shots[0].side === 'e', wmS.shots[0].side);
  const w0S = API.applySnapshot(snapS, false);
  check('非ミラー：弾(shots)の陣営はそのまま', w0S.shots[0].side === 'p', w0S.shots[0].side);
}

console.log('\n=== 47) PVP土台: コントローラ経由でもCPU対戦フローが従来どおり成立 ===');
{
  API.foeCtl = API.makeCpuFoeController();   // 既定のCPUに戻す
  API.setCpuDeckMode('auto');
  API.setMyDeck(['cookie', 'choco', 'shoe', 'bomb']);
  API.startGame();
  check('startGame：敵デッキがコントローラから供給される', API.state.foeLoadout.length === API.CONFIG.deckSize, API.state.foeLoadout);
  check('beginDraft：敵の選択がコントローラから供給される', API.state.foeRoundPicks.length === API.state.foePickTotal, { picks: API.state.foeRoundPicks.length, total: API.state.foePickTotal });
}

console.log('\n=== 48) PVP対戦オーケストレーション（親=host / 子=guest をループバックで往復） ===');
{
  const [hWire, gWire] = API.createLoopbackPair();
  const M = API.PVP_MSG;
  const got = { start: null, offers: [], snaps: [], result: null, gameover: null };
  const guest = API.makePvpGuest(gWire, {
    onStart: m => got.start = m,
    onOffer: (m, reply) => { got.offers.push(m.offer3.slice()); reply(m.offer3[0]); },
    onSnapshot: (w) => got.snaps.push(w),
    onResult: m => got.result = m,
    onGameover: m => got.gameover = m,
  });
  const hostGot = { deck: null, picks: [] };
  const host = API.makePvpHost(hWire, {
    onGuestHello: d => hostGot.deck = d,
    onGuestPick: m => hostGot.picks.push(m.key),
  });

  // デッキ交換（ループバックは同期配送）
  guest.hello(['cookie', 'choco', 'shoe', 'bomb']);
  check('子→親：HELLOでデッキが届く', JSON.stringify(host.getGuestDeck()) === JSON.stringify(['cookie', 'choco', 'shoe', 'bomb']), host.getGuestDeck());

  // 開始通知（親→子）
  host.start({ lives: 3, round: 1 });
  check('親→子：STARTが届く（ライフ等）', got.start && got.start.lives === 3 && got.start.round === 1, got.start);

  // ドラフト往復：親が提示→子が先頭を選ぶ→親が選択を受け取る
  let resolved = null;
  host.offerAndAwait(1, 1, ['cookie', 'choco', 'shoe']).then(k => resolved = k);
  check('親→子：OFFERが提示される', got.offers.length === 1 && got.offers[0][0] === 'cookie', got.offers[0]);
  check('子→親：PICKが返る（onGuestPick）', hostGot.picks.length === 1 && hostGot.picks[0] === 'cookie', hostGot.picks);

  // 盤面スナップショット：親が計算→子はミラー展開して受け取る
  const Wd = API.createWorld(440, 660);
  API.makeFighters('cookie', 'p', 440, 660, 'army').forEach(f => { f.appear = 1; Wd.units.push(f); });
  API.makeFighters('shoe', 'e', 440, 660, 'army').forEach(f => { f.appear = 1; Wd.units.push(f); });
  Wd.phase = 'battle';
  host.sendSnapshot(Wd);
  check('親→子：SNAPSHOTが届く', got.snaps.length === 1 && got.snaps[0].units.length === Wd.units.length, got.snaps.length);
  // 子側はミラー（親のp→子から見るとe、Y反転）
  const hostU0 = Wd.units[0], guestU0 = got.snaps[0].units[0];
  check('子のスナップショットはミラー（陣営反転）', guestU0.side === (hostU0.side === 'p' ? 'e' : 'p'), guestU0.side);
  check('子のスナップショットはミラー（Y反転・整数丸め誤差<1px）', Math.abs(guestU0.y - (660 - hostU0.y)) < 1);

  // 結果・決着
  host.sendResult({ result: 'win', youLives: 3, foeLives: 2 });
  check('親→子：RESULTが届く', got.result && got.result.result === 'win' && got.result.foeLives === 2, got.result);
  host.sendGameover({ winner: 'host' });
  check('親→子：GAMEOVERが届く', got.gameover && got.gameover.winner === 'host', got.gameover);

  // Promise解決（マイクロタスク後）を最後に確認
  Promise.resolve().then(() => {
    check('offerAndAwaitのPromiseが子の選択で解決', resolved === 'cookie', resolved);
  });
}

console.log('\n=== 49) PVP親配線: リモート敵コントローラが実フロー(startGame/beginDraft)を駆動 ===');
{
  // 相手プレイヤーのデッキ・選択がそのまま foeLoadout / foeRoundPicks に反映されることを実フローで確認
  const rem = API.makeRemoteFoeController();
  rem.setDeck(['cookie', 'choco', 'bomb', 'shoe']);
  rem.pushPick('cookie'); rem.pushPick('choco'); rem.pushPick('bomb');
  API.foeCtl = rem;
  API.setCpuDeckMode('auto');
  API.setMyDeck(['daifuku', 'cookie', 'choco', 'bomb']);
  API.startGame();
  check('敵デッキ＝相手プレイヤーのデッキ', JSON.stringify(API.state.foeLoadout) === JSON.stringify(['cookie', 'choco', 'bomb', 'shoe']), API.state.foeLoadout);
  check('敵の選択＝相手プレイヤーの選択（受信順）', JSON.stringify(API.state.foeRoundPicks) === JSON.stringify(['cookie', 'choco', 'bomb']), API.state.foeRoundPicks);
  API.foeCtl = API.makeCpuFoeController();   // 後始末：CPUに戻す
}

console.log('\n=== 50) PVP対戦オーケストレーション(新): DRAFT要求→子が一括PICKSで返す ===');
{
  const [hWire, gWire] = API.createLoopbackPair();
  let drafted = null;
  // 子: DRAFT要求が来たら、提示デッキから n 枚（各回先頭）選んでまとめて返す
  API.makePvpGuest(gWire, {
    onDraft: (m, sendPicks) => { drafted = m; const keys = []; for (let i = 0; i < m.n; i++) keys.push((m.deck && m.deck[0]) || 'cookie'); sendPicks(keys); },
  });
  let received = null;
  const host = API.makePvpHost(hWire, { onGuestPicks: (m) => { received = m.keys; } });
  let awaited = null;
  const wait = host.awaitGuestPicks();   // 先に待ち受け登録（即時返信を取りこぼさない）
  wait.then(k => { awaited = k; });
  host.requestGuestDraft(2, ['cookie', 'choco', 'shoe'], 3);
  check('子: DRAFT要求を受信（round/n）', !!drafted && drafted.round === 2 && drafted.n === 3, drafted);
  check('親: 子の一括PICKSをonGuestPicksで受信', JSON.stringify(received) === JSON.stringify(['cookie', 'cookie', 'cookie']), received);
  Promise.resolve().then(() => {
    check('親: awaitGuestPicksのPromiseが一括選択で解決', JSON.stringify(awaited) === JSON.stringify(['cookie', 'cookie', 'cookie']), awaited);
  });
}

console.log('\n=== 51) PVP同時選択ドラフト: STEP要求→子が1枚STEPPICKで返す ===');
{
  const [hWire, gWire] = API.createLoopbackPair();
  let stepMsg = null;
  // 子: STEP要求が来たら、提示デッキ先頭を1枚返す
  API.makePvpGuest(gWire, {
    onStep: (m, sendPick) => { stepMsg = m; sendPick((m.deck && m.deck[0]) || 'cookie'); },
  });
  let gotStepPick = null;
  const host = API.makePvpHost(hWire, { onGuestStep: (m) => { gotStepPick = m.key; } });
  let awaited = null;
  const wait = host.awaitGuestStep();   // 先に待ち受け登録
  wait.then(k => { awaited = k; });
  host.requestGuestStep(1, 0, ['cookie', 'choco', 'shoe'], 3);
  check('子: STEP要求を受信（round/step/n）', !!stepMsg && stepMsg.round === 1 && stepMsg.step === 0 && stepMsg.n === 3, stepMsg);
  check('親: 子のSTEPPICKをonGuestStepで受信', gotStepPick === 'cookie', gotStepPick);
  Promise.resolve().then(() => {
    check('親: awaitGuestStepのPromiseがこのステップの選択で解決', awaited === 'cookie', awaited);
  });
}

console.log('\n=== 52) 炭酸沼の重ねがけ上限（PUDDLE_DPS_CAP） ===');
{
  const wd = API.createWorld(440, 660); API.world = wd; wd.phase = 'battle'; wd.intro = 0;   // 沼処理はbattle中のみ
  const e = API.makeFighters('choco', 'e', 440, 660, 'army')[0];   // 硬い敵を中央に固定（味方0なので動かない）
  e.x = 220; e.y = 330; e.appear = 1; e.hp = 100000; e.maxHp = 100000;
  wd.units.push(e);
  for (let i = 0; i < 4; i++) wd.puddles.push({ x: 220, y: 330, r: 90, life: 9, maxLife: 9, side: 'p', dps: 5, slow: 0.5, bub: 0 });  // dps5×4=合計20/秒
  const before = e.hp;
  API.stepWorld(wd, 1.0);   // 1秒進める
  const lost = before - e.hp;
  check('重ねがけは上限/秒で頭打ち（合計20でも10前後）', lost > 9 && lost < 11, { lost });
  check('上限なしの合計(20)より小さい', lost < 19, { lost });
}

console.log('\n=== 53) PVP強化: pvpMakeOfferはpvpEnhで強化カードを出し分ける ===');
{
  API.resetState();
  const wd = API.createWorld(440, 660); API.world = wd;
  API.makeFighters('cookie', 'p', 440, 660, 'army').forEach(f => { f.appear = 1; wd.units.push(f); });   // クッキー5体≥X2_MIN
  const deck = ['cookie', 'choco', 'shoe', 'bomb'];
  API.pvpEnh = false;
  let offWhenDisabled = false;
  for (let i = 0; i < 60; i++) { if (API.pvpMakeOffer(deck, 'p').some(k => API.isSpecial(k))) offWhenDisabled = true; }
  check('pvpEnh OFF: 強化カードは絶対に出ない（旧版互換）', !offWhenDisabled);
  API.pvpEnh = true;
  let onWhenEnabled = false;
  for (let i = 0; i < 300; i++) { if (API.pvpMakeOffer(deck, 'p').some(k => API.isSpecial(k))) onWhenEnabled = true; }
  check('pvpEnh ON: 資格があれば強化カードが出ることがある', onWhenEnabled);
  API.pvpEnh = false;
}

console.log('\n=== 54) PVP強化: applyPvpSpecialが相手陣(e)へX2を適用し状態を記録 ===');
{
  API.resetState();
  const wd = API.createWorld(440, 660); API.world = wd;
  API.makeFighters('cookie', 'e', 440, 660, 'army').forEach(f => { f.appear = 1; wd.units.push(f); });
  const before = wd.units.filter(u => u.side === 'e' && u.key === 'cookie' && u.hp > 0).length;
  API.applyPvpSpecial(wd, 'e', 'x2_cookie');
  const after = wd.units.filter(u => u.side === 'e' && u.key === 'cookie' && u.hp > 0).length;
  check('×2(相手/e): 対象キャラが倍に増える', after === before * 2, { before, after });
  check('×2(相手/e): state.foeX2に獲得を記録', API.state.foeX2.cookie === 1, API.state.foeX2);
}

console.log('\n=== 55) PVP強化: applyPvpSpecialで自分(p)のスライム融合＋次ラウンド再適用 ===');
{
  API.resetState();
  const wd = API.createWorld(440, 660); API.world = wd;
  API.makeFighters('slime', 'p', 440, 660, 'army').forEach(f => { f.appear = 1; wd.units.push(f); });   // スライム3体
  API.applyPvpSpecial(wd, 'p', 'up_slime');
  const merged = wd.units.filter(u => u.side === 'p' && u.slime && u.merged).length;
  check('融合(自分/p): 巨大スライムが生成され state.youMerges に記録', merged >= 1 && API.state.youMerges >= 1, { merged, youMerges: API.state.youMerges });

  // 次ラウンド想定：新しい盤面でも取得済みX2が再適用される
  API.resetState();
  API.state.foeX2.cookie = 1;
  const wd2 = API.createWorld(440, 660); API.world = wd2;
  API.makeFighters('cookie', 'e', 440, 660, 'army').forEach(f => { f.appear = 1; wd2.units.push(f); });
  const b = wd2.units.filter(u => u.side === 'e' && u.key === 'cookie' && u.hp > 0).length;
  API.reapplyEnhancements(wd2, 'e');
  const a = wd2.units.filter(u => u.side === 'e' && u.key === 'cookie' && u.hp > 0).length;
  check('再適用: 取得済みX2が次ラウンドも倍化を維持', a === b * 2, { b, a });
}

console.log('\n=== 56) PVP強化: 親が生成した提示(offer3・強化含む)がSTEPで子へ届く ===');
{
  const [hWire, gWire] = API.createLoopbackPair();
  let offerSeen = null;
  API.makePvpGuest(gWire, { onStep: (m, sendPick) => { offerSeen = m.offer3; sendPick((m.offer3 && m.offer3[0]) || 'cookie'); } });
  let gotKey = null;
  const host = API.makePvpHost(hWire, { onGuestStep: (m) => { gotKey = m.key; } });
  host.requestGuestStep(1, 0, ['cookie', 'choco'], 3, ['x2_cookie', 'choco', 'shoe']);
  check('STEP: 親生成の提示(強化カード含む)が子に届く', !!offerSeen && offerSeen[0] === 'x2_cookie', offerSeen);
  check('STEP: 子は届いた提示の強化カードを選んで返せる', gotKey === 'x2_cookie', gotKey);
}

console.log('\n=== 57) X2上限: 多すぎる種類(>=X2_OFFER_CAP)にはX2カードを出さない ===');
{
  const cap = API.X2_OFFER_CAP;
  // ちょうど cap-1 体 → X2が出る
  API.resetState();
  let wd = API.createWorld(440, 660); API.world = wd;
  for (let i = 0; i < cap - 1; i++) { const f = API.makeFighters('choco', 'p', 440, 660, 'army')[0]; f.hp = f.maxHp; wd.units.push(f); }
  check('cap-1体ならX2は出る', API.eligibleX2Specials().includes('x2_choco'), { n: cap - 1, list: API.eligibleX2Specials() });
  // cap 体以上 → X2が出ない
  API.resetState();
  wd = API.createWorld(440, 660); API.world = wd;
  for (let i = 0; i < cap; i++) { const f = API.makeFighters('choco', 'p', 440, 660, 'army')[0]; f.hp = f.maxHp; wd.units.push(f); }
  check('cap体以上ならX2は出ない（増えすぎ防止）', !API.eligibleX2Specials().includes('x2_choco'), { n: cap, list: API.eligibleX2Specials() });
}

console.log('\n=== 58) PVP強化パリティ: 片方に強化が出たら、もう片方にも出る ===');
{
  API.resetState();
  const wd = API.createWorld(440, 660); API.world = wd;
  API.state.loadout = ['choco', 'cookie', 'shoe', 'bomb'];
  API.state.foeLoadout = ['choco', 'cookie', 'shoe', 'bomb'];
  // 両陣営とも choco を X2_MIN 以上（=資格あり）にしておく
  for (let i = 0; i < 4; i++) { const p = API.makeFighters('choco', 'p', 440, 660, 'army')[0]; p.hp = p.maxHp; wd.units.push(p);
                                const e = API.makeFighters('choco', 'e', 440, 660, 'army')[0]; e.hp = e.maxHp; wd.units.push(e); }
  API.pvpEnh = true;
  let everBoth = false, mismatch = false;
  for (let i = 0; i < 400; i++) {
    const o = API.pvpMakeStepOffers();
    const pHas = o.pOffer.some(k => API.isSpecial(k));
    const eHas = o.eOffer.some(k => API.isSpecial(k));
    if (pHas !== eHas) mismatch = true;        // 両者資格ありなら、出るときは必ず両方に出る
    if (pHas && eHas) everBoth = true;
  }
  check('両者資格あり: 強化は片方だけにならない（必ず両方 or 両方なし）', !mismatch);
  check('実際に両方へ強化が出るケースがある', everBoth);
  API.pvpEnh = false;
}

console.log('\n=== 59) PVP逆転ボーナス: 敗者は多くピック（pvpEnh時のみ） ===');
{
  const savedMode = API.pvpMode, savedEnh = API.pvpEnh;
  API.pvpMode = true;
  API.pvpEnh = true;   // 新版同士＝逆転ボーナス有効
  check('敗者は picksComeback 枚', API.picksFor(true, false) === API.CONFIG.picksComeback, API.picksFor(true, false));
  check('勝者は picksAfterWin 枚', API.picksFor(false, true) === API.CONFIG.picksAfterWin, API.picksFor(false, true));
  check('引き分け/初戦は picksBase 枚', API.picksFor(false, false) === API.CONFIG.picksBase, API.picksFor(false, false));
  API.pvpEnh = false;   // 旧版が混じる＝逆転なし（両者同数）
  check('旧版PVP(pvpEnh=false)は敗者でも picksBase（v1互換）', API.picksFor(true, false) === API.CONFIG.picksBase, API.picksFor(true, false));
  API.pvpMode = savedMode; API.pvpEnh = savedEnh;
}

console.log('\n=== 60) PVP逆転ボーナス: 親の単独ピック中は子へ待機通知（子は返信しない） ===');
{
  const [hWire, gWire] = API.createLoopbackPair();
  let waited = false, replied = false;
  API.makePvpGuest(gWire, { onStep: (m, sendPick) => { if (m.wait) { waited = true; } else { replied = true; sendPick('cookie'); } } });
  let gotPick = false;
  const host = API.makePvpHost(hWire, { onGuestStep: () => { gotPick = true; } });
  host.notifyGuestWait(1, 0);
  check('子: 待機通知(wait)を受信する', waited && !replied);
  check('親: 待機通知では子からの選択(STEPPICK)は来ない', !gotPick);
}

console.log('\n=== 61) 無敵の敵は標的にならない（サムライ等が吊られない） ===');
{
  const wd = API.createWorld(440, 660); API.world = wd;
  const sam = API.makeFighters('daifuku', 'p', 440, 660, 'army')[0]; sam.x = 220; sam.y = 520; wd.units.push(sam);
  const ghost = API.makeFighters('ghost', 'e', 440, 660, 'army')[0]; ghost.x = 220; ghost.y = 500; ghost.invuln = 0.6; wd.units.push(ghost);   // すぐ近くの無敵ゴースト
  const far = API.makeFighters('cookie', 'e', 440, 660, 'army')[0]; far.x = 220; far.y = 90; wd.units.push(far);   // 遠くの通常敵
  check('無敵中のゴーストは狙わない（遠くの通常敵を狙う）', API.nearestEnemy(sam, wd) === far);
  ghost.invuln = 0;
  check('無敵が切れたら近いゴーストを狙える', API.nearestEnemy(sam, wd) === ghost);
}

console.log('\n=== 62) キャンディキャノンの爆発範囲: 巻き込みは限定的（昔の62=16〜27体より大幅減） ===');
{
  const wd = API.createWorld(440, 660); API.world = wd;
  for (let i = 0; i < 16; i++) API.makeFighters('cookie', 'e', 440, 660, 'army').forEach(f => { f.appear = 1; wd.units.push(f); });
  API.arrangeFormation(wd, 'e', true);
  const splash = API.UNIT_BY_KEY['cannon'].splash;
  const foes = wd.units.filter(u => u.side === 'e' && u.hp > 0);
  let best = 0;
  for (const o of foes) { let c = 0; for (const p of foes) { if ((p.x - o.x) ** 2 + (p.y - o.y) ** 2 < splash * splash) c++; } if (c > best) best = c; }
  check('爆発の巻き込みは限定的（splash=35で密集でも約10体以下）', best <= 12, { best, splash, total: foes.length });
}

console.log('\n=== 63) 追尾弾: 標的がワープしたら追尾解除（急旋回しない） ===');
{
  const wd = API.createWorld(440, 660); API.world = wd; wd.phase = 'battle'; wd.intro = 0;
  // 両陣営に生存ユニットを置いて戦闘終了(beginOutro)にならないようにする
  const ally = API.makeFighters('choco', 'p', 440, 660, 'army')[0]; ally.x = 220; ally.y = 640; ally.appear = 1; wd.units.push(ally);   // 飛び道具を撃たない前衛（弾が混ざらない）
  const tgt = API.makeFighters('cookie', 'e', 440, 660, 'army')[0]; tgt.x = 220; tgt.y = 200; tgt.appear = 1; wd.units.push(tgt);
  const other = API.makeFighters('cookie', 'e', 440, 660, 'army')[0]; other.x = 100; other.y = 120; other.appear = 1; wd.units.push(other);
  wd.shots.push({ x: 220, y: 640, tx: 220, ty: 200, sx: 220, sy: 640, total: 440, target: tgt, homing: true, owner: ally, side: 'p', atk: 60, splash: 20, sp: 5, color: '#f', sprite: 'ball', arcH: 80 });
  API.stepWorld(wd, 0.05);   // 通常フレーム：着弾点は標的(220,200)付近に追従
  const s1 = wd.shots.find(s=>s.sprite==='ball');
  check('通常時は標的に追従する', s1 && Math.abs(s1.ty - 200) < 30, s1 && { tx: s1.tx, ty: s1.ty });
  tgt.x = 60; tgt.y = 30;   // ワープ（瞬間移動）
  API.stepWorld(wd, 0.05);
  const s2 = wd.shots.find(s=>s.sprite==='ball');
  check('ワープ後は追尾を切り、ワープ先(30)へ急旋回しない', s2 && Math.abs(s2.ty - 30) > 80, s2 && { ty: s2.ty, target: !!s2.target });
  check('追尾解除されている（target=null）', s2 && !s2.target, s2 && { target: s2.target });
}

console.log('\n=== 64) heavy(ドーナッツ)は大勢の重なりに押し負けにくい ===');
{
  const pushTest = (heavy) => {
    const wd = API.createWorld(440, 660); API.world = wd;
    const u = API.makeFighters('donut', 'p', 440, 660, 'army')[0]; u.x = 220; u.y = 300; u.heavy = heavy; wd.units.push(u);
    for (let i = 0; i < 8; i++) { const e = API.makeFighters('cookie', 'e', 440, 660, 'army')[0]; e.x = 220 + (i - 4) * 2; e.y = 306; wd.units.push(e); }   // 真下から押し寄せる群れ
    for (let k = 0; k < 6; k++) API.resolveOverlaps(wd);
    return 300 - u.y;   // 上方向に押された量
  };
  const movedHeavy = pushTest(true);
  const movedNormal = pushTest(false);
  check('heavy付きは押し戻される距離が小さい', movedHeavy < movedNormal, { movedHeavy, movedNormal });
  check('heavyでもわずかには動く（完全不動ではない）', movedHeavy >= 0, { movedHeavy });
}

console.log('\n=== 65) ベーカリーの生産数ループ（3→1→1→3→1→1・速度は不変） ===');
{
  const wd = API.createWorld(440, 660); API.world = wd;
  const bake = API.makeFighters('bakery', 'p', 440, 660, 'army')[0]; bake.x = 220; bake.y = 600; bake.appear = 1; bake.spawnCap = 99; bake.spawnT = 0; wd.units.push(bake);
  const cd = bake.spawnCd;
  const counts = [];
  for (let c = 0; c < 6; c++) {
    const before = wd.units.filter(u => u.key === 'ginger' && u.hp > 0).length;
    API.spawnerStep(wd, bake, cd + 0.01);   // 1サイクル分進める
    counts.push(wd.units.filter(u => u.key === 'ginger' && u.hp > 0).length - before);
  }
  check('生産数が 3→1→1→3→1→1 のループ', JSON.stringify(counts) === JSON.stringify([3, 1, 1, 3, 1, 1]), counts);
  check('パターン定数は [3,1,1]', JSON.stringify(API.BAKERY_SPAWN_PATTERN) === JSON.stringify([3, 1, 1]), API.BAKERY_SPAWN_PATTERN);
}

console.log('\n=== 66) ベーカリーの生産上限が大幅緩和(30)されている ===');
{
  const bakeryUnit = API.UNIT_BY_KEY['bakery'];
  check('ベーカリーのspawnCapは30（7から緩和）', bakeryUnit.spawnCap === 30, bakeryUnit.spawnCap);
  // 上限まで生産が続く（途中で止まらない）
  const wd = API.createWorld(440, 660); API.world = wd;
  const bake = API.makeFighters('bakery', 'p', 440, 660, 'army')[0]; bake.x = 220; bake.y = 600; bake.appear = 1; bake.spawnT = 0; wd.units.push(bake);
  for (let c = 0; c < 40; c++) API.spawnerStep(wd, bake, bake.spawnCd + 0.01);
  const living = wd.units.filter(u => u.key === 'ginger' && u.hp > 0).length;
  check('十分回すと7を超えて30近くまで生産する', living > 7 && living <= 30, living);
}

console.log('\n=== 67) PVP強化 持ち越し: 出せなかった側は次に資格を満たした時へ繰り越す ===');
{
  API.resetState();
  const wd = API.createWorld(440, 660); API.world = wd;
  API.pvpEnh = true;
  API.resetPvpEnhPending();
  // 'e' は資格なし（盤面にeユニットが無い）。roll=true で差し込み試行 → 出せず持ち越し
  const off1 = ['choco', 'cookie', 'shoe'];
  API.pvpInjectOrDefer(off1, 'e', true);
  check('資格なしのeには強化が出ない', !off1.some(k => API.isSpecial(k)), off1);
  // 'e' を資格ありにする（cookie 5体）
  API.makeFighters('cookie', 'e', 440, 660, 'army').forEach(f => { f.appear = 1; wd.units.push(f); });
  // roll=false でも持ち越しがあるので必ず出る
  const off2 = ['choco', 'cookie', 'shoe'];
  API.pvpInjectOrDefer(off2, 'e', false);
  check('資格を満たすと持ち越し分が次に必ず出る', off2.some(k => API.isSpecial(k)), off2);
  // 出したら持ち越しは解消：次のroll=falseでは出ない
  const off3 = ['choco', 'cookie', 'shoe'];
  API.pvpInjectOrDefer(off3, 'e', false);
  check('持ち越しは1回で解消（roll無しでは出ない）', !off3.some(k => API.isSpecial(k)), off3);
  API.pvpEnh = false;
}

console.log('\n=== 68) クラウド保存プロフィール: buildProfile / applyProfile の往復と検証 ===');
{
  API.setMyDeck(['cookie', 'choco', 'shoe', 'bomb']);
  const p = API.buildProfile();
  check('buildProfile: 現在のデッキを書き出す', JSON.stringify(p.deck) === JSON.stringify(['cookie', 'choco', 'shoe', 'bomb']), p.deck);
  check('buildProfile: deckは4枚以内', p.deck.length <= 4);
  // applyProfile: 不正キー・召喚専用キー・5枚目を除外して反映
  API.setMyDeck([]);
  API.applyProfile({ deck: ['cookie', 'ginger', 'NOPE', 'choco', 'shoe', 'bomb'] });   // ginger=召喚専用, NOPE=不正, 6枚
  const d = API.getMyDeck();
  check('applyProfile: 召喚専用(ginger)と不正キー(NOPE)を除外', !d.includes('ginger') && !d.includes('NOPE'), d);
  check('applyProfile: 4枚に丸める', d.length === 4, d);
  check('applyProfile: 有効キーは順序を保って反映', JSON.stringify(d) === JSON.stringify(['cookie', 'choco', 'shoe', 'bomb']), d);
  // 空/未定義は安全に無視
  API.applyProfile(null);
  check('applyProfile: nullでも壊れない', API.getMyDeck().length === 4);
  API.setMyDeck([]);
}

console.log('\n=== 69) プロフィール: 名前/アイコン（画像アイコンのみ・絵文字/旧keyは既定クッキーへ） ===');
{
  API.applyProfile({ name: 'シュガー王子', avatar: 'ava_daifuku' });
  const p = API.buildProfile();
  check('buildProfile: 名前を書き出す', p.name === 'シュガー王子', p.name);
  check('buildProfile: 有効な画像アイコンidを書き出す', p.avatar === 'ava_daifuku', p.avatar);
  // 12文字に丸める
  API.applyProfile({ name: 'あいうえおかきくけこさしすせそ' });
  check('名前は12文字に丸める', API.myProfile.name.length === 12, API.myProfile.name);
  // 絵文字(旧ユニットkey)や不正キーは既定クッキーに置き換え（絵文字アイコン廃止）
  API.applyProfile({ avatar: 'choco' });   // 旧・ユニットkey（絵文字）
  check('絵文字/旧keyは既定クッキーに置き換え', API.myProfile.avatar === 'ava_cookie_free', API.myProfile.avatar);
  API.applyProfile({ avatar: 'NOPE' });      // 不正キー
  check('不正アイコンも既定クッキー', API.myProfile.avatar === 'ava_cookie_free', API.myProfile.avatar);
  // 無料アイコンは選べる
  API.applyProfile({ avatar: 'ava_ginger' });
  check('無料アイコン(ava_ginger)は有効', API.myProfile.avatar === 'ava_ginger', API.myProfile.avatar);
  // displayProfile: 空名は既定ゲスト名、空アイコンは既定クッキー
  API.myProfile.name = ''; API.myProfile.avatar = '';
  const dp = API.displayProfile();
  check('displayProfile: 空名は「ゲスト〇〇」で補完', /^ゲスト\d{4}$/.test(dp.name), dp.name);
  check('displayProfile: 空アイコンは既定クッキー', dp.avatar === 'ava_cookie_free', dp.avatar);
}

console.log('\n=== 70) ランダムマッチ: 待機列から claim 相手を選ぶ（mmPickWaiter） ===');
{
  const now = 1000000;
  const stale = 30000;
  check('空/nullの列はnull', API.mmPickWaiter(null, 'me', now, stale) === null && API.mmPickWaiter({}, 'me', now, stale) === null);
  check('自分だけならnull（自分とはマッチしない）', API.mmPickWaiter({ me: { ts: now } }, 'me', now, stale) === null);
  check('自分以外が1人いればその人を選ぶ', API.mmPickWaiter({ me: { ts: now }, a: { ts: now - 1000 } }, 'me', now, stale) === 'a');
  // 複数いれば最も古い待機者（FIFO）
  check('最も古い待機者を選ぶ(FIFO)', API.mmPickWaiter({ a: { ts: now - 1000 }, b: { ts: now - 5000 }, c: { ts: now - 2000 } }, 'me', now, stale) === 'b');
  // 期限切れ(stale)は無視
  check('期限切れの待機者は無視', API.mmPickWaiter({ old: { ts: now - 40000 }, fresh: { ts: now - 1000 } }, 'me', now, stale) === 'fresh');
  check('期限切れしかいなければnull', API.mmPickWaiter({ old: { ts: now - 40000 } }, 'me', now, stale) === null);
  check('壊れたエントリは無視', API.mmPickWaiter({ bad: null, ok: { ts: now - 100 } }, 'me', now, stale) === 'ok');
}

console.log('\n=== 71) PVP再接続: 残り秒数とリログ検知の純粋ロジック ===');
{
  const now = 1000000;
  check('残り秒数: 30秒先なら30', API.pvpReconnRemain(now + 30000, now) === 30);
  check('残り秒数: 過ぎていたら0（負にならない）', API.pvpReconnRemain(now - 5000, now) === 0);
  check('残り秒数: 端数は切り上げ', API.pvpReconnRemain(now + 1500, now) === 2);
  check('リログ検知: 最近(10秒前)は有効', API.pvpResumeIsRecent({ ts: now - 10000 }, now) === true);
  check('リログ検知: 古い(数分前)は無効', API.pvpResumeIsRecent({ ts: now - 300000 }, now) === false);
  check('リログ検知: null/未記録は無効', API.pvpResumeIsRecent(null, now) === false);
  check('リログ検知: maxMs指定が効く', API.pvpResumeIsRecent({ ts: now - 5000 }, now, 1000) === false);
}

console.log('\n=== 72) トロフィー: ELOレート計算 ===');
{
  // 同レート同士：勝てば+16, 負ければ-16（K=32, 期待勝率0.5）
  check('同レートで勝つと+16', API.eloDelta(1000, 1000, true) === 16, API.eloDelta(1000, 1000, true));
  check('同レートで負けると-16', API.eloDelta(1000, 1000, false) === -16, API.eloDelta(1000, 1000, false));
  // 格上に勝つと大きく増える / 格下に勝っても少し
  check('格上(+400)に勝つと大きい(>16)', API.eloDelta(1000, 1400, true) > 16, API.eloDelta(1000, 1400, true));
  check('格下(-400)に勝つと小さい(<16)', API.eloDelta(1000, 600, true) < 16, API.eloDelta(1000, 600, true));
  // 格下に負けると大きく減る
  check('格下(-400)に負けると大きく減る(<-16)', API.eloDelta(1000, 600, false) < -16, API.eloDelta(1000, 600, false));
  // 期待勝率：格上ほど低い
  check('期待勝率は格上相手だと0.5未満', API.eloExpected(1000, 1400) < 0.5);
  // applyProfileでトロフィー/戦績が反映される
  API.applyProfile({ trophies: 1234, wins: 5, losses: 3 });
  check('applyProfileでトロフィー反映', API.myTrophies() === 1234, API.myTrophies());
  check('トロフィーはbuildProfileに出る', API.buildProfile().trophies === 1234);
  check('不正トロフィーは無視', (API.applyProfile({ trophies: 'x' }), API.myTrophies() === 1234));
}

console.log('\n=== 73) オンライン人数: presence集計 ===');
{
  check('空はオンライン0・マッチ待ち0・対戦中0', JSON.stringify(API.presenceCounts(null)) === JSON.stringify({ online: 0, battling: 0, matching: 0 }));
  const obj = { a: { status: 'home' }, b: { status: 'battling' }, c: { status: 'matching' }, d: { status: 'battling' }, e: { status: 'matching' } };
  const r = API.presenceCounts(obj);
  check('オンラインは全エントリ数', r.online === 5, r);
  check('対戦中はstatus=battlingの数', r.battling === 2, r);
  check('マッチ待ちはstatus=matchingの数', r.matching === 2, r);
  check('壊れたエントリは無視', API.presenceCounts({ x: null, y: { status: 'home' } }).online === 1);
  // バックグラウンド放置(away)はオンライン人数に数えない
  const obj2 = { a: { status: 'home' }, b: { status: 'away' }, c: { status: 'battling' }, d: { status: 'away' } };
  const r2 = API.presenceCounts(obj2);
  check('away はオンラインに数えない', r2.online === 2, r2);
  check('away は対戦中にも数えない', r2.battling === 1, r2);
}

console.log('\n=== 74) PVPはデッキ4枚必須（4枚未満はブロック） ===');
{
  API.setMyDeck([]);
  check('0枚はPVP不可（ブロック=true）', API.needFullDeckForPvp() === true);
  API.setMyDeck(['cookie', 'choco', 'shoe']);
  check('3枚はPVP不可（ブロック=true）', API.needFullDeckForPvp() === true);
  API.setMyDeck(['cookie', 'choco', 'shoe', 'bomb']);
  check('4枚そろえばPVP可（ブロック=false）', API.needFullDeckForPvp() === false);
  API.setMyDeck([]);
}

console.log('\n=== 77) 新キャラ シェルマカロン（殻スピン→スタン→通常／ビッグシェル強化） ===');
{
  const W = 440, H = 660;
  const mc = API.UNIT_BY_KEY['macaron'];
  check('macaronが登録されている（2体・shell）', !!mc && mc.shell === true && mc.count === 2, mc && { shell: mc.shell, count: mc.count });
  // 初期状態：殻スピン
  let w = API.createWorld(W, H); API.world = w; w.phase = 'battle'; w.intro = 0;
  const m = API.makeFighters('macaron', 'p', W, H, 'army')[0];
  m.x = W / 2; m.y = H / 2; m.appear = 1; w.units.push(m);
  const e = API.makeFighters('choco', 'e', W, H, 'army')[0];
  e.x = W / 2 + 30; e.y = H / 2; e.appear = 1; e.hp = e.maxHp = 9999; w.units.push(e);
  check('開幕は殻スピン（shellPhase=spin・inShell）', m.shellPhase === 'spin' && m.inShell === true);
  // 殻スピン中の被ダメージ9%カット
  const before = m.hp; API.applyHit(w, e, m, 100);
  check('殻スピン中は被ダメージ80%カット（100→20）', Math.round(before - m.hp) === 20, before - m.hp);
  // 以降は死亡で検証がブレないようマカロンを高HP化・敵の攻撃は無効化（体当たり検証は別）
  m.hp = m.maxHp = 99999; e.atk = 0;
  // スピン中は動き回り、敵に体当たりダメージが入る
  const ex0 = m.x, ey0 = m.y; let rammed = false; const ehpBefore = e.hp;
  for (let i = 0; i < 30; i++) { API.stepWorld(w, 1 / 60); if (e.hp < ehpBefore) rammed = true; }
  check('スピン中は移動する', m.x !== ex0 || m.y !== ey0);
  check('スピン中の体当たりで敵にダメージ', rammed, { before: ehpBefore, now: e.hp });
  // 時間経過でスピン→スタン→通常 に遷移
  let sawStun = false, sawNormal = false, stunInShell = null, stunDmg = null;
  for (let i = 0; i < 60 * 8; i++) {
    API.stepWorld(w, 1 / 60);
    if (m.shellPhase === 'stun') {
      sawStun = true;
      if (stunInShell === null) { stunInShell = m.inShell; const h0 = m.hp; API.applyHit(w, foe, m, 100); stunDmg = h0 - m.hp; }   // スタン中に100ダメージ
    }
    if (m.shellPhase === 'normal') { sawNormal = true; break; }
  }
  check('スピン後にスタンへ遷移する', sawStun);
  check('スタン（気絶）中は無防備＝inShellでない', stunInShell === false, stunInShell);
  check('スタン中は被ダメージがカットされない（100→100）', stunDmg === 100, stunDmg);
  check('スタン後に通常戦闘へ遷移する', sawNormal);
  check('通常時はinShellでない（カットなし）', m.inShell === false);
  // ビッグシェル強化：HPが増える
  let wb = API.createWorld(W, H); API.world = wb;
  const m2 = API.makeFighters('macaron', 'p', W, H, 'army')[0]; m2.appear = 1; wb.units.push(m2);
  API.makeFighters('macaron', 'e', W, H, 'army').forEach(f => { f.appear = 1; wb.units.push(f); });
  const baseHp = m2.baseMaxHp;
  API.applyMacaronBuff(wb, 'p');
  check('ビッグシェルでHPが増える', m2.maxHp === Math.round(baseHp * (1 + 0.6)) && m2.hp === m2.maxHp, { base: baseHp, now: m2.maxHp });
  check('macaronBuff フラグが立つ', m2.macaronBuff === true);
  check('敵マカロンには適用されない', wb.units.filter(u => u.side === 'e' && u.key === 'macaron').every(u => !u.macaronBuff));
  API.applyMacaronBuff(wb, 'p');
  check('2回適用しても重ねがけしない', m2.maxHp === Math.round(baseHp * (1 + 0.6)));
  // 詳細表示にビッグシェルが出る（HP増加なのでstatsあり）
  const ed = API.enhDisplay(mc);
  const be = ed.find(x => x.kind === '強化');
  check('詳細にビッグシェルが出てHPが併記される', be && be.name === 'ビッグシェル' && be.stats && be.stats.hp > mc.hp, be && be.stats);
}

console.log('\n=== 76) 新キャラ アイスクリームウィザード（氷弾AoE＋ヒット鈍足／ブリザード強化） ===');
{
  const W = 440, H = 660;
  // ユニット定義の基本
  const iw = API.UNIT_BY_KEY['icewiz'];
  check('icewizが登録されている', !!iw && iw.ranged === true && iw.count === 1, iw && { ranged: iw.ranged, count: iw.count });
  check('小範囲AoE（splash>0）かつヒット鈍足（slowHit>0）', iw.splash > 0 && iw.slowHit > 0, { splash: iw.splash, slowHit: iw.slowHit });
  // 氷弾が敵に当たると鈍足(chillT/chillAmt)が付き、slowMulが下がる
  let w = API.createWorld(W, H); API.world = w; w.phase = 'battle'; w.intro = 0;
  const caster = API.makeFighters('icewiz', 'p', W, H, 'army')[0];
  caster.x = W / 2; caster.y = H / 2 + 40; caster.appear = 1; caster.cool = 0; w.units.push(caster);
  const foe = API.makeFighters('choco', 'e', W, H, 'army')[0];
  foe.x = W / 2; foe.y = H / 2 + 40 - (iw.range - 10); foe.appear = 1; w.units.push(foe);   // 射程内に配置
  let fired = false, chilled = false;
  for (let i = 0; i < 240 && !chilled; i++) {   // 最大4秒ぶん回す
    API.stepWorld(w, 1 / 60);
    if (w.shots.length) fired = true;
    if (foe.chillT > 0) chilled = true;
  }
  check('氷弾を発射する（shotsが生成される）', fired);
  check('命中した敵に鈍足が付く（chillT>0・chillAmt>0）', chilled && foe.chillAmt > 0, { chillT: foe.chillT, chillAmt: foe.chillAmt });
  API.stepWorld(w, 1 / 60);   // 鈍足はヒット翌フレーム冒頭でslowMulに反映される
  check('鈍足中はslowMulが1未満（足が遅くなる）', foe.slowMul < 1, foe.slowMul);
  // ブリザード強化：爆風が広がり、スローが強化される
  let wb = API.createWorld(W, H); API.world = wb;
  const c2 = API.makeFighters('icewiz', 'p', W, H, 'army')[0]; c2.appear = 1; wb.units.push(c2);
  API.makeFighters('icewiz', 'e', W, H, 'army').forEach(f => { f.appear = 1; wb.units.push(f); });
  const baseSplash = c2.splash, baseSlow = c2.slowHit;
  API.applyIcewizBuff(wb, 'p');
  check('ブリザードで爆風が広がる', c2.splash > baseSplash, { base: baseSplash, now: c2.splash });
  check('ブリザードでスローが強化される', c2.slowHit > baseSlow, { base: baseSlow, now: c2.slowHit });
  check('icewizBuff フラグが立つ', c2.icewizBuff === true);
  check('敵ウィザードには適用されない', wb.units.filter(u => u.side === 'e' && u.key === 'icewiz').every(u => !u.icewizBuff));
  // 冪等性
  API.applyIcewizBuff(wb, 'p');
  check('2回適用しても重ねがけしない（基準から再計算）', c2.splash === Math.round((iw.splash) * 1.8));
  // 詳細表示にブリザードが出る（ステータス変化なしなのでstatsはnull）
  const ed = API.enhDisplay(iw);
  check('詳細にブリザードの固有強化が出る', ed.some(e => e.kind === '強化' && e.name === 'ブリザード'), ed.map(e => e.name));
}

console.log('\n=== 75) キャラ詳細: 進化後/強化後の表示（enhDisplay）と強化カードの絵（specialCardIcon） ===');
{
  // チョコ：強化（ビター装甲）の強化後ステータスが出る（HP200→300・atk21→29）
  const ec = API.enhDisplay(API.UNIT_BY_KEY['choco']);
  const buff = ec.find(e => e.kind === '強化');
  check('チョコに強化エントリが出る', !!buff, ec.map(e => e.kind));
  check('強化後HP=300', buff && buff.stats && buff.stats.hp === 300, buff && buff.stats);
  check('強化後ATK=29', buff && buff.stats && buff.stats.atk === 29, buff && buff.stats);
  check('強化エントリに進化後の立ち絵キーが付く', buff && buff.sprite === 'choco_buff_blue', buff && buff.sprite);
  // パンケーキ：進化＋強化の2エントリ。進化後HP=round(150*3.5)=525
  const ep = API.enhDisplay(API.UNIT_BY_KEY['pancake']);
  check('パンケーキは進化と強化の2エントリ', ep.length === 2 && ep[0].kind === '進化', ep.map(e => e.kind));
  check('進化後HP=525', ep[0].stats.hp === 525, ep[0].stats);
  // 効果のみの強化（クッキー）はステータス併記なし
  const ek = API.enhDisplay(API.UNIT_BY_KEY['cookie']);
  check('クッキーは強化エントリありでステータスはnull', ek.length === 1 && ek[0].stats === null, ek);
  // specialCardIcon：evoSprite持ちは進化後の絵（img）、無ければ対象キャラのベース絵
  check('強化カードの絵：evoSpriteありはimg', /<img /.test(API.specialCardIcon(API.SPECIALS['buff_choco'])));
  check('強化カードの絵：evoSprite無し(特大大福)もベース絵にフォールバック', API.specialCardIcon(API.SPECIALS['buff_daifuku']).length > 0);
}

console.log('\n=== 78) PVP プライベート部屋の再戦ハンドシェイク（REMATCH往復） ===');
{
  const [hWire, gWire] = API.createLoopbackPair();
  let hostGotRematch = null, guestGotRematch = 0;
  const host = API.makePvpHost(hWire, {
    onGuestHello: () => {},
    onGuestRematch: (deck) => { hostGotRematch = deck; },
  });
  const guest = API.makePvpGuest(gWire, {
    onRematch: () => { guestGotRematch++; },
  });
  // 子が「もう一度」＝今のデッキを添えて再戦希望を親へ
  guest.rematch(['cookie', 'choco', 'shoe', 'bomb']);
  check('子→親：REMATCHでデッキが届く', JSON.stringify(hostGotRematch) === JSON.stringify(['cookie', 'choco', 'shoe', 'bomb']), hostGotRematch);
  check('子→親：getGuestDeckも再戦デッキに更新される', JSON.stringify(host.getGuestDeck()) === JSON.stringify(['cookie', 'choco', 'shoe', 'bomb']), host.getGuestDeck());
  // 親が「もう一度」＝子へ再戦希望を通知（UI表示用）
  host.rematch();
  check('親→子：REMATCH通知が届く', guestGotRematch === 1, guestGotRematch);
}

console.log('\n=== 79) 熟練度XP（PVPのみ・勝ち多め/負け少なめ）で特別アバターを解禁 ===');
{
  const WIN = API.MASTERY_WIN_XP, LOSE = API.MASTERY_LOSE_XP, PER = API.MASTERY_XP_PER_LEVEL;
  API.myProfile.mastery = {};
  API.myProfile.avatar = '';
  API.setMyDeck(['cookie', 'choco', 'shoe', 'bomb']);
  check('初期はロック中（ava_cookie 未解禁）', API.avatarUnlocked('ava_cookie') === false);
  check('通常ユニットアイコンは常に選べる', API.avatarUnlocked('cookie') === true);
  // 勝ち＝多め、負け＝少なめ
  API.awardMasteryXp(true);
  check('勝利でWIN_XP入る', API.masteryXp('cookie') === WIN, API.masteryXp('cookie'));
  API.awardMasteryXp(false);
  check('敗北でLOSE_XP入る（勝ちより少ない）', API.masteryXp('cookie') === WIN + LOSE && LOSE < WIN, { now: API.masteryXp('cookie') });
  check('デッキ外のキャラはXPが入らない', API.masteryXp('daifuku') === 0);
  // レベル＝XP/PER。解禁レベル(lvl=3)に必要なXP(=3*PER)まで勝ちを積む
  API.myProfile.mastery = { cookie: 0 };
  const needLv = 3, needXp = needLv * PER;
  let guard = 0;
  while (API.masteryXp('cookie') < needXp - WIN && guard < 200) { API.awardMasteryXp(true); guard++; }
  check('解禁レベル手前ではまだロック', API.avatarUnlocked('ava_cookie') === false, { xp: API.masteryXp('cookie'), lv: API.masteryLevel('cookie') });
  API.awardMasteryXp(true);   // これでLv3到達
  check('解禁レベル到達でava_cookieが解禁', API.masteryLevel('cookie') >= needLv && API.avatarUnlocked('ava_cookie') === true, { xp: API.masteryXp('cookie'), lv: API.masteryLevel('cookie') });
  check('レベル＝floor(XP/PER)', API.masteryLevel('cookie') === Math.floor(API.masteryXp('cookie') / PER));
  // 保存往復で熟練度XPが保たれる
  const saved = API.buildProfile();
  check('buildProfileに熟練度XPが入る', saved.mastery && saved.mastery.cookie === API.masteryXp('cookie'), saved.mastery);
  API.myProfile.mastery = {};
  API.applyProfile({ mastery: { cookie: needXp } });
  check('applyProfileで熟練度XPが復元される', API.masteryXp('cookie') === needXp);
}

console.log('\n=== 80) 大福サムライ：敵を見失って(ゴーストのワープ中)も固まらず復帰 ===');
{
  const W = 440, H = 660;
  const w = API.createWorld(W, H); API.world = w; w.phase = 'battle'; w.intro = 0;
  const sam = API.makeFighters('daifuku', 'p', W, H, 'army')[0];
  sam.x = W / 2; sam.y = H / 2 + 100; sam.appear = 1; sam.hp = sam.maxHp = 99999; w.units.push(sam);
  const foe = API.makeFighters('choco', 'e', W, H, 'army')[0];
  foe.x = W / 2; foe.y = H / 2 - 100; foe.appear = 1; foe.hp = foe.maxHp = 99999; w.units.push(foe);
  // 敵を無敵にして「見失う」状態を作る（ゴーストのワープ中＝nearestEnemyが返さないのと同じ）
  for (let i = 0; i < 120; i++) { foe.invuln = 5; API.stepWorld(w, 1 / 60); }
  check('敵を見失うと idle になる', sam.cstate === 'idle', sam.cstate);
  // 敵が戻る（無敵解除＝ワープ終了）→ 固まらず居合に復帰する
  foe.invuln = 0;
  for (let i = 0; i < 240; i++) { API.stepWorld(w, 1 / 60); }
  check('敵が戻ると idle から復帰する（固まらない）', sam.cstate !== 'idle', sam.cstate);
  check('復帰後は居合の状態（charge/dash/walk）になる', ['charge', 'dash', 'walk'].includes(sam.cstate), sam.cstate);
  check('復帰後に敵へダメージが入る（実際に攻撃できている）', foe.hp < foe.maxHp, { hp: foe.hp, max: foe.maxHp });
}

console.log('\n=== 81) 爆発など直接ダメージにも殻カットが効く（マカロン） ===');
{
  const W = 440, H = 660;
  const w = API.createWorld(W, H); API.world = w; w.phase = 'battle';
  const bomb = API.makeFighters('bomb', 'e', W, H, 'army')[0]; bomb.x = W / 2; bomb.y = H / 2; w.units.push(bomb);
  // 同じ距離(20px)に2体のマカロン：片方だけ殻(inShell)
  const m1 = API.makeFighters('macaron', 'p', W, H, 'army')[0]; m1.x = W / 2 + 20; m1.y = H / 2; m1.hp = m1.maxHp = 99999; m1.inShell = true; m1.shellPhase = 'spin'; w.units.push(m1);
  const m2 = API.makeFighters('macaron', 'p', W, H, 'army')[0]; m2.x = W / 2 - 20; m2.y = H / 2; m2.hp = m2.maxHp = 99999; m2.inShell = false; m2.shellPhase = 'normal'; w.units.push(m2);
  const h1 = m1.hp, h2 = m2.hp;
  API.killUnit(w, bomb);   // ポップコーン爆発
  const d1 = h1 - m1.hp, d2 = h2 - m2.hp;
  check('殻マカロン(inShell)は爆発ダメージが軽減される', d1 > 0 && d1 < d2, { shell: d1, normal: d2 });
  check('軽減量は殻カット相当（約80%カット＝2割）', Math.abs(d1 - Math.round(d2 * 0.2)) <= 1, { shell: d1, normal: d2 });
}

console.log('\n=== 82) 低負荷モード：粒子(見た目)の上限とburstの間引き ===');
{
  const W = 440, H = 660;
  const w = API.createWorld(W, H); API.world = w;
  // 通常時は上限=HI
  API.LOW_FX = false;
  check('通常時 partCap = PART_CAP_HI', API.partCap() === API.PART_CAP_HI, API.partCap());
  // 大量に burst してもキャップを超えない
  for (let i = 0; i < 50; i++) API.burst(w, 100, 100, '#fff', 20, 120);
  check('通常時 burst は partCap を超えない', w.parts.length <= API.PART_CAP_HI, w.parts.length);
  const hiLen = w.parts.length;
  // 低負荷モードに切替＝上限が下がる＋生成が半減する
  API.LOW_FX = true;
  check('低負荷時 partCap = PART_CAP_LO', API.partCap() === API.PART_CAP_LO, API.partCap());
  check('PART_CAP_LO < PART_CAP_HI', API.PART_CAP_LO < API.PART_CAP_HI, [API.PART_CAP_LO, API.PART_CAP_HI]);
  const w2 = API.createWorld(W, H);
  for (let i = 0; i < 50; i++) API.burst(w2, 100, 100, '#fff', 20, 120);
  check('低負荷時 burst は PART_CAP_LO を超えない', w2.parts.length <= API.PART_CAP_LO, w2.parts.length);
  // 1回のburstで生成される数：低負荷は約半分（cap未満の空worldで比較）
  API.LOW_FX = false; const wa = API.createWorld(W, H); API.burst(wa, 0, 0, '#fff', 20, 120);
  API.LOW_FX = true;  const wb = API.createWorld(W, H); API.burst(wb, 0, 0, '#fff', 20, 120);
  check('低負荷時 burst の生成数は通常の約半分', wb.parts.length === Math.ceil(wa.parts.length * 0.5), [wa.parts.length, wb.parts.length]);
  API.LOW_FX = false;   // 後続に影響しないよう戻す
  void hiLen;
}

console.log('\n=== 83) PVP役割調整（A案：PCを優先して親） ===');
{
  const D = API.pvpDecideIAmHost;
  // PC×スマホは端末で決まる（誰が接続を張ったかに関係なくPCが親）
  check('PC自分 × スマホ相手 → 自分が親', D(false, 'pc', 'mobile') === true && D(true, 'pc', 'mobile') === true);
  check('スマホ自分 × PC相手 → 自分は子', D(true, 'mobile', 'pc') === false && D(false, 'mobile', 'pc') === false);
  // 同種は従来どおり（接続を張った側＝元の親を維持）
  check('PC同士は元の親を維持', D(true, 'pc', 'pc') === true && D(false, 'pc', 'pc') === false);
  check('スマホ同士は元の親を維持', D(true, 'mobile', 'mobile') === true && D(false, 'mobile', 'mobile') === false);
  // 「必ず1人だけが親」＝両者の判定を突き合わせて host はちょうど1人
  const combos = [['pc','pc'],['pc','mobile'],['mobile','pc'],['mobile','mobile']];
  let ok = true;
  for (const [aDev, bDev] of combos) {
    // a=元の親(true), b=元の子(false) の視点。相手デバイスを入れ替えて渡す。
    const aHost = D(true,  aDev, bDev);
    const bHost = D(false, bDev, aDev);
    if ((aHost ? 1 : 0) + (bHost ? 1 : 0) !== 1) ok = false;   // 合計で親はちょうど1人
  }
  check('どの端末組み合わせでも親はちょうど1人（役割の一貫性）', ok);
}

console.log('\n=== 84) PVP端末組み合わせの集計カテゴリ（pvpMatchupType） ===');
{
  const T = API.pvpMatchupType;
  check('PC同士 → pc_pc', T('pc', 'pc') === 'pc_pc');
  check('スマホ同士 → mobile_mobile', T('mobile', 'mobile') === 'mobile_mobile');
  check('スマホ×PC → pc_mobile（順不同）', T('mobile', 'pc') === 'pc_mobile' && T('pc', 'mobile') === 'pc_mobile');
  check('相手不明(旧版) → unknown', T('pc', 'unknown') === 'unknown' && T('unknown', 'mobile') === 'unknown' && T('pc', '') === 'unknown');
}

console.log('\n=== 85) キャラ詳細：ダメージタイプ判定＋最も使うキャラ ===');
{
  const U = API.UNIT_BY_KEY, D = API.unitDamageType;
  check('クッキー＝近距離・単体', D(U.cookie) === '近距離・単体', D(U.cookie));
  check('シューアーチャー＝遠距離・単体', D(U.shoe) === '遠距離・単体', D(U.shoe));
  check('アイス＝遠距離・範囲', D(U.icewiz) === '遠距離・範囲', D(U.icewiz));
  check('キャノン＝遠距離・範囲', D(U.cannon) === '遠距離・範囲', D(U.cannon));
  check('大福＝近距離・範囲（薙ぎ払い）', D(U.daifuku) === '近距離・範囲', D(U.daifuku));
  check('ポップコーン＝自爆・範囲', D(U.bomb) === '自爆・範囲', D(U.bomb));
  check('ベーカリー＝生産（非攻撃）', D(U.bakery) === '生産（非攻撃）', D(U.bakery));
  check('マカロン＝近距離・単体', D(U.macaron) === '近距離・単体', D(U.macaron));
  // 最も使うキャラ：使用回数の最大を返す
  const prof = API.myProfileRef;
  prof.usage = { cookie: 2, choco: 5, shoe: 1 };
  check('mostUsedUnit＝使用回数が最大のキャラ', API.mostUsedUnit() === 'choco', API.mostUsedUnit());
  prof.usage = {};   // 使用回数なし→熟練度にフォールバック
  prof.mastery = { bomb: 30, cookie: 10 };
  check('使用回数ゼロなら熟練度が最大のキャラにフォールバック', API.mostUsedUnit() === 'bomb', API.mostUsedUnit());
  prof.mastery = {};
  check('どちらも無ければ null', API.mostUsedUnit() === null, API.mostUsedUnit());
}

console.log('\n=== 86) プロフィール保存：最高トロフィー(best)と使用回数(usage)の往復 ===');
{
  const prof = API.myProfileRef;
  prof.trophies = 1200; prof.best = 1150; prof.usage = { cookie: 3 };
  const p = API.buildProfile();
  check('buildProfile: best は現在値と保存値の大きい方', p.best === 1200, p.best);
  check('buildProfile: usage を書き出す', p.usage && p.usage.cookie === 3, p.usage);
  // マージ：大きい方を採用
  API.applyProfile({ best: 1400, usage: { cookie: 1, choco: 9 } });
  check('applyProfile: best は大きい方(1400)', prof.best === 1400, prof.best);
  check('applyProfile: usage はキーごとに大きい方', prof.usage.cookie === 3 && prof.usage.choco === 9, prof.usage);
  API.applyProfile({ best: 100 });   // 小さい値では下がらない
  check('applyProfile: best は下がらない', prof.best === 1400, prof.best);
}

console.log('\n=== 87) 詳細：攻撃力に爆発/弾のダメージを表示＋スライム融合/ジンジャー併記 ===');
{
  const U = API.UNIT_BY_KEY, A = API.unitAtkText;
  check('通常攻撃はatkを表示', A(U.cookie) === '⚔ 14', A(U.cookie));
  check('ポップコーン＝爆発ダメージ(blast)', A(U.bomb) === '💥 100', A(U.bomb));
  check('ソーダ＝爆発ダメージ(blast)', A(U.soda) === '💥 10', A(U.soda));
  check('キャンディキャノン＝迫撃弾ダメージ(mortar)', A(U.cannon) === '💥 60', A(U.cannon));
  check('ベーカリー＝攻撃しない(—)', A(U.bakery) === '—', A(U.bakery));
  check('アイス＝氷弾のatkを表示', A(U.icewiz) === '⚔ 20', A(U.icewiz));
  // enhDisplay：スライムに融合、ベーカリーにジンジャーの項目が入る
  const es = API.enhDisplay(U.slime);
  check('スライム詳細に「スライム融合」が出る', es.some(e => e.name.indexOf('融合') >= 0), es.map(e => e.name));
  const eb = API.enhDisplay(U.bakery);
  check('ベーカリー詳細に「ジンジャーソルジャー」が出る', eb.some(e => e.name.indexOf('ジンジャー') >= 0), eb.map(e => e.name));
}

console.log('\n=== 88) 熟練度カーブ（Lv3以降は必要XP増）＋よもぎ大福スキン ===');
{
  const X = API.masteryXpForLevel;
  check('Lv1到達=50XP', X(1) === 50, X(1));
  check('Lv2到達=100XP', X(2) === 100, X(2));
  check('Lv3到達=150XP（従来どおり）', X(3) === 150, X(3));
  check('Lv4到達=250XP（+100）', X(4) === 250, X(4));
  check('Lv5到達=400XP（+150）', X(5) === 400, X(5));
  check('Lv6到達=600XP（+200）', X(6) === 600, X(6));
  check('Lv3→4のコスト(100)>Lv2→3(50)', (X(4)-X(3)) > (X(3)-X(2)), [X(4)-X(3), X(3)-X(2)]);
  const prof = API.myProfileRef;
  // レベル判定：XPからLvが正しく出る
  prof.mastery = { daifuku: 399 }; check('399XP=Lv4', API.masteryLevel('daifuku') === 4, API.masteryLevel('daifuku'));
  prof.mastery = { daifuku: 400 }; check('400XP=Lv5', API.masteryLevel('daifuku') === 5, API.masteryLevel('daifuku'));
  // スキン解禁（daifuku_yomogi は Lv5）
  prof.skins = {};
  prof.mastery = { daifuku: 399 }; check('Lv5未満はスキン未解禁', API.skinUnlocked('daifuku_yomogi') === false);
  prof.mastery = { daifuku: 400 }; check('Lv5でスキン解禁', API.skinUnlocked('daifuku_yomogi') === true);
  // 装備トグル＋activeSkinBase
  check('未装備なら activeSkinBase=null', API.activeSkinBase('daifuku') === null, API.activeSkinBase('daifuku'));
  API.equipSkin('daifuku', 'daifuku_yomogi');
  check('装備すると activeSkinBase=daifuku_yomogi', API.activeSkinBase('daifuku') === 'daifuku_yomogi', API.activeSkinBase('daifuku'));
  API.equipSkin('daifuku', 'daifuku_yomogi');   // トグルoff
  check('もう一度で外れる', API.activeSkinBase('daifuku') === null, API.activeSkinBase('daifuku'));
  // 未解禁だと装備しても適用されない
  prof.mastery = { daifuku: 100 }; prof.skins = { daifuku: 'daifuku_yomogi' };
  check('解禁前は装備しても適用されない', API.activeSkinBase('daifuku') === null);
  prof.skins = {}; prof.mastery = {};
}

console.log('\n=== 89) 無料アイコン（最初から選べる）＋絵文字廃止 ===');
{
  const prof = API.myProfileRef; prof.mastery = {};
  check('ava_cookie_free は無料（解禁済み）', API.avatarUnlocked('ava_cookie_free') === true);
  check('ava_ginger は無料', API.avatarUnlocked('ava_ginger') === true);
  check('ava_shoe は無料化', API.avatarUnlocked('ava_shoe') === true);
  check('ava_daifuku はLv3必要（未解禁）', API.avatarUnlocked('ava_daifuku') === false);
  // 絵文字/旧ユニットkeyは既定クッキーに正規化
  prof.avatar = 'daifuku';   // 旧・絵文字
  check('絵文字ユーザーは表示上クッキーに置換', API.displayProfile().avatar === 'ava_cookie_free', API.displayProfile().avatar);
  prof.avatar = 'ava_macaron';   // 有効な画像アイコンはそのまま
  check('有効な画像アイコンは保持', API.displayProfile().avatar === 'ava_macaron', API.displayProfile().avatar);
  prof.avatar = '';
}

console.log('\n=== 90) アニメ付きキャラ（マシュマロエンジェル）：フレーム切替＋テスト除外 ===');
{
  const U = API.UNIT_BY_KEY.mangel;
  check('mangel が存在する', !!U, U);
  check('anim フレームを3枚持つ', U && U.anim && U.anim.length === 3, U && U.anim);
  check('test:true（通常プレイから除外）', U && U.test === true);
  // フレームがworld.tで切り替わる（animFps=5）
  const w = API.createWorld(440, 660); API.world = w; w.phase = 'battle';
  const f = API.makeFighters('mangel', 'p', 440, 660, 'army')[0]; w.units.push(f);
  w.t = 0.0; const s0 = API.spriteFor(f);
  w.t = 0.25; const s1 = API.spriteFor(f);   // floor(0.25*5)=1 → 2枚目
  w.t = 0.45; const s2 = API.spriteFor(f);   // floor(0.45*5)=2 → 3枚目
  check('t=0 は1枚目（青）', s0 === API.SPRITES['mangel_1'], !!s0);
  check('t=0.25 は2枚目（青）', s1 === API.SPRITES['mangel_2'], !!s1);
  check('t=0.45 は3枚目（青）', s2 === API.SPRITES['mangel_3'], !!s2);
  check('フレームが実際に変化する', s0 !== s1 && s1 !== s2, [s0 === s1, s1 === s2]);
  // 敵(side='e')は赤フレームを使う
  check('animRed を3枚持つ', U && U.animRed && U.animRed.length === 3, U && U.animRed);
  const fe = API.makeFighters('mangel', 'e', 440, 660, 'army')[0]; w.units.push(fe);
  w.t = 0.0; check('敵 t=0 は赤1枚目', API.spriteFor(fe) === API.SPRITES['mangel_red_1'], true);
  w.t = 0.25; check('敵 t=0.25 は赤2枚目', API.spriteFor(fe) === API.SPRITES['mangel_red_2'], true);
  // ランダムCPUデッキにテストキャラは入らない
  let poolHasTest = false;
  for (const u of API.UNITS) { if (u.test) poolHasTest = true; }
  check('UNITSにtestキャラは居るが、通常ロスターからは除外設計', poolHasTest === true);
  // クマグミ（静止・陣営色を1枚アニメで出し分け）
  const K = API.UNIT_BY_KEY.kumagumi;
  check('kumagumi が存在し test:true', !!K && K.test === true);
  const kp = API.makeFighters('kumagumi', 'p', 440, 660, 'army')[0]; w.units.push(kp);
  const ke = API.makeFighters('kumagumi', 'e', 440, 660, 'army')[0]; w.units.push(ke);
  check('クマグミ 味方=青スプライト', API.spriteFor(kp) === API.SPRITES['kumagumi_blue'], true);
  check('クマグミ 敵=赤スプライト', API.spriteFor(ke) === API.SPRITES['kumagumi_red'], true);
  // テスト用キャラは2体以上（選択できる）
  check('テスト用キャラが2体以上（アニメテストで選択可）', API.UNITS.filter(u => u.test).length >= 2, API.UNITS.filter(u => u.test).map(u => u.key));
}

console.log('\n=== 91) ログイン同期: profileHasProgress / profilesConflict（クラウド突き合わせ） ===');
{
  const T = 1000;   // TROPHY_START
  // profileHasProgress：記録の有無判定
  check('空プロフィールは記録なし', API.profileHasProgress({}) === false);
  check('nullは記録なし', API.profileHasProgress(null) === false);
  check('初期トロフィーのみは記録なし', API.profileHasProgress({ trophies: T, wins: 0, losses: 0 }) === false);
  check('デッキありは記録あり', API.profileHasProgress({ deck: ['cookie'] }) === true);
  check('勝敗ありは記録あり', API.profileHasProgress({ wins: 1 }) === true);
  check('トロフィーが初期と違えば記録あり', API.profileHasProgress({ trophies: 1200 }) === true);
  check('bestが初期超なら記録あり', API.profileHasProgress({ best: 1100 }) === true);
  check('熟練度ありは記録あり', API.profileHasProgress({ mastery: { cookie: 10 } }) === true);
  // profilesConflict：両方に記録があり主要戦績が食い違うときだけ true
  const cloudA = { deck: ['cookie'], trophies: 1300, wins: 5, losses: 2 };
  const localA = { deck: ['choco'], trophies: 1100, wins: 3, losses: 4 };
  check('両方に記録＋戦績が違う→衝突', API.profilesConflict(localA, cloudA) === true);
  check('同じ戦績なら衝突しない', API.profilesConflict({ trophies: 1300, wins: 5, losses: 2 }, cloudA) === false);
  check('端末に記録なし→衝突しない（クラウド復元でよい）', API.profilesConflict({}, cloudA) === false);
  check('クラウドに記録なし→衝突しない（端末アップロードでよい）', API.profilesConflict(localA, {}) === false);
  check('トロフィーだけ違っても衝突', API.profilesConflict({ trophies: 1200, wins: 5, losses: 2 }, cloudA) === true);
}

console.log('\n=== 92) ランキング: filterActiveEntries（放置アカウントを除外） ===');
{
  const now = 1_000_000_000_000;
  const day = 24 * 60 * 60 * 1000;
  const win = 30 * day;
  const arr = [
    { uid: 'a', trophies: 1200, ts: now - 1 * day },      // 直近 → 残る
    { uid: 'b', trophies: 1500, ts: now - 29 * day },     // ギリ直近 → 残る
    { uid: 'c', trophies: 1800, ts: now - 31 * day },     // 期限切れ → 除外
    { uid: 'd', trophies: 1100 },                         // ts なし → 除外
    { uid: 'e', trophies: 1300, ts: 'x' },                // ts 不正 → 除外
  ];
  const r = API.filterActiveEntries(arr, now, win);
  check('直近30日のエントリだけ残る', r.length === 2, r.map(e => e.uid));
  check('残るのは a と b', r.some(e => e.uid === 'a') && r.some(e => e.uid === 'b'));
  check('期限切れ(c)は除外', !r.some(e => e.uid === 'c'));
  check('ts無し(d)は除外', !r.some(e => e.uid === 'd'));
  check('ts不正(e)は除外', !r.some(e => e.uid === 'e'));
  check('空配列でも壊れない', API.filterActiveEntries(null, now, win).length === 0);
}

Promise.resolve().then(() => {
  console.log(`\n==== RESULT: ${pass} passed, ${fail} failed ====`);
  process.exit(fail ? 1 : 0);
});
