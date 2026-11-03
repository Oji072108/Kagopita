(() => {
  const $=id=>document.getElementById(id);let stream,expiresAt=0,expiryTimer;
  const text=(id,value)=>{$(id).textContent=value;};
  const date=value=>new Date(value).toLocaleString('ja-JP');
  const bytes=value=>value===null?'確認できません':`${(value/1024/1024).toFixed(0)} MB`;
  function lock(message='管理セッションの有効期限が切れました。再認証してください。') {
    stream?.close();clearTimeout(expiryTimer);$('login').hidden=false;$('dashboard').hidden=true;$('logout').hidden=true;text('message',message);
  }
  async function api(url,options={}) {
    const response=await fetch(url,{...options,headers:{'Content-Type':'application/json','X-Admin-Request':'1',...options.headers},cache:'no-store',signal:AbortSignal.timeout(20000)});
    const data=await response.json().catch(()=>({}));
    if(!response.ok){if(response.status===401||response.status===403)lock(data.error);throw Error(data.error||`通信エラー (${response.status})`);}
    return data;
  }
  function rows(id,entries){$(id).replaceChildren(...entries.map(([label,value])=>{const div=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;div.append(dt,dd);return div;}));}
  function render(data) {
    if(data.expiresAt&&data.expiresAt!==expiresAt){expiresAt=data.expiresAt;clearTimeout(expiryTimer);expiryTimer=setTimeout(()=>lock(),Math.max(0,expiresAt-Date.now()));}
    $('login').hidden=true;$('dashboard').hidden=false;$('logout').hidden=false;
    const h=data.health;text('health',h.status==='ok'?'正常':'重大な問題');text('uptime',`${Math.floor(h.uptimeSeconds/3600)}h ${Math.floor(h.uptimeSeconds%3600/60)}m`);
    text('requests',data.totals.requests.toLocaleString());text('errors',data.totals.errors.toLocaleString());text('updated','最終更新 '+date(h.checkedAt));
    rows('resources',[['データベース',h.database==='ok'?'正常':'応答なし'],['ディスク空き容量',bytes(h.diskFree)],['プロセスメモリ',bytes(h.rss)],['ヒープ使用量',bytes(h.heapUsed)],['イベントループ P99',h.eventLoopP99Ms+' ms'],['管理アクセス拒否',data.totals.adminDenied||0]]);
    rows('delivery',[['メール',data.alerts.emailConfigured?'設定済み':'未設定'],['プッシュ配信',data.alerts.pushConfigured?'利用可能':'未設定'],['管理セッション','15分で失効']]);
    rows('release',data.release?[['稼働スロット',data.release.active],['バージョン',String(data.release.version).slice(0,12)],['戻せるスロット',data.release.previous||'なし']]:[['リリース管理','未設定']]);
    text('incidentCount',`${data.incidents.filter(i=>!i.resolvedAt).length}件の未解決`);
    $('incidents').replaceChildren(...data.incidents.map(incident=>{
      const div=document.createElement('article');div.className='incident'+(incident.resolvedAt?' resolved':'');
      const title=document.createElement('strong');title.textContent=(incident.resolvedAt?'解決済み · ':'重大 · ')+incident.summary;
      const detail=document.createElement('p');detail.textContent=`${date(incident.lastSeen)} · ${incident.count}回 · メール: ${incident.emailDelivery||'待機'} · プッシュ: ${incident.pushDelivery||'待機'}`;
      div.append(title,detail);
      if(!incident.acknowledgedAt){const b=document.createElement('button');b.textContent='確認済みにする';b.onclick=()=>action(b,async()=>{await api('/api/admin/incidents/'+encodeURIComponent(incident.id)+'/acknowledge',{method:'POST',body:'{}'});await refresh();});div.append(b);}
      return div;
    }));
    if(!data.incidents.length){const p=document.createElement('p');p.textContent='重大なインシデントはありません。';$('incidents').append(p);}
    text('loginTotals',`成功 ${data.totals.loginSuccess} · 失敗 ${data.totals.loginFailure}`);
    $('loginHistory').replaceChildren(...data.logins.map(entry=>{const row=document.createElement('tr');for(const value of [date(entry.at),entry.success?'成功':'失敗',entry.status]){const td=document.createElement('td');td.textContent=value;row.append(td);}return row;}));
  }
  async function refresh(){render(await api('/api/admin/snapshot'));}
  async function action(button,task){if(button.disabled)return;button.disabled=true;text('message','');try{await task();}catch(error){text('message',error.message);}finally{button.disabled=false;}}
  function connect(){stream?.close();stream=new EventSource('/api/admin/events');stream.addEventListener('snapshot',event=>{try{render(JSON.parse(event.data));}catch{text('message','監視データを読み取れませんでした。');}});stream.addEventListener('expired',()=>lock());stream.onerror=()=>{if(expiresAt&&Date.now()>=expiresAt)lock();else text('message','監視への接続を再試行しています。');};}
  $('loginForm').onsubmit=event=>{event.preventDefault();action($('loginButton'),async()=>{
    const email=$('email').value.trim(),password=$('password').value;
    try{
      await api('/api/login',{method:'POST',body:JSON.stringify({email,password})});
      const result=await api('/api/admin/session',{method:'POST',body:JSON.stringify({password})});
      expiresAt=result.expiresAt;clearTimeout(expiryTimer);expiryTimer=setTimeout(()=>lock(),Math.max(0,expiresAt-Date.now()));await refresh();connect();
    }finally{$('password').value='';}
  });};
  $('refresh').onclick=()=>action($('refresh'),refresh);
  $('testAlert').onclick=()=>action($('testAlert'),async()=>{const result=await api('/api/admin/test-alert',{method:'POST',body:'{}'});text('message',`通知テスト · メール: ${result.email} · プッシュ: ${result.push}`);});
  $('logout').onclick=()=>action($('logout'),async()=>{await api('/api/admin/session',{method:'DELETE'});lock('管理セッションを終了しました。');});
  refresh().then(connect).catch(()=>{});
})();
