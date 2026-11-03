const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {switchRelease}=require('./release-control.cjs');
(async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'kagopita-release-'));
 const nginxFile=path.join(directory,'nginx.conf'),link=path.join(directory,'enabled'),configPath=path.join(directory,'release.json'),envFile=path.join(directory,'env');
 fs.writeFileSync(envFile,'PUBLIC_URL=https://example.test\n');fs.writeFileSync(nginxFile,'location / { proxy_pass http://127.0.0.1:3000; }');fs.symlinkSync(nginxFile,link);
 const initial={active:'blue',previous:null,nginxFile:link,envFile,dataDirectory:directory,slots:{blue:{name:'app-blue',port:3000,directory,version:'one'},green:{name:'app-green',port:3002,directory,version:'two'}}};
 const commands=[];let failNginx=false;
 const run=(cmd,args)=>{commands.push([cmd,...args]);if(cmd==='pm2'&&args[0]==='jlist')return '[]';if(cmd==='nginx'&&failNginx)throw Error('fixture invalid config');return '';};
 try{
  fs.writeFileSync(configPath,JSON.stringify(initial));
  await switchRelease(configPath,'green',{run,request:async()=>({ok:true})});
  assert.match(fs.readFileSync(nginxFile,'utf8'),/:3002/);assert.equal(JSON.parse(fs.readFileSync(configPath)).previous,'blue');assert.ok(fs.lstatSync(link).isSymbolicLink(),'Existing Nginx symlink preserved');
  await switchRelease(configPath,'blue',{run,request:async()=>({ok:true})});assert.match(fs.readFileSync(nginxFile,'utf8'),/:3000/);
  failNginx=true;await assert.rejects(switchRelease(configPath,'green',{run,request:async()=>({ok:true})}),/previous routing was restored/);
  assert.match(fs.readFileSync(nginxFile,'utf8'),/:3000/);assert.equal(JSON.parse(fs.readFileSync(configPath)).active,'blue');
  assert.ok(commands.some(c=>c.join(' ')==='pm2 stop app-blue'));assert.ok(commands.some(c=>c.join(' ')==='pm2 stop app-green'));
  console.log('PASS: candidate health-gated blue/green switch; rollback; original proxy restored on Nginx failure; slot state preserved; symlink and worker stop behavior.');
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
