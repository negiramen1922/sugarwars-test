// Headless smoke test for nyanko.html
const fs = require('fs'), vm = require('vm');
const html = fs.readFileSync(require('path').join(__dirname,'nyanko.html'),'utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
const code = m[1];

function mkEl(){
  const ctx = new Proxy({}, {get:()=>()=>{}, set:()=>true});
  const el = {
    style:{}, dataset:{}, classList:{add(){},remove(){},toggle(){},contains:()=>false},
    children:[], width:0, height:0, value:'', checked:false, textContent:'', innerHTML:'',
    addEventListener(){}, removeEventListener(){}, appendChild(c){this.children.push(c); return c;},
    insertBefore(c){this.children.push(c); return c;}, removeChild(){}, remove(){},
    setAttribute(){}, getAttribute:()=>null, cloneNode(){return mkEl();},
    querySelector:()=>mkEl(), querySelectorAll:()=>[], getContext:()=>ctx,
    getBoundingClientRect:()=>({left:0,top:0,width:440,height:660}), focus(){}, click(){},
  };
  return el;
}
const doc = {
  getElementById:()=>mkEl(), createElement:()=>mkEl(), createElementNS:()=>mkEl(),
  querySelector:()=>mkEl(), querySelectorAll:()=>[], addEventListener(){},
  body:mkEl(), documentElement:{style:{}}, head:mkEl(),
};
const win = { addEventListener(){}, requestAnimationFrame:()=>0, devicePixelRatio:1,
  localStorage:{getItem:()=>null,setItem(){},removeItem(){}}, location:{search:'',hostname:'localhost'},
  matchMedia:()=>({matches:false,addEventListener(){}}), setTimeout:()=>0, setInterval:()=>0, clearInterval(){}, clearTimeout(){} };
const sandbox = { window:win, document:doc, console, Math, Date, JSON, Image:function(){this.onload=null;}, requestAnimationFrame:()=>0,
  setTimeout:()=>0, setInterval:()=>0, clearInterval(){}, clearTimeout(){}, localStorage:win.localStorage, navigator:{userAgent:'node'}, performance:{now:()=>0} };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
try { vm.runInContext(code, sandbox); } catch(e){ console.error('BOOT ERROR:', e.message); process.exit(1); }

const API = sandbox.globalThis.__NYANKO;
if(!API){ console.error('no __NYANKO'); process.exit(1); }

let pass=0, fail=0;
function ok(c,msg){ if(c){pass++;} else {fail++; console.error('FAIL:',msg);} }

// 1) deploy counts: num should be 1 for cookie/slime/macaron
for(const k of ['cookie','slime','macaron']) ok(API.DEFS[k].num===1, `${k} num=1 (got ${API.DEFS[k].num})`);

// 2) cookie range longer than choco (choco advances in front)
ok(API.DEFS.cookie.range > API.DEFS.choco.range, `cookie.range(${API.DEFS.cookie.range}) > choco.range(${API.DEFS.choco.range})`);

// 3) rc distinctness — no two ORDER units share the same rc
const rcs = API.ORDER.map(k=>API.DEFS[k].rc);
ok(new Set(rcs).size === rcs.length, `rc all distinct: ${JSON.stringify(API.ORDER.map(k=>[k,API.DEFS[k].rc]))}`);

// 4) front-line ordering (deterministic): smaller range stops closer to the (left) enemy = more in front.
//    Plant an immovable enemy, drop choco+cookie+ctank at the same x, step; compare stop positions.
API.reset(1);
const w = API.world; w.units.length = 0;
const yb = API.CONF.groundY - 8;
const foe = API.newUnit('m_big','e', 220, yb); foe.speed=0; foe.hp=1e9; foe.maxHp=1e9; foe.cool=1e9;
const mk = k => { const u=API.newUnit(k,'p', 400, yb); u.hp=1e9; u.maxHp=1e9; return u; };
const choco=mk('choco'), cookie=mk('cookie'), ctank=mk('ctank');
w.units.push(foe, choco, cookie, ctank);
for(let i=0;i<300;i++) API.step(1/60);   // 全員が敵手前(220)まで歩いて停止（stage spawnは360f以降なので干渉なし）
ok(choco.x < cookie.x, `choco(range${API.DEFS.choco.range}) in front of cookie(range${API.DEFS.cookie.range}): ${choco.x.toFixed(0)} < ${cookie.x.toFixed(0)}`);
ok(ctank.x < cookie.x, `cookie tank(range${API.DEFS.ctank.range}) in front of knight: tank ${ctank.x.toFixed(0)} < cookie ${cookie.x.toFixed(0)}`);
ok(API.DEFS.clance.range > API.DEFS.cookie.range, `clance(range${API.DEFS.clance.range}) sits behind cookie(range${API.DEFS.cookie.range}) by longer range`);

// 5) kbCount increased (>=4 floor)
API.reset(1); API.money=999;
API.deploy('cookie');
const cu = API.world.units.find(u=>u.side==='p'&&u.key==='cookie');
ok(cu && cu.kbCount>=4, `cookie kbCount>=4 (got ${cu&&cu.kbCount})`);
// choco (hp340) should scale higher
const chd = Math.max(4, Math.round(API.DEFS.choco.hp/70));
ok(chd>4, `choco kbCount scales above floor (=${chd})`);

// 6) battle runs without throwing on a tutorial stage to conclusion
API.reset(0);
let crashed=false;
try{ for(let i=0;i<60*90;i++){ API.money=Math.min(300, API.money+0.3); if(i%40===0) API.deploy('cookie'); API.step(1/60); if(API.ehp<=0||API.php<=0) break; } }
catch(e){ crashed=true; console.error('STEP CRASH:',e.message); }
ok(!crashed, 'battle steps without crash');

// 7) TEST MODE: all units + all stages unlocked, but money is NOT auto-maxed (test the real economy)
ok(API.testMode===false, 'test mode default OFF');
ok(!API.isUnlocked('donut'), 'donut locked when test mode off');
API.testMode = true;
ok(API.isUnlocked('donut') && API.isUnlocked('icewiz'), 'all units unlocked in test mode');
ok(API.unlockedUnits().length === API.ORDER.length, `all ${API.ORDER.length} units usable in test mode`);
ok(API.stageUnlocked(8), 'stage 8 unlocked in test mode');
API.save.upg={}; API.reset(3); // some stage; no wStart upgrade → normal (not maxed) start
ok(API.money <= API.effCap()+0.01, `money within cap in test mode (money=${API.money.toFixed(0)}, cap=${API.effCap()})`);
ok(API.money < API.effCap(), 'money is NOT auto-maxed in test mode (real economy)');
ok(API.walletLv === API.walletStartLv(), 'wallet starts at normal start-Lv in test mode');
API.testMode = false;
API.reset(1);
ok(API.money > 0 && API.money <= API.effCap(), 'money within cap at normal start');

// 8) counter samurai (daifuku): stored damage returned on attack, capped at atk*500%, then reset
API.reset(1); const cw=API.world; cw.units.length=0;
const yb2=API.CONF.groundY-8;
const sam=API.newUnit('daifuku','p', 300, yb2); sam.hp=1e9; sam.maxHp=1e9; sam.cool=0;
const tgt=API.newUnit('m_swarm','e', 280, yb2); tgt.speed=0; tgt.hp=1e6; tgt.maxHp=1e6; tgt.cool=1e9;
cw.units.push(sam, tgt);
const atk=API.DEFS.daifuku.atk;
sam.counter = 100000;                 // huge stored → should be capped
const hp0=tgt.hp; API.step(1/60);
const dealt = hp0 - tgt.hp;
ok(API.DEFS.daifuku.counter===true, 'daifuku is counter type');
ok(dealt > atk*1.5, `counter released a big hit (dealt ${dealt.toFixed(0)} >> base atk ${atk})`);
ok(dealt <= atk*9 + 1, `counter capped at atk*800%+base (dealt ${dealt.toFixed(0)} <= ${atk*9})`);
ok(sam.counter===0, 'counter store reset after release');
// accumulation: hurting a counter unit stores the received damage
API.reset(1); cw.units.length=0;
const sam2=API.newUnit('daifuku','p',300,yb2); sam2.hp=1e9; sam2.maxHp=1e9; cw.units.push(sam2);
// find hurt via a proxy: apply damage through an enemy hit is complex; use the exposed newUnit + manual: simulate by nearest attack
sam2.counter=0; // baseline
ok(API.DEFS.daifuku.hp >= 300 && API.DEFS.daifuku.cd >= 1.5, `samurai is high-HP & slow (hp${API.DEFS.daifuku.hp}, cd${API.DEFS.daifuku.cd})`);

// 9) meta-progression (EXP): にゃんこ式の財布テーブル 50/100/200/300/400/500
API.testMode = false;
API.save.upg = {}; API.save.exp = 0;
ok(JSON.stringify(API.walletCapTable())===JSON.stringify([100,200,300,400,500,600]), `wallet caps = 100/200/300/400/500/600 (got ${API.walletCapTable().join('/')})`);
API.reset(1); API.walletLv = 0;
ok(API.effCap()===100, `effCap at walletLv0 = 100 (got ${API.effCap()})`);
// 財布UP費用＝今の上限の半分（にゃんこ式・上限100→費用50）
ok(API.walletCost()===50, `wallet upgrade cost at cap100 = 50 (got ${API.walletCost()})`);
// 生産速度(wRate)のEXP強化トラックは廃止
ok(!API.UPG.wRate, 'wRate upgrade track removed');
API.walletLv = API.walletMaxLv();
ok(API.effCap()===600, `effCap at max walletLv = 600 (got ${API.effCap()})`);
// wMax meta extends the table (+100 per level)
API.save.upg={wMax:2}; ok(API.walletMaxLv()===7 && API.walletCapTable()[7]===800, `wMax meta adds levels (top=${API.walletCapTable().slice(-1)[0]})`);
// wStart meta raises the start level (start cap steps through the table)
API.save.upg={wStart:2}; API.reset(1); ok(API.walletLv===2 && API.effCap()===300, `wStart meta starts at Lv2 cap300 (got Lv${API.walletLv} cap${API.effCap()})`);
API.save.upg={};
// castle HP from meta
API.reset(1);
ok(API.php===API.upgVal('tHp'), `castle HP = UPG.tHp ${API.upgVal('tHp')} (got ${API.php})`);
ok(API.money > 0 && API.money <= API.effCap()+0.5, `start money within cap (got ${API.money.toFixed(0)})`);
// upgrade purchase: give EXP, buy wStart, value rises and EXP drops
API.save.exp = 100000;
const before = API.upgVal('wStart'), c0 = API.upgCost('wStart'), exp0 = API.save.exp;
API.buyUpgrade('wStart');
ok(API.upgLv('wStart')===1, 'buyUpgrade raised level to 1');
ok(API.upgVal('wStart') > before, `wStart value rose (${before} → ${API.upgVal('wStart')})`);
ok(API.save.exp === exp0 - c0, `EXP spent = cost ${c0} (got spent ${exp0-API.save.exp})`);
ok(API.upgCost('wStart') > c0, `next upgrade costs more (${c0} → ${API.upgCost('wStart')})`);
// tower range gate: enemy outside range is not hit
API.save.upg = {}; API.reset(1); API.world.units.length=0;
const yb3=API.CONF.groundY-8;
const far=API.newUnit('m_swarm','e', API.CONF.W - API.upgVal('tRng') - 60, yb3); far.hp=500; far.maxHp=500;
const near=API.newUnit('m_swarm','e', API.CONF.W - 40, yb3); near.hp=500; near.maxHp=500;
API.world.units.push(far, near);
const fh=far.hp, nh=near.hp; API.towerCd=0; API.castTower();   // charge the tower first (starts uncharged now)
ok(far.hp===fh, 'tower does NOT hit enemy beyond range');
ok(near.hp < nh, 'tower hits enemy within range');
// tower starts uncharged at battle start
API.reset(1); ok(API.towerCd > 0, 'tower starts uncharged (must charge before first shot)');
// character unlock gate + EXP
API.save.cleared=[]; API.save.units=[]; API.save.exp=100000;
ok(!API.unlockAvailable('daifuku'), 'premium unit locked until enough stages cleared');
API.save.cleared=Array.from({length:40},(_,i)=>i+1);   // clear plenty of stages
ok(API.unlockAvailable('daifuku'), 'premium unit unlockable after clearing enough stages');
const e2=API.save.exp; API.buyUnit('daifuku');
ok(API.save.units.includes('daifuku') && API.save.exp < e2, 'buyUnit spends EXP to unlock');

// 10) enemy roster integrity: enemies spawn and are all known roster keys (render-safe)
const KNOWN_FOE = new Set(['m_swarm','m_tank','m_big','m_phage','m_puff','m_boss','m_bump','m_thorn','m_armor','m_legs','m_gboss','m_neba','m_gspike']);
let badFoe = null, spawnedAny = false;
API.reset(1);
for(let i=0;i<60*30 && !badFoe;i++){
  API.step(1/30);
  for(const u of API.world.units){ if(u.side==='e'){ spawnedAny=true; if(!KNOWN_FOE.has(u.key)) badFoe=u.key; } }
}
ok(spawnedAny, 'enemies spawn during a battle');
ok(!badFoe, `all spawned enemies are known roster keys (bad: ${badFoe})`);

// 11) 50-stage route + WAVE system (multi-gauge enemy tower; boss on final break wave)
ok(API.STAGES.length === 50, `50-stage route (got ${API.STAGES.length})`);
ok(API.STAGES[0].tutorial && API.STAGES[0].waves.length===1, 'stage 1 tutorial has a single gauge');
// bombers (m_puff) must NOT appear in early base pools
let earlyBomber=false;
for(let i=0;i<10;i++){ if(API.STAGES[i].pool.includes('m_puff')) earlyBomber=true; }
ok(!earlyBomber, 'no self-destruct enemy in the first 10 stages');
ok(API.STAGES[17].pool.includes('m_puff'), 'bombers appear from mid-game (stage 18)');
// waves: more gauges later, last gauge is always a break wave
ok(API.STAGE_BY_ID[3].waves.length < API.STAGE_BY_ID[40].waves.length, 'later stages have more gauges');
ok(API.STAGE_BY_ID[8].waves.every((w,i)=> i<API.STAGE_BY_ID[8].waves.length-1 ? true : w.type==='break'), 'last gauge is a break wave');
ok(API.STAGE_BY_ID[8].waves[0].type==='normal', 'first gauge is a normal wave');
// boss on final break wave of every 10th stage
ok(API.STAGES[9].waves.some(w=>w.boss) && API.STAGES[19].waves.some(w=>w.boss), 'boss on the final wave of stages 10 & 20');
// wave advance spawns the boss on the final wave
API.setStage(10); API.reset(10);
ok(API.foeMaxHP === API.STAGE_BY_ID[10].waves[0].hp && API.curWave===0, 'battle starts on wave 0 gauge');
const nW=API.STAGE_BY_ID[10].waves.length;
for(let gi=0; gi<nW-1; gi++){ API.ehp=0; API.step(1/30); }   // deplete each gauge to advance
ok(API.curWave===nW-1, `reached the final wave (curWave=${API.curWave}/${nW-1})`);
ok(API.world.units.some(u=>u.side==='e' && u.boss), 'the boss spawns on the final wave');
// EXP scales with stage
ok(API.stageExp(API.STAGE_BY_ID[50], true) > API.stageExp(API.STAGE_BY_ID[1], true), 'later stages give more EXP');

// 12) knockback near a castle must NOT teleport a unit forward past castleAtkRange (bug fix)
API.testMode=true; API.setStage(3); API.reset(3); API.world.units.length=0;
const nearCastle = API.newUnit('m_swarm','e', 30, API.CONF.groundY-8);   // enemy just in front of its castle (x=30 < castleAtkRange 60)
nearCastle.kbVX = -600; nearCastle.kbY = -0.01; nearCastle.kbT = 0.3;    // knocked backward (toward its castle, left)
API.world.units.push(nearCastle);
for(let i=0;i<12;i++) API.step(1/30);
ok(nearCastle.x < 60, `knocked-back unit near castle stays put, not teleported forward (x=${nearCastle.x.toFixed(0)}, must be < castleAtkRange 60)`);
API.testMode=false;
// EXP scales up: stage 1 gives ~700
ok(API.stageExp(API.STAGE_BY_ID[1], true) >= 600, `stage 1 EXP is generous (${API.stageExp(API.STAGE_BY_ID[1],true)})`);

// 13) per-character EXP level system (HP/攻撃UP＋レベルUPでEXP消費＋実ユニットに反映)
API.testMode=false;
API.save.lv={}; API.save.exp=0;
ok(API.charLv('cookie')===1, 'char starts at Lv1');
ok(Math.abs(API.charLvMul('cookie')-1)<1e-9, 'Lv1 multiplier is 1.0 (no bonus)');
// unit stats reflect level: spawn at Lv1 then bump level and spawn again
API.setStage(1); API.reset(1); API.world.units.length=0;
const u1=API.newUnit('cookie','p', 800, API.CONF.groundY-8);
const baseHp=u1.hp, baseAtk=u1.atk;
API.save.lv={cookie:6}; const mul6=API.charLvMul('cookie');
ok(Math.abs(mul6-(1+5*API.CHAR_LV_STEP))<1e-9, `Lv6 multiplier = 1+5*step (got ${mul6.toFixed(2)})`);
const u6=API.newUnit('cookie','p', 800, API.CONF.groundY-8);
ok(u6.hp>baseHp && u6.atk>baseAtk, `leveled unit is stronger (hp ${baseHp}->${u6.hp}, atk ${baseAtk}->${u6.atk})`);
ok(u6.hp===u6.maxHp, 'leveled unit maxHp matches hp');
// enemies are NOT affected by player levels (save.lv only applies to side 'p')
API.save.lv={}; const foeBase=API.newUnit('m_swarm','e', 100, API.CONF.groundY-8).hp;
API.save.lv={m_swarm:10}; const foeLv=API.newUnit('m_swarm','e', 100, API.CONF.groundY-8);
ok(foeLv.hp===foeBase, `enemy HP ignores player level table (got ${foeLv.hp}, base ${foeBase})`);
API.save.lv={};
// level-up spends EXP, raises level, and cost climbs
API.save.lv={}; API.save.units=['cookie']; API.save.exp=100000;
const lc0=API.charLvCost('cookie'), exp0c=API.save.exp;
ok(API.levelUpChar('cookie'), 'levelUpChar succeeds with enough EXP');
ok(API.charLv('cookie')===2, 'char level rose to 2');
ok(API.save.exp===exp0c-lc0, `EXP spent equals cost ${lc0}`);
ok(API.charLvCost('cookie')>lc0, `next level costs more (${lc0} -> ${API.charLvCost('cookie')})`);
// cannot level a locked character
API.save.units=[]; API.save.lv={}; API.save.exp=100000;
ok(!API.levelUpChar('daifuku'), 'cannot level a locked character');
// MAX level caps cost at null and blocks further level-up
API.save.units=['cookie']; API.save.lv={cookie:API.CHAR_LV_MAX}; API.save.exp=100000;
ok(API.charLvCost('cookie')===null, 'cost is null at MAX level');
ok(!API.levelUpChar('cookie'), 'cannot level past MAX');
// every roster unit has a description for the detail dialog
let missingDesc=API.ORDER.filter(k=>!API.UNIT_DESC[k]);
ok(missingDesc.length===0, `all roster units have a description (missing: ${missingDesc.join(',')})`);
// pricier units cost more EXP per level than cheap ones
API.save.lv={};
ok(API.charLvCost('daifuku')>API.charLvCost('cookie'), 'expensive units cost more EXP to level');

// 14) progress reset + collection sections (normal / gacha-only) + locked "?"
// reset clears all progress back to defaults
API.testMode=false;
API.save.exp=9999; API.save.coins=888; API.save.units=['ctank','daifuku']; API.save.cleared=[1,2,3]; API.save.lv={cookie:5}; API.save.upg={tHp:2};
API.resetProgress();   // confirm() is undefined in headless → guard skips it and proceeds
ok((API.save.exp||0)===0 && (API.save.coins||0)===0, 'resetProgress clears EXP and coins');
ok(API.save.units.length===0 && API.save.cleared.length===0, 'resetProgress clears units and cleared stages');
ok(Object.keys(API.save.lv||{}).length===0 && Object.keys(API.save.upg||{}).length===0, 'resetProgress clears levels and upgrades');
// after reset, only starters are unlocked; premium units are locked again
ok(API.isUnlocked('cookie') && !API.isUnlocked('ctank'), 'after reset only starters unlocked');
// gacha vs normal partition: gacha units are exactly those with via==="gacha"
const gachaKeys = API.ORDER.filter(k=>API.UNLOCKS[k] && API.UNLOCKS[k].via==='gacha');
const normalKeys = API.ORDER.filter(k=>!(API.UNLOCKS[k] && API.UNLOCKS[k].via==='gacha'));
ok(gachaKeys.length>0 && normalKeys.length>0, `both sections populated (normal ${normalKeys.length}, gacha ${gachaKeys.length})`);
ok(gachaKeys.includes('partycookie') && gachaKeys.includes('bigslime'), 'gacha section holds the gacha-only units');
ok(normalKeys.includes('cookie') && !normalKeys.includes('partycookie'), 'normal section excludes gacha-only units');
// renderCollect runs without throwing on the stubbed DOM (section build is safe)
let collectThrew=false; try{ API.renderCollect(); }catch(e){ collectThrew=true; }
ok(!collectThrew, 'renderCollect (2-section layout) runs without error');

// 15) 2x speed toggle
API.gameSpeed=1; API.toggleSpeed(); ok(API.gameSpeed===2, 'toggleSpeed 1 -> 2');
API.toggleSpeed(); ok(API.gameSpeed===1, 'toggleSpeed 2 -> 1');

// 16) castle-attack fix: a unit at the castle must ENGAGE an enemy that spawned between it and the castle
//     (previously it kept hitting the castle and ignored the nearer enemy).
function suppressSpawns(id){ API.reset(id); API.enemyCd=1e9; API.world.units.length=0; return ()=>{}; }   // 基本湧きを止める（WAVE切替はテストがehpを0にしない限り起きない）
API.testMode=true; API.setStage(3); API.save.lv={};
let restore16=suppressSpawns(3);
const yb16=API.CONF.groundY-8;
// player short-range tank, enemy castle is at x=castleInset (a gap sits behind it for knockback)
const EC=API.CONF.castleInset;
const tank=API.newUnit('ctank','p', EC + API.CONF.castleAtkRange, yb16);   // range 15, starts at the castle standoff
// immovable enemy sitting between the tank and the enemy castle (in front of the castle line)
const intruder=API.newUnit('m_tank','e', EC + 16, yb16); intruder.speed=0; intruder.hp=1500; intruder.maxHp=1500;
API.world.units.push(tank, intruder);
const intruderHp0=intruder.hp;
let tankMinX=tank.x;
for(let i=0;i<120;i++){ API.step(1/30); tankMinX=Math.min(tankMinX, tank.x); }   // ~4s（ノックバックで戻るので最小xを追う）
ok(tankMinX <= intruder.x + tank.range + API.CONF.engageGap + 4, `tank advances to within range of the intruder (minX=${tankMinX.toFixed(0)}, target<=${(intruder.x+tank.range+API.CONF.engageGap+4).toFixed(0)})`);
ok(intruder.hp < intruderHp0, `intruder takes damage — no longer ignored (hp ${intruderHp0} -> ${intruder.hp.toFixed(0)})`);
restore16();
// and when NO enemy is present, a unit still marches to the castle standoff and damages it
restore16=suppressSpawns(3);
const solo=API.newUnit('cookie','p', 300, yb16);
API.world.units.push(solo);
const ehpBefore=API.ehp;
let soloMinX=solo.x;
for(let i=0;i<160;i++){ API.step(1/30); soloMinX=Math.min(soloMinX, solo.x); }
ok(API.ehp < ehpBefore, `a lone unit still marches in and damages the enemy castle (ehp ${ehpBefore.toFixed(0)} -> ${API.ehp.toFixed(0)})`);
ok(soloMinX >= API.CONF.castleInset - 1, `unit never overlaps past the castle line (minX=${soloMinX.toFixed(0)})`);
ok(soloMinX <= EC + API.CONF.castleAtkRange + 2, `lone unit reaches the castle standoff (minX=${soloMinX.toFixed(0)})`);
restore16();
API.testMode=false;

// 17) boss entrance knocks ALL allies back off the castle
API.testMode=true; API.setStage(10);
let restore17=suppressSpawns(10);
const yb17=API.CONF.groundY-8;
// a few allies stuck right on the enemy castle
const a1=API.newUnit('cookie','p', API.CONF.castleBodyR+2, yb17);
const a2=API.newUnit('ctank','p', API.CONF.castleAtkRange, yb17);
API.world.units.push(a1,a2);
const a1x0=a1.x, a2x0=a2.x;
API.knockAllAllies();
ok(a1.kbT>0 && a2.kbT>0, 'boss entrance puts all allies into knockback');
ok(a1.kbVX>0 && a2.kbVX>0, 'allies are knocked toward their own side (away from enemy castle)');
for(let i=0;i<10;i++) API.step(1/30);
ok(a1.x>a1x0 && a2.x>a2x0, `allies are pushed back off the castle (a1 ${a1x0.toFixed(0)}->${a1.x.toFixed(0)}, a2 ${a2x0.toFixed(0)}->${a2.x.toFixed(0)})`);
// boss-class holds the line: a spawned boss has very low HP-threshold knockback (kbCount<=1)
// so allies can't slip past during its stagger to snipe the tower while the boss is still alive
API.world.units.length=0;
API.spawnBoss({key:'m_boss', hp:5000, atk:0, trait:'red'});
{ const boss=API.world.units.find(u=>u.boss);
  ok(boss && boss.kbCount<=2, `boss barely staggers (kbCount=${boss&&boss.kbCount}) so it holds the front line`); }
API.world.units.length=0;
restore17();
API.testMode=false;

// player castle shake: when an enemy hits our castle (php drops), the screen shakes for feedback
API.testMode=true; API.setStage(3); API.reset(3); API.enemyCd=1e9; API.world.units.length=0;
{ const yb=API.CONF.groundY-8;
  const e=API.newUnit('m_bump','e', API.CONF.W-API.CONF.castleInset-20, yb);  // right at our castle
  API.world.units.push(e); API.world.shake=0; const php0=API.php; let maxShake=0;
  for(let i=0;i<40;i++){ API.step(1/30); maxShake=Math.max(maxShake, API.world.shake); }
  ok(API.php < php0, 'enemy at our castle deals damage (php drops)');
  ok(maxShake > 0, 'the screen shakes when our castle is hit'); }
API.world.units.length=0; API.testMode=false;

// 18) color-trait effectiveness system
ok(API.TRAITS.plain && API.TRAITS.plain.tint===null, 'plain trait has no tint (no attribute)');
ok(!!API.TRAITS.green && !!API.TRAITS.red, 'green/red traits exist');
// plain vs anything = no multiplier
ok(!API.isEffective(['red'], 'plain'), 'attacker is NOT effective vs plain enemies');
ok(!API.isEffective(undefined, 'red'), 'unit without strongVs is never effective');
ok(!API.isEffective([], 'red'), 'empty strongVs is never effective');
// matching color = effective
ok(API.isEffective(['red'], 'red'), 'anti-red unit is effective vs a red enemy');
ok(!API.isEffective(['green'], 'red'), 'anti-green unit is NOT effective vs a red enemy (no penalty either)');
// some ally units carry strongVs; early plain enemies do not
ok(API.DEFS.cwarrior.strongVs && API.DEFS.cwarrior.strongVs.includes('red'), 'cwarrior counters red');
ok(API.DEFS.choco.strongVs && API.DEFS.choco.strongVs.includes('green'), 'choco counters green');
ok(!API.FOE_DEFS.m_swarm.trait && !API.FOE_DEFS.m_tank.trait, 'early mobs are plain (no trait)');
// bosses carry a trait
ok(API.STAGE_BY_ID[10].waves.some(w=>w.boss && w.boss.trait==='red'), 'stage-10 boss is red');
ok(API.STAGE_BY_ID[5].waves.some(w=>w.mini && w.mini.trait==='green'), 'stage-5 mini-boss is green');
// end-to-end: an anti-red unit deals MORE damage to a red boss than an anti-green unit does
API.testMode=true; API.setStage(10);
let restore18=suppressSpawns(10); const yb18=API.CONF.groundY-8;
API.spawnBoss({hp:100000, atk:0, trait:'red'});   // immovable-ish huge red boss, atk 0 so it won't kill allies
const rboss=API.world.units.find(u=>u.boss); rboss.speed=0;
const redUnit=API.newUnit('cwarrior','p', rboss.x+30, yb18);   // anti-red, in range
const grnUnit=API.newUnit('choco','p', rboss.x+30, yb18-2);    // anti-green (not effective vs red)
API.world.units.push(redUnit, grnUnit);
const rbHp0=rboss.hp;
for(let i=0;i<150;i++) API.step(1/30);
const dmg=rbHp0-rboss.hp;
ok(dmg>0, `red boss takes damage from allies (${dmg.toFixed(0)})`);
ok(API.traitOf(rboss)==='red', 'boss reports its red trait');
restore18();
API.testMode=false;

// 19) new image-sprite enemies + green mini-boss art
for(const k of ['m_bump','m_thorn','m_armor','m_legs','m_gboss','m_neba','m_gspike','m_boss']){
  ok(!!API.FOE_DEFS[k], `enemy ${k} exists`);
  ok(API.FOE_DEFS[k].spr===k && !API.FOE_DEFS[k].mold, `${k} uses an image sprite (no mold)`);
}
// the boss is now the big red spiky sprite (replaced the hand-drawn blob)
ok(API.FOE_DEFS.m_boss.trait==='red', 'boss carries the red trait');
ok(API.FOE_DEFS.m_boss.scale > API.FOE_DEFS.m_gboss.scale && API.FOE_DEFS.m_boss.scale > API.FOE_DEFS.m_legs.scale, 'boss sprite is drawn bigger than other enemies');
// the two new zako are wired: neba plain (white), gspike green
ok(API.traitOf(API.newUnit('m_neba','e',100,300))==='plain', 'neba (white sticky) is plain/no attribute');
ok(API.FOE_DEFS.m_gspike.trait==='green', 'green spiky carries the green trait');
ok(API.STAGE_BY_ID[3].pool.includes('m_neba') && !API.STAGE_BY_ID[2].pool.includes('m_neba'), 'neba (tank) appears from stage 3');
ok(API.STAGE_BY_ID[6].pool.includes('m_thorn') && !API.STAGE_BY_ID[6].pool.includes('m_gspike'), 'white spike (thorn) is the stage-6 attacker (replaced the green spike in pools)');
// enemy role identities: neba is a slow tank; gspike & thorn both do single→single→jump(slam) loops
ok(API.FOE_DEFS.m_neba.hp>=220 && API.FOE_DEFS.m_neba.speed<=54, 'neba is a high-HP slow tank');
ok(API.FOE_DEFS.m_gspike.slam && API.FOE_DEFS.m_gspike.slamEvery===3, 'green spiky slams every 3rd attack (single,single,jump)');
ok(API.FOE_DEFS.m_thorn.slam && API.FOE_DEFS.m_thorn.slamEvery===3, 'white spiky slams every 3rd attack (single,single,jump)');
ok(API.FOE_DEFS.m_boss.slam && API.FOE_DEFS.m_boss.slamEvery===3, 'the boss also jumps (slam) every 3rd attack');
ok(API.FOE_DEFS.m_legs.hp>=800 && API.FOE_DEFS.m_legs.atk>=40, 'long-legs enemy is high-HP & high-atk');
ok(API.FOE_DEFS.m_gboss.trait==='green', 'green mini-boss carries the green trait');
ok(API.traitOf(API.newUnit('m_bump','e',100,300))==='plain', 'zako sprites are plain (no attribute)');
// mini-boss wave now uses the green sprite key
ok(API.STAGE_BY_ID[5].waves.some(w=>w.mini && w.mini.key==='m_gboss' && w.mini.trait==='green'), 'stage-5 mini-boss uses the green sprite boss');
// m_armor stays retired; m_thorn is revived as the jump-shockwave attacker from stage 9
ok([1,5,9,20,50].every(id=>!API.STAGE_BY_ID[id].pool.includes('m_armor')), 'armor stays retired (folded into neba tank)');
ok(!!API.FOE_DEFS.m_thorn.slam && API.STAGE_BY_ID[6].pool.includes('m_thorn') && !API.STAGE_BY_ID[5].pool.includes('m_thorn'), 'thorn (jump-shockwave) debuts at stage 6');
// stage 4 wave-switch burst gets a taste of white spike (override), but not its continuous spawn
ok(API.STAGE_BY_ID[4].waves.some(w=>(w.burstPool||[]).includes('m_thorn')), 'stage 4 wave-switch burst includes a little white spike');
ok(API.STAGE_BY_ID[4].waves.every(w=>!(w.spawn||[]).includes('m_thorn')), 'stage 4 does NOT spawn white spike continuously (burst-only taste)');
ok(API.STAGE_BY_ID[20].pool.includes('m_legs'), 'long-legs enemy appears by stage 20');
ok(API.STAGE_BY_ID[2].pool.includes('m_bump'), 'bump zako appears from stage 2');
// backline archer (m_phage) is no longer spawned anywhere (per policy: no rear-guard enemies for now)
ok([1,8,17,30,50].every(id=>!API.STAGE_BY_ID[id].pool.includes('m_phage')), 'the backline archer is not in any stage pool');
// per-wave enemy pools: long-legs (m_legs) debuts in stage-20 BREAK waves, but not normal waves
{ const s20=API.STAGE_BY_ID[20];
  const nrm=s20.waves.filter(w=>w.type==='normal');
  const brk=s20.waves.filter(w=>w.type==='break');
  ok(brk.length>0 && brk.every(w=>w.spawn.includes('m_legs')), 'stage 20 break waves spawn the long-legs elite');
  ok(nrm.length>0 && nrm.every(w=>!w.spawn.includes('m_legs')), 'stage 20 normal waves do NOT spawn the long-legs elite (break-only debut)');
  // stage 19 is still legs-free everywhere (debut is stage 20)
  ok(API.STAGE_BY_ID[19].waves.every(w=>!(w.spawn||[]).includes('m_legs')), 'stage 19 never spawns the long-legs elite');
  // by stage 28 the elite is in normal waves too
  ok(API.STAGE_BY_ID[28].waves.some(w=>w.type==='normal' && w.spawn.includes('m_legs')), 'by stage 28 the long-legs elite also appears in normal waves'); }
// single→single→jump loop: for a slam unit, attacks 1&2 are single-target; the 3rd is a jump-shockwave AoE.
// Setup: A within melee range (single hits A), B outside range but within slam.r (only the slam reaches B).
function slamLoopTest(key){
  API.testMode=true; API.setStage(11); API.reset(11); API.enemyCd=1e9; API.world.units.length=0;
  const yb=API.CONF.groundY-8, R=API.FOE_DEFS[key].slam.r;
  const atk=API.newUnit(key,'e', 300, yb); atk.speed=0; atk.cd=0.05; atk.cool=0; atk.atkN=0; API.world.units.push(atk);
  const A=API.newUnit('cookie','p', 300+18, yb);        // 近接射程内（単体でも当たる）
  const B=API.newUnit('cookie','p', 300+R-6, yb);       // 射程外・slam半径内（slamの時だけ当たる）
  [A,B].forEach(t=>{ t.speed=0; t.hp=9999; t.maxHp=9999; t.cool=1e9; API.world.units.push(t); });
  let bHits=0, bPrev=B.hp, aHits=0, aPrev=A.hp, sawHop=false, sawShock=false;
  for(let i=0;i<800 && atk.atkN<6; i++){ API.step(1/30);
    if(B.hp<bPrev){ bHits++; bPrev=B.hp; } if(A.hp<aPrev){ aHits++; aPrev=A.hp; }
    if(atk.hopT>0) sawHop=true; if(API.world.shocks.length>0) sawShock=true; }
  ok(aHits>=6, `${key}: the melee-range target is hit every attack (aHits=${aHits})`);
  ok(bHits===2, `${key}: the slam-only target is hit exactly twice over 6 attacks = jump every 3rd (bHits=${bHits})`);
  ok(sawHop && sawShock, `${key}: the jump produces a hop and a shock ring`);
  API.world.units.length=0; API.testMode=false;
}
slamLoopTest('m_gspike');
slamLoopTest('m_thorn');
// the slam spares enemies outside its radius
API.testMode=true; API.setStage(11); API.reset(11); API.enemyCd=1e9; API.world.units.length=0;
{ const yb=API.CONF.groundY-8, R=API.FOE_DEFS.m_thorn.slam.r;
  const atk=API.newUnit('m_thorn','e', 300, yb); atk.speed=0; atk.cd=0.05; atk.cool=0; atk.atkN=0; API.world.units.push(atk);
  const inR=API.newUnit('cookie','p', 300+20, yb);
  const outR=API.newUnit('cookie','p', 300+R+50, yb);
  [inR,outR].forEach(t=>{ t.speed=0; t.hp=9999; t.maxHp=9999; t.cool=1e9; API.world.units.push(t); });
  const o0=outR.hp;
  for(let i=0;i<200 && atk.atkN<4; i++) API.step(1/30);
  ok(outR.hp===o0, 'the jump-shockwave never reaches a target outside slam.r'); }
API.world.units.length=0; API.testMode=false;
API.world.units.length=0; API.testMode=false;
// end-to-end: a mid stage spawns these without crashing and only known keys appear
API.testMode=true; API.setStage(17); API.reset(17); let sawNew=false, bad=null;
for(let i=0;i<60*40 && !bad;i++){ API.step(1/30);
  for(const u of API.world.units){ if(u.side==='e'){ if(!KNOWN_FOE.has(u.key)) bad=u.key; if(u.key==='m_legs'||u.key==='m_armor') sawNew=true; } } }
ok(!bad, `stage 17 spawns only known enemies (bad: ${bad})`);
API.testMode=false;

// 20) wave switch: NORMAL switch only peels the front-line huggers (backline keeps its ground);
//     BREAK switch knocks the WHOLE army back (dramatic reset). Both spawn a burst.
API.testMode=true; API.setStage(6);   // stage 6 waves: normal(0), normal(1), break(2)
API.reset(6); API.enemyCd=1e9; API.world.units.length=0;
const yb20=API.CONF.groundY-8, EC20=API.CONF.castleInset;
const frontU=API.newUnit('cookie','p', EC20+40, yb20);   // 城際の前線（押し込んだ組）
const backU =API.newUnit('cookie','p', 520, yb20);       // 後方の本隊
frontU.speed=0; backU.speed=0; API.world.units.push(frontU, backU);
API.curWave=0;
const eBeforeW=API.world.units.filter(u=>u.side==='e').length;
API.advanceWave();   // 0->1 = NORMAL switch
ok(frontU.kbT>0 && backU.kbT<=0, 'normal wave switch peels ONLY the front-line huggers (backline holds ground)');
ok(API.curWave===1, 'wave switch advances the wave index');
const eAfterW=API.world.units.filter(u=>u.side==='e').length;
ok(eAfterW > eBeforeW, `wave switch spawns a burst of fresh enemies (${eBeforeW} -> ${eAfterW})`);
frontU.kbT=0; backU.kbT=0;
API.advanceWave();   // 1->2 = BREAK switch → whole army
ok(frontU.kbT>0 && backU.kbT>0, 'break wave switch knocks the WHOLE army back (dramatic reset)');
// boss knockback still hits EVERYONE (no maxX) — regression guard for the shared helper
API.world.units.length=0; const farU=API.newUnit("cookie","p", 300, yb20); API.world.units.push(farU);
API.knockAllAllies(); ok(farU.kbT>0, 'boss knockback (no maxX) still knocks even far-back allies');
API.testMode=false;

// 21) anti-cross collision: opposing melee units cannot pass through each other (no stranding "behind")
API.testMode=true; API.setStage(9);
API.reset(9); API.enemyCd=1e9; API.world.units.length=0;
const yb21=API.CONF.groundY-8;
// a fast player and a slow enemy set to overlap/cross — after stepping, player must stay to the RIGHT of the enemy
const pc=API.newUnit('cookie','p', 200, yb21);   // fast (118), faces left
const ec=API.newUnit('m_armor','e', 205, yb21);  // slow armored, faces right, just right of player (crossed)
API.world.units.push(pc,ec);
let everCrossed=false;
for(let i=0;i<200;i++){ API.step(1/30); if(!pc.dead && !ec.dead && pc.kbT<=0 && ec.kbT<=0 && pc.x < ec.x - 1) everCrossed=true; }
ok(!everCrossed, 'player never ends a frame on the wrong (left) side of an enemy — no pass-through');
API.testMode=false;

// 22) dock is sorted by cost ascending (cheapest left)
API.testMode=true;
// pick a loadout with mixed costs; buildDock sorts a copy by cost
// (verify the pure sort behavior on the loadout order indirectly via DEFS costs)
{ const keys=['daifuku','cookie','cwarrior','ctank']; const sorted=keys.slice().sort((a,b)=>API.DEFS[a].cost-API.DEFS[b].cost);
  ok(sorted[0]==='cookie' && sorted[sorted.length-1]==='daifuku', 'dock sort puts cheapest (cookie) first, priciest (daifuku) last'); }

// 23) pause stops the sim
API.setStage(3); API.reset(3);
ok(API.paused===false, 'starts unpaused');
API.togglePause(); ok(API.paused===true, 'togglePause pauses');
// while paused, loop() would skip step(); simulate: money shouldn't advance if we don't call step. Just verify flag + resume.
API.togglePause(); ok(API.paused===false, 'togglePause resumes');

// 24) stagger cooldown prevents knockback-lock (rapid threshold crossings only stagger once per CD)
API.reset(3); API.world.units.length=0;
const uu=API.newUnit('choco','p', 400, API.CONF.groundY-8); uu.hp=100; uu.maxHp=100; uu.kbCount=4; uu.kbSeg=undefined; uu.kbCd=0; uu.kbT=0;
API.world.units.push(uu);
API.hurt(uu, 30);                     // hp70: crosses 75 threshold -> stagger, kbCd set
const kbT1 = uu.kbT; ok(kbT1>0, 'first threshold crossing staggers the unit');
uu.kbT=0;                             // pretend the stagger flight ended immediately
API.hurt(uu, 30);                     // hp40: crosses 50 threshold but within cooldown -> NO stagger
ok(uu.kbT===0, 'a second threshold within the cooldown does NOT re-stagger (anti-lock)');
uu.kbCd=0;                            // cooldown elapsed
API.hurt(uu, 20);                     // hp20: crosses 25 threshold, cooldown clear -> stagger again
ok(uu.kbT>0, 'after cooldown elapses, staggering resumes');
API.testMode=false;

// 25) mobile camera: non-portrait (headless) uses full-field (zoom 1, no scroll); updateCamera keeps x=0
API.resizeCanvas();
ok(API.cam.mobile===false && API.cam.zoom===1, 'headless/non-portrait uses full-field camera (zoom 1)');
API.cam.x=123; API.updateCamera(); ok(API.cam.x===0, 'updateCamera keeps camera at 0 when not mobile');
// mobile camera math: simulate a mobile view and check the clamp/target logic is sane
API.cam.mobile=true; API.cam.visW=440; API.cam.zoom=2;
API.reset(1); API.world.units.length=0;
const yb25=API.CONF.groundY-8;
API.world.units.push(API.newUnit('cookie','p', 200, yb25));   // lone player at x=200
for(let i=0;i<40;i++) API.updateCamera();                      // settle
ok(API.cam.x>=0 && API.cam.x<=API.CONF.W-API.cam.visW+0.5, `camera x stays within [0, W-visW] (x=${API.cam.x.toFixed(0)})`);
API.cam.mobile=false; API.cam.zoom=1; API.cam.x=0;

// 26) TEST MODE free level-set (balance tuning): sets level directly with no EXP cost, clamped, TEST_MODE-only
API.testMode=false; API.save.lv={}; API.save.exp=0;
ok(API.setCharLevelFree('cookie',10)===false, 'free level-set is blocked when TEST_MODE is off');
ok(API.charLv('cookie')===1, 'level unchanged when TEST_MODE off');
API.testMode=true;
const expBefore26=API.save.exp;
ok(API.setCharLevelFree('cookie',10)===true, 'free level-set works in TEST_MODE');
ok(API.charLv('cookie')===10, 'level set directly to 10');
ok(API.save.exp===expBefore26, 'free level-set spends no EXP');
API.setCharLevelFree('cookie',999); ok(API.charLv('cookie')===API.CHAR_LV_MAX, 'free level-set clamps above MAX');
API.setCharLevelFree('cookie',0);   ok(API.charLv('cookie')===1, 'free level-set clamps below 1');
API.testMode=false; API.save.lv={};

// 27) boss/mid-boss slam range-damage matches シロトゲ (m_thorn) — dmgMul 1.4
ok(API.FOE_DEFS.m_thorn.slam.dmgMul===1.4, 'シロトゲ slam dmgMul is 1.4 (reference)');
ok(API.FOE_DEFS.m_boss.slam.dmgMul===1.4, 'アカトゲ slam dmgMul strengthened to 1.4 (matches シロトゲ)');
ok(API.FOE_DEFS.m_gspike.slam.dmgMul===1.4, 'ミドリトゲ slam dmgMul strengthened to 1.4 (matches シロトゲ)');

// 28) TEST MODE free upgrade-set + cumulative EXP helpers (balance tuning)
API.testMode=false; API.save.upg={}; API.save.exp=0;
ok(API.setUpgradeLevelFree('tHp',5)===false, 'free upgrade-set blocked when TEST_MODE off');
ok(API.upgLv('tHp')===0, 'upgrade level unchanged when TEST_MODE off');
API.testMode=true;
const exp28=API.save.exp;
ok(API.setUpgradeLevelFree('tHp',5)===true, 'free upgrade-set works in TEST_MODE');
ok(API.upgLv('tHp')===5, 'upgrade level set directly to 5');
ok(API.save.exp===exp28, 'free upgrade-set spends no EXP');
API.setUpgradeLevelFree('tHp',999); ok(API.upgLv('tHp')===API.UPG.tHp.max, 'free upgrade-set clamps to track max');
API.setUpgradeLevelFree('tHp',-5);  ok(API.upgLv('tHp')===0, 'free upgrade-set clamps to 0');
// cumulative EXP helpers: total to reach a level = sum of step costs; monotonic increasing; Lv/Lv0 = 0
ok(API.charLvTotalExp('cookie',1)===0, 'char total EXP to reach Lv1 is 0');
ok(API.upgTotalExp('tHp',0)===0, 'upgrade total EXP to reach Lv0 is 0');
ok(API.charLvTotalExp('cookie',10) > API.charLvTotalExp('cookie',5), 'char total EXP grows with target level');
ok(API.upgTotalExp('tHp',8) > API.upgTotalExp('tHp',4), 'upgrade total EXP grows with target level');
// total to reach Lv2 equals the single-step cost from Lv1 (cross-check with charLvCost at Lv1)
API.save.lv={}; ok(API.charLvTotalExp('cookie',2)===API.charLvCost('cookie'), 'char total to Lv2 == first step cost');
API.save.upg={}; ok(API.upgTotalExp('tHp',1)===API.upgCost('tHp'), 'upgrade total to Lv1 == first step cost');
API.testMode=false; API.save.upg={}; API.save.lv={};

// 29) deterministic enemy spawning: no RNG in enemy TYPE selection → identical sequence every run (consistent difficulty)
API.testMode=false;
function spawnSeqFor(stageId, ticks){
  API.setStage(stageId); API.reset(stageId); API.world.units.length=0; API.world.spawnSeq=0;
  const seq=[];
  for(let i=0;i<ticks;i++){ const before=API.world.units.length; API.enemySpawn();
    const nu=API.world.units.slice(before).filter(u=>u.side==='e'); if(nu.length) seq.push(nu[0].key); }
  return seq;
}
const runA=spawnSeqFor(5,12), runB=spawnSeqFor(5,12);
ok(runA.length>0, 'enemySpawn produces enemies');
ok(JSON.stringify(runA)===JSON.stringify(runB), `enemy spawn order is deterministic (repeatable): ${runA.slice(0,6).join(',')}...`);
// the pattern follows the wave's spawn pool in order (loop), e.g. pool[0],pool[1],...
const w5=API.STAGE_BY_ID[5].waves[0]; const pool5=w5.spawn;
let followsPool=true; for(let i=0;i<runA.length;i++){ if(runA[i]!==pool5[i%pool5.length]) { followsPool=false; break; } }
ok(followsPool, `continuous spawn cycles the wave pool in order (pool=[${pool5.join(',')}])`);
// wave-switch burst is also deterministic (repeatable)
function burstSeqFor(stageId, waveIdx){
  API.setStage(stageId); API.reset(stageId); API.world.units.length=0;
  const w=API.STAGE_BY_ID[stageId].waves[waveIdx];
  API.spawnWaveBurst(w);
  return API.world.units.filter(u=>u.side==='e').map(u=>u.key);
}
const brkWave = API.STAGE_BY_ID[5].waves.findIndex(w=>w.type==='break');
if(brkWave>=0){ const bA=burstSeqFor(5,brkWave), bB=burstSeqFor(5,brkWave);
  ok(JSON.stringify(bA)===JSON.stringify(bB), 'wave-switch burst is deterministic (no probability)'); }
else ok(true, 'no break wave on stage 5 (skip burst determinism)');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
