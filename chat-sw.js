/* Connective service worker. Own cache name, only touches its own files. */
const P='connective-',C=P+'v4',F=['chat.html','chat-manifest.json','chat-192.png','chat-512.png','chat-apple-180.png','chat-maskable-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>Promise.all(F.map(f=>c.add(new Request(f,{cache:'no-store'})).catch(()=>{})))));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x.startsWith(P)&&x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.origin!==location.origin)return;
  e.respondWith(fetch(e.request,{cache:'no-store'}).then(r=>{if(r.ok){const cp=r.clone();caches.open(C).then(c=>c.put(e.request,cp)).catch(()=>{});}return r;}).catch(()=>caches.match(e.request,{ignoreSearch:true}).then(r=>r||caches.match('chat.html'))));
});
/* tapping a notification opens (or focuses) the app */
self.addEventListener('notificationclick',e=>{
  e.notification.close();
  const url=(e.notification.data&&e.notification.data.url)||'./chat.html';
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(l=>{
    for(const c of l){if(c.url.split('#')[0].split('?')[0]===url&&'focus' in c)return c.focus();}
    return self.clients.openWindow(url);
  }));
});

/* Push from the relay: wake the phone for a call or a message.
   The payload is end-to-end encrypted by the relay for this phone only. */
self.addEventListener('push',e=>{
  e.waitUntil((async()=>{
    const wins=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    if(wins.some(c=>c.visibilityState==='visible'))return; // app is open, it handles things itself
    let d={};try{d=e.data?e.data.json():{};}catch(_){}
    const who=String(d.n||'Someone').slice(0,30),data={url:self.registration.scope};
    const base={icon:'chat-192.png',badge:'chat-192.png',data};
    if(d.k==='call'){
      return self.registration.showNotification(who+' is calling',Object.assign({body:(d.v?'Video call':'Voice call')+'. Tap to answer.',tag:'call',renotify:true,requireInteraction:true,vibrate:[500,250,500,250,500,250,500]},base));
    }
    if(d.k==='end'){
      const old=await self.registration.getNotifications({tag:'call'});old.forEach(n=>n.close());
      return self.registration.showNotification('Missed call from '+who,Object.assign({tag:'missed',vibrate:[150]},base));
    }
    return self.registration.showNotification(who,Object.assign({body:'New message',tag:'pc',renotify:true,vibrate:[120]},base));
  })());
});
