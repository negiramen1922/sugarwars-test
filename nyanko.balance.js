// Headless balance simulator for the 50-stage route. Profiles scale with stage.
const { chromium } = require(require('path').join(process.env.NODE_PATH, 'playwright'));
(async()=>{
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  const p = await b.newPage();
  await p.goto('file://'+require('path').join(__dirname,'nyanko.html'));
  await p.waitForTimeout(500);

  const results = await p.evaluate(() => {
    // profile(n): a plausible deck + meta upgrades for a player who has reached stage n
    const PRIORITY = ['cookie','ctank','choco','clance','cwarrior','daifuku','shoe','icewiz','donut','macaron','slime'];
    function profile(n){
      // stage n is played with units unlocked by CLEARING prior stages (need <= n-1)
      const cleared = n-1;
      const avail = PRIORITY.filter(k => k==='cookie' || (UNLOCKS[k] && UNLOCKS[k].via==='coin' && (UNLOCKS[k].need||0) <= cleared));
      const deck = avail.slice(0, 6);
      // modest early upgrades (EXP is also spent unlocking the 4 units)
      const upg = { wStart:Math.min(3,Math.floor(n/3)), wMax:Math.min(2,Math.floor(n/5)),
                    tHp:Math.min(2,Math.floor(n/4)), tPow:Math.min(2,Math.floor(n/4)), tRng:Math.min(1,Math.floor(n/8)) };
      return {deck, upg};
    }
    function sim(stageId, deck, upg, maxT){
      curStage = STAGE_BY_ID[stageId];
      save.upg = Object.assign({}, upg);
      TEST_MODE = false;
      reset(); running = true;
      const dt=1/30; let t=0;
      const cheap = deck.slice().sort((a,b)=>DEFS[a].cost-DEFS[b].cost);
      const c0 = cheap[0];
      while(t < maxT){
        if(towerCd <= 0) castTower();
        // 前線は常に維持：出せるユニットは安い順に出す
        for(const k of cheap){ if(cd[k]<=0 && money>=DEFS[k].cost) deploy(k); }
        // 余ったお金（一番安いユニットも買えない端数 or 上限張り付き）は財布UPに回す
        if(walletLv<walletMaxLv() && money>=walletCost() && (money < DEFS[c0].cost || money>=effCap()-1)) upgradeWallet();
        step(dt); t+=dt;
        if(ehp<=0) return {win:true,  t:+t.toFixed(0), php:+(php/myMaxHP).toFixed(2)};
        if(php<=0) return {win:false, t:+t.toFixed(0), ehp:+(ehp/foeMaxHP).toFixed(2)};
      }
      return {win:false, timeout:true, t:+t.toFixed(0), ehp:+(ehp/foeMaxHP).toFixed(2)};
    }
    function runs(stageId, n, times){
      const {deck,upg}=profile(n); const rs=[];
      for(let i=0;i<times;i++) rs.push(sim(stageId, deck, upg, 150));
      const wins=rs.filter(r=>r.win).length;
      const avgT=Math.round(rs.reduce((s,r)=>s+r.t,0)/rs.length);
      const lossEhp=rs.filter(r=>!r.win).map(r=>r.ehp);
      return {stage:stageId, prof:'n'+n, deck:deck.join('/'), win:wins+'/'+times, avgT, lossEhp:lossEhp.join(',')};
    }
    const milestones=[1,2,3,4,5,6,7,8,9,10];
    const out={};
    for(const s of milestones) out['S'+s]=runs(s, s, 4);
    return out;
  });
  for(const [k,v] of Object.entries(results)) console.log(k.padEnd(20), JSON.stringify(v));
  await b.close();
})();
