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
