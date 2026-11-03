require('dotenv').config({quiet:true});
const nodemailer=require('nodemailer');
async function check(url) {
  try {
    const response=await fetch(new URL('/healthz',url),{signal:AbortSignal.timeout(8000),redirect:'error'});
    const data=await response.json();return {healthy:response.ok&&data.status==='ok',status:response.status};
  }catch{return {healthy:false,status:0};}
}
async function notify() {
  const recipient=process.env.KAGOPITA_ADMIN_EMAIL;
  if(!recipient||!process.env.KAGOPITA_ADMIN_USER_ID)throw Error('Owner alert destination is not configured.');
  if(!process.env.SMTP_USER||!process.env.SMTP_PASS)throw Error('Alert email transport is not configured.');
  const port=Number(process.env.SMTP_PORT||465);
  const transporter=nodemailer.createTransport({host:process.env.SMTP_HOST||'smtp.gmail.com',port,
    secure:process.env.SMTP_SECURE?process.env.SMTP_SECURE==='true':port===465,
    auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS.replace(/\s/g,'')},
    connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000});
  try{await transporter.sendMail({from:process.env.SMTP_FROM||process.env.SMTP_USER,to:recipient,
    subject:'カゴピタ：独立監視が重大な障害を検出',
    text:'独立した監視で、カゴピタの稼働状況を連続して確認できませんでした。管理画面とサーバーの状態を確認してください。\n'+new Date().toISOString()});}
  finally{transporter.close();}
}
function decide(previous,healthy,now=Date.now()) {
  const state={failures:healthy?0:Math.min(1000,(Number(previous?.failures)||0)+1),alertedAt:Number(previous?.alertedAt)||0,down:Boolean(previous?.down)};
  if(healthy&&state.down){state.down=false;state.alertedAt=0;return {fire:true,state,message:'RECOVERED: Kagopita health checks are healthy again. Announce recovery only; do not send a critical email.'};}
  if(!healthy&&state.failures>=2&&(!state.down||now-state.alertedAt>=3600000)){
    state.down=true;state.alertedAt=now;
    return {fire:true,state,message:'CRITICAL: Kagopita failed two consecutive independent health checks. Recheck the site, then send the configured owner alert and report the outage. Never include secrets or user records.'};
  }
  return {fire:false,state};
}
if(require.main===module)(async()=>{
  if(process.argv.includes('--notify')){await notify();console.log(JSON.stringify({notified:true}));}
  else {
    const health=await check(process.env.KAGOPITA_MONITOR_URL||process.env.PUBLIC_URL||'https://kagopita.com');
    if(process.argv.includes('--watch'))console.log(JSON.stringify(decide(JSON.parse(process.env.KAGOPITA_WATCH_STATE||'{}'),health.healthy)));
    else console.log(JSON.stringify(health));
  }
})().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={check,notify,decide};
