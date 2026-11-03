const fs=require('node:fs');
const {execFileSync}=require('node:child_process');
const path=require('node:path');
const dotenv=require('dotenv');
async function switchRelease(configPath,target,{run=execFileSync,request=fetch}={}) {
  const config=JSON.parse(fs.readFileSync(configPath,'utf8'));
  const previous=config.active,slot=config.slots[target];
  if(!slot||target===previous)throw Error('Choose a different configured release slot.');
  if(!Number.isSafeInteger(slot.port)||slot.port<1024||slot.port>65535||!/^[a-z0-9-]+$/.test(slot.name))throw Error('Invalid release slot.');
  if(slot.port===config.slots[previous].port||slot.name===config.slots[previous].name)throw Error('Release slots must use separate processes and ports.');
  const nginxPath=fs.realpathSync(config.nginxFile);
  const original=fs.readFileSync(nginxPath,'utf8'),needle=`proxy_pass http://127.0.0.1:${config.slots[previous].port};`;
  if(original.split(needle).length!==2)throw Error('The configured Nginx upstream no longer matches the active release.');
  const environment={...process.env,...dotenv.parse(fs.readFileSync(config.envFile)),...config.environment,
    PORT:String(slot.port),BIND_HOST:'127.0.0.1',KAGOPITA_DATA_DIR:config.dataDirectory};
  const processes=JSON.parse(run('pm2',['jlist'],{encoding:'utf8'}));
  const known=processes.find(p=>p.name===slot.name);
  if(known)run('pm2',['restart',slot.name,'--update-env'],{env:environment,stdio:'pipe'});
  else run('pm2',['start',path.join(slot.directory,'server.js'),'--name',slot.name,'--cwd',slot.directory],{env:environment,stdio:'pipe'});
  let healthy=false;
  for(let i=0;i<20;i++) {
    try{const r=await request(`http://127.0.0.1:${slot.port}${slot.healthPath||'/healthz'}`,{signal:AbortSignal.timeout(1500)});if(r.ok){healthy=true;break;}}catch{}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  if(!healthy){run('pm2',['stop',slot.name],{stdio:'pipe'});throw Error('Candidate health check failed; traffic was not changed.');}
  const write=text=>{const temporary=nginxPath+'.kagopita-tmp';fs.writeFileSync(temporary,text,{mode:fs.statSync(nginxPath).mode&0o777});fs.renameSync(temporary,nginxPath);};
  try {
    write(original.replace(needle,`proxy_pass http://127.0.0.1:${slot.port};`));
    run('nginx',['-t'],{stdio:'pipe'});run('systemctl',['reload','nginx'],{stdio:'pipe'});
  }catch(error){
    write(original);
    try{run('nginx',['-t'],{stdio:'pipe'});run('systemctl',['reload','nginx'],{stdio:'pipe'});}catch{}
    run('pm2',['stop',slot.name],{stdio:'pipe'});
    throw Error('Upstream validation/reload failed; previous routing was restored.');
  }
  config.active=target;config.previous=previous;config.updatedAt=new Date().toISOString();
  fs.writeFileSync(configPath+'.tmp',JSON.stringify(config,null,2),{mode:0o600});fs.renameSync(configPath+'.tmp',configPath);
  run('pm2',['stop',config.slots[previous].name],{stdio:'pipe'});run('pm2',['save'],{stdio:'pipe'});
  return {active:target,previous,version:slot.version};
}
if(require.main===module)(async()=>{
  const configPath=process.env.KAGOPITA_RELEASE_CONFIG;
  if(!configPath)throw Error('KAGOPITA_RELEASE_CONFIG is required.');
  const config=JSON.parse(fs.readFileSync(configPath,'utf8'));
  const target=process.argv[2]==='rollback'?config.previous:process.argv[2];
  console.log(JSON.stringify(await switchRelease(configPath,target)));
})().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={switchRelease};
