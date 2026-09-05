/* Game Center wallet — server-authoritative when running inside Telegram Mini App. */
(() => {
  const BAL='gc_local_balance', TODAY='gc_local_today', DAY='gc_local_day';
  const GLOBAL_LIMIT=0.01, PER_GAME_LIMIT=0.001;
  const tg=window.Telegram?.WebApp;
  const apiBase='';
  const hasTelegram=!!(tg && tg.initData);
  let serverMode=hasTelegram;

  const n=v=>Number(v||0);
  const fixed=v=>n(v).toFixed(8);
  const dayKey=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
  function ensureDay(){
    const today=dayKey();
    if(localStorage.getItem(DAY)!==today){
      localStorage.setItem(DAY,today); localStorage.setItem(TODAY,'0');
      ['gold_rush','crystal_hunt','miner_run','treasure_cave','minesweeper'].forEach(g=>localStorage.setItem(`gc_game_today_${g}`,'0'));
    }
  }
  function getBalance(){ensureDay();return n(localStorage.getItem(BAL))}
  function getToday(){ensureDay();return n(localStorage.getItem(TODAY))}
  function getGameToday(game){ensureDay();return n(localStorage.getItem(`gc_game_today_${game}`))}
  function cache(data){
    if(!data)return;
    if(data.balance!==undefined)localStorage.setItem(BAL,fixed(data.balance));
    if(data.today!==undefined)localStorage.setItem(TODAY,fixed(data.today));
  }
  async function request(path, options={}){
    if(!serverMode) throw new Error('Telegram Mini App oturumu bulunamadı.');
    const headers={'Content-Type':'application/json','x-telegram-init-data':tg.initData,...(options.headers||{})};
    const r=await fetch(apiBase+path,{...options,headers});
    let data={}; try{data=await r.json()}catch(_){data={ok:false,message:'Sunucu yanıtı okunamadı.'}}
    if(!r.ok||data.ok===false) throw new Error(data.message||'Game Center sunucu hatası.');
    return data;
  }
  async function refresh(){
    if(!serverMode)return {ok:true,balance:getBalance(),today:getToday(),local:true};
    const data=await request('/api/game-center/balance',{method:'GET'}); cache(data); return data;
  }
  async function start(game){
    if(!serverMode)return {ok:true,local:true,sessionId:null};
    return request('/api/game-center/start',{method:'POST',body:JSON.stringify({game})});
  }
  async function complete(game,sessionId,amount){
    if(!serverMode)return {ok:true,local:true,awarded:award(game,amount),balance:getBalance(),today:getToday()};
    const data=await request('/api/game-center/complete',{method:'POST',body:JSON.stringify({game,sessionId,amount})});
    cache(data); return data;
  }
  async function transfer(){
    if(!serverMode) throw new Error('Transfer için Telegram Mini App içinde açın.');
    const data=await request('/api/game-center/transfer',{method:'POST',body:'{}'}); cache({balance:data.balance,today:data.today}); return data;
  }
  function award(game,requested){
    ensureDay(); const req=Math.max(0,n(requested));
    const room=Math.max(0,GLOBAL_LIMIT-getToday()), gameRoom=Math.max(0,PER_GAME_LIMIT-getGameToday(game));
    const reward=Math.min(req,PER_GAME_LIMIT,room,gameRoom); if(reward<=0)return 0;
    localStorage.setItem(BAL,fixed(getBalance()+reward)); localStorage.setItem(TODAY,fixed(getToday()+reward));
    localStorage.setItem(`gc_game_today_${game}`,fixed(getGameToday(game)+reward)); return reward;
  }
  window.GameCenterWallet={BAL,TODAY,GLOBAL_LIMIT,PER_GAME_LIMIT,dayKey,ensureDay,getBalance,getToday,getGameToday,award,refresh,start,complete,transfer,isServerMode:()=>serverMode,format:v=>n(v).toFixed(5)};
  if(tg){try{tg.ready();}catch(_){}; refresh().catch(()=>{});}
})();
