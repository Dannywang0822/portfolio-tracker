const s=require('fs').readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const grab=n=>s.match(new RegExp('function '+n+'\\([\\s\\S]*?\\n    }'))[0];
let lastFx={hkd:7.8,cny:7.2};
function fxRateFor(c){return c==='HKD'?lastFx.hkd:c==='CNY'?lastFx.cny:null}
eval(grab('toUsd')+grab('fromUsd'));
const H=[{c:'CNY',cost:72000,mv:79200},{c:'HKD',cost:78000,mv:70200},{c:'USD',cost:10000,mv:12000}];
let cu=0,mu=0;for(const h of H){cu+=toUsd(h.cost,h.c);mu+=toUsd(h.mv,h.c)}
const exp={cu:30000,mu:32000};console.log('USD',cu,mu,'HKD',fromUsd(cu,'HKD'),fromUsd(mu,'HKD'),'CNY',fromUsd(cu,'CNY'),fromUsd(mu,'CNY'));
const ok=Math.abs(cu-30000)<1e-6&&Math.abs(mu-32000)<1e-6&&Math.abs(fromUsd(cu,'HKD')-234000)<1e-6&&Math.abs(fromUsd(mu,'CNY')-230400)<1e-6;
// cross check HKD->CNY via USD
console.log('78000HKD->CNY',fromUsd(toUsd(78000,'HKD'),'CNY'));console.log(ok?'PASS':'FAIL');
// tri-currency P&L: pnl = sum(toUsd(mv)) - sum(toUsd(cost)) => 2000 USD
const pnlU=mu-cu;const pH=fromUsd(pnlU,'HKD'),pC=fromUsd(pnlU,'CNY');
console.log('PNL',pnlU,pH,pC,'pct',pnlU/cu*100);
const ok2=Math.abs(pnlU-2000)<1e-6&&Math.abs(pH-15600)<1e-6&&Math.abs(pC-14400)<1e-6&&Math.abs(pnlU/cu*100-6.6666667)<1e-5;
// negative P&L case
const L=[{c:'HKD',cost:78000,mv:70200}];const lu=toUsd(70200,'HKD')-toUsd(78000,'HKD');
const ok3=Math.abs(lu+1000)<1e-6&&Math.abs(fromUsd(lu,'CNY')+7200)<1e-6;
// color convention: up=red, down=green
const ok4=/\.up \{ color: var\(--red\)/.test(s)&&/\.down \{ color: var\(--green\)/.test(s);
console.log(ok2&&ok3&&ok4?'PNL PASS':'PNL FAIL');if(!(ok&&ok2&&ok3&&ok4))process.exit(1);
