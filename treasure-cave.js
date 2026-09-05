(() => {
  const tg=window.Telegram?.WebApp; if(tg){tg.ready();tg.expand();try{tg.setHeaderColor('#070b18');tg.setBackgroundColor('#070b18')}catch(e){}}
  const $=id=>document.getElementById(id), money=n=>Number(n||0).toFixed(5);
  const BAL='gc_local_balance',TODAY='gc_local_today';
  const state={room:0,keys:0,lives:3,score:0,treasures:0,running:false,used:false,reward:0,startedAt:0,finishing:false};
  const roomData=[
    {title:'GİZLİ GEÇİT',hint:'Üç kapıdan birini seç',good:'🗝️',bad:'🕸️',gold:35},
    {title:'TAŞ KORİDOR',hint:'Sesleri takip et',good:'💎',bad:'🪨',gold:45},
    {title:'KRİSTAL ODA',hint:'Işığın geldiği yolu bul',good:'💎',bad:'🦂',gold:55},
    {title:'ESKİ TAPINAK',hint:'Anahtar sembolünü ara',good:'🗝️',bad:'⚡',gold:70},
    {title:'GÖLGE MAĞARASI',hint:'Sandık kokusunu takip et',good:'🎁',bad:'🔥',gold:85},
    {title:'HAZİNE ODASI',hint:'Son kapının ardında hazine var',good:'👑',bad:'💀',gold:120}
  ];
  function render(){ $('keys').textContent=state.keys;$('lives').textContent=state.lives;$('score').textContent=state.score;$('treasures').textContent=state.treasures;$('wallet').textContent='$'+money(window.GameCenterWallet.getBalance());$('rewardPreview').textContent='$'+money(state.reward);$('roomLabel').textContent=`ODA ${Math.min(state.room+1,6)} / 6`; }
  function setupDoors(){
    const wrap=$('doors');wrap.innerHTML='';
    const data=roomData[Math.min(state.room,5)];
    const good=Math.floor(Math.random()*3);
    for(let i=0;i<3;i++){
      const b=document.createElement('button');b.className='door';b.innerHTML=`<span class="num">KAPI ${i+1}</span><span class="ico">🚪</span><strong>${i===good?'✦':'?'}</strong>`;
      b.onclick=()=>choose(i,good,b);wrap.appendChild(b);
    }
  }
  function choose(i,good,btn){
    if(!state.running||btn.disabled)return;
    [...$('doors').children].forEach(x=>x.disabled=true);
    const data=roomData[state.room];
    if(i===good){
      btn.classList.add('good');state.score+=data.gold;state.keys+=state.room%2===0?1:0;
      if(Math.random()<.28){state.treasures++;state.score+=45}
      state.room++;
      $('status').textContent=state.room>=6?'HAZİNEYE ULAŞTIN!':'DOĞRU YOL!';
      if(state.room>=6){finish(true);return}
      setTimeout(()=>{ $('roomTitle').textContent=roomData[state.room].title;$('roomHint').textContent=roomData[state.room].hint;setupDoors();render();},420);
    }else{
      btn.classList.add('bad');state.lives--;state.score=Math.max(0,state.score-12);$('status').textContent='TUZAK!';
      if(state.lives<=0){finish(false);return}
      setTimeout(()=>{ $('status').textContent='BAŞKA BİR KAPI DENE';setupDoors();render();},520);
    }
    render();
  }
  async function finish(win){
    if(state.finishing)return;
    state.finishing=true;
    state.running=false;state.reward=win ? Math.min(.001, .00022 + state.keys*.00007 + state.treasures*.00009) : Math.min(.00012,state.score*.00000025);
    const wait=Math.max(0,28000-(Date.now()-state.startedAt));
    if(wait)await new Promise(r=>setTimeout(r,wait));
    try { const data=await window.GameCenterWallet.complete('treasure_cave',state.sessionId,state.reward); state.reward=Number(data.awarded||0); } catch(e) { state.reward=0; }
    $('status').textContent=win?'HAZİNE BULUNDU!':'MACERA SONA ERDİ';
    $('result').hidden=false;$('result').innerHTML=win?`<div>👑 Hazine sandığı açıldı!</div><strong>+$${money(state.reward)}</strong><div>Skor: ${state.score} • Anahtar: ${state.keys} • Hazine: ${state.treasures}</div>`:`<div>Mağara seni geri gönderdi.</div><strong>+$${money(state.reward)}</strong><div>Skor: ${state.score}</div>`;
    $('startBtn').textContent=window.gameI18n?window.gameI18n('again'):'TEKRAR OYNA';render();
  }
  $('startBtn').onclick=async()=>{const session=await window.GameCenterWallet.start('treasure_cave').catch(e=>({ok:false,message:e.message})); if(!session.ok){alert(session.message||'Game Center unavailable');return;} state.sessionId=session.sessionId;state.startedAt=Date.now();state.finishing=false;state.room=0;state.keys=0;state.lives=3;state.score=0;state.treasures=0;state.reward=0;state.running=true;$('result').hidden=true;$('roomTitle').textContent=roomData[0].title;$('roomHint').textContent=roomData[0].hint;$('status').textContent='YOLU SEÇ';setupDoors();render();$('startBtn').textContent=window.gameI18n?window.gameI18n('playing'):'MACERA DEVAM EDİYOR';};
  $('resetBtn').onclick=()=>{state.running=false;$('result').hidden=true;$('roomTitle').textContent=roomData[0].title;$('roomHint').textContent=roomData[0].hint;$('status').textContent='YOLU SEÇ';setupDoors();render();};
  setupDoors();render();
})();
