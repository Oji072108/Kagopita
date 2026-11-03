const assert=require('node:assert/strict');
const {decide,check}=require('./admin-watchdog.cjs');
(async()=>{
 let result=decide({},false,1000);assert.equal(result.fire,false);result=decide(result.state,false,2000);assert.equal(result.fire,true);assert.match(result.message,/CRITICAL/);
 result=decide(result.state,false,3000);assert.equal(result.fire,false);
 result=decide(result.state,false,3603000);assert.equal(result.fire,true,'Hourly outage reminders are bounded');
 result=decide(result.state,true,3604000);assert.equal(result.fire,true);assert.match(result.message,/RECOVERED/);
 result=decide(result.state,true,3605000);assert.equal(result.fire,false,'Healthy checks stay silent');
 assert.equal((await check('http://127.0.0.1:1')).healthy,false,'Unavailable process is unhealthy');
 console.log('PASS: independent unavailable-process detection; two-failure threshold; outage deduplication/hourly reminder; one recovery notification; healthy silence.');
})().catch(error=>{console.error(error);process.exitCode=1;});
