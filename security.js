function sameOriginApi(req,res,next) {
  res.set('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  res.set('X-Content-Type-Options', 'nosniff');
  const origin=req.get('origin');
  const host=req.get('host');
  const local=`${req.secure?'https':'http'}://${host}`;
  const allowed=new Set();
  if (host && /^[a-zA-Z0-9.:_-]+$/.test(host)) allowed.add(local);
  try{if(process.env.PUBLIC_URL)allowed.add(new URL(process.env.PUBLIC_URL).origin);}catch{}
  if((origin&&!allowed.has(origin))||req.get('sec-fetch-site')==='cross-site') {
    res.set('Cache-Control','no-store');return res.status(403).json({error:'このサイト以外からのAPIアクセスは許可されていません。'});
  }
  if(origin){res.set('Access-Control-Allow-Origin',origin);res.set('Access-Control-Allow-Credentials','true');res.vary('Origin');}
  if(req.method==='OPTIONS') {
    res.set('Access-Control-Allow-Methods','GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.set('Access-Control-Allow-Headers','Content-Type,X-Admin-Request');return res.sendStatus(204);
  }
  next();
}
module.exports={sameOriginApi};
