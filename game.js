(() => {
  const tg = window.Telegram?.WebApp;
  if (tg) {
    tg.ready(); tg.expand();
    try { tg.setHeaderColor('#070b22'); tg.setBackgroundColor('#070b22'); } catch (_) {}
  }

  const translations = {
    tr:{hero:'Oyununu seç • kazancını biriktir',wallet:'GAME CENTER CÜZDANI',today:'BUGÜNKÜ KAZANÇ',dailyLimit:'GÜNLÜK LİMİT',investment:'YATIRIMA AKTAR',transferInfo:'Game Center kazancını $0.01 olduğunda yatırım hesabına aktarabilirsin.',transfer:'AKTAR',gamesEyebrow:'OYUNLARLA KAZAN',choose:'Oyununuzu Seçin',gold:'Gold Rush',goldDesc:'Altınları topla',crystal:'Crystal Hunt',crystalDesc:'Kristalleri keşfet',miner:'Miner Run',minerDesc:'Madende hayatta kal',treasure:'Treasure Cave',treasureDesc:'Gizli hazineyi bul',minesweeper:'Minesweeper',minesDesc:'Mayınlara dikkat et',reward:'$0.001’A KADAR',play:'OYNA ›',classic:'KLASİK',secure:'Kazanç ve günlük limitler daha sonra sunucu tarafından doğrulanacaktır.',minTransfer:'⚡ 0.01 MİN',back:'Geri',soon:'YAKINDA',space:'Space Defender',racer:'Speed Racer',bubble:'Bubble Pop',ninja:'Ninja Strike',dragon:'Dragon Hunter',coming:'YAKINDA',comingGames:'5 YENİ OYUN ÇOK YAKINDA',comingText:'Yeni oyunlar hazırlanıyor. Çok yakında burada!',adPlaceholder:'REKLAM ALANI',adNetwork:'AdMob / Yandex Ads'},
    en:{hero:'Choose a game • build your earnings',wallet:'GAME CENTER WALLET',today:"TODAY'S EARNINGS",dailyLimit:'DAILY LIMIT',investment:'TRANSFER TO INVESTMENT',transferInfo:'Transfer your Game Center earnings to investment when you reach $0.01.',transfer:'TRANSFER',gamesEyebrow:'EARN WITH GAMES',choose:'Choose Your Game',gold:'Gold Rush',goldDesc:'Collect the gold',crystal:'Crystal Hunt',crystalDesc:'Find the crystals',miner:'Miner Run',minerDesc:'Survive the mine',treasure:'Treasure Cave',treasureDesc:'Find the hidden treasure',minesweeper:'Minesweeper',minesDesc:'Watch out for mines',reward:'UP TO $0.001',play:'PLAY ›',classic:'CLASSIC',secure:'Earnings and daily limits will later be verified by the server.',minTransfer:'⚡ 0.01 MIN',back:'Back',soon:'COMING SOON',space:'Space Defender',racer:'Speed Racer',bubble:'Bubble Pop',ninja:'Ninja Strike',dragon:'Dragon Hunter',coming:'COMING SOON',comingGames:'5 NEW GAMES COMING SOON',comingText:'New games are being prepared. Coming very soon!',adPlaceholder:'AD SPACE',adNetwork:'AdMob / Yandex Ads'},
    ru:{hero:'Выбери игру • накапливай доход',wallet:'КОШЕЛЁК GAME CENTER',today:'ЗАРАБОТОК СЕГОДНЯ',dailyLimit:'ДНЕВНОЙ ЛИМИТ',investment:'ПЕРЕВЕСТИ В ИНВЕСТИЦИИ',transferInfo:'Переводите заработок Game Center в инвестиции после достижения $0.01.',transfer:'ПЕРЕВЕСТИ',gamesEyebrow:'ЗАРАБАТЫВАЙ В ИГРАХ',choose:'Выбери игру',gold:'Gold Rush',goldDesc:'Собирай золото',crystal:'Crystal Hunt',crystalDesc:'Ищи кристаллы',miner:'Miner Run',minerDesc:'Выживи в шахте',treasure:'Treasure Cave',treasureDesc:'Найди сокровище',minesweeper:'Minesweeper',minesDesc:'Остерегайся мин',reward:'ДО $0.001',play:'ИГРАТЬ ›',classic:'КЛАССИКА',secure:'Доходы и дневные лимиты позже будут проверяться сервером.',minTransfer:'⚡ 0.01 МИН',back:'Назад',soon:'СКОРО',space:'Space Defender',racer:'Speed Racer',bubble:'Bubble Pop',ninja:'Ninja Strike',dragon:'Dragon Hunter',coming:'СКОРО',comingGames:'5 НОВЫХ ИГР СКОРО',comingText:'Новые игры уже готовятся!',adPlaceholder:'РЕКЛАМНОЕ МЕСТО',adNetwork:'AdMob / Yandex Ads'},
    es:{hero:'Elige un juego • acumula ganancias',wallet:'BILLETERA GAME CENTER',today:'GANANCIAS DE HOY',dailyLimit:'LÍMITE DIARIO',investment:'TRANSFERIR A INVERSIÓN',transferInfo:'Transfiere tus ganancias a inversión al alcanzar $0.01.',transfer:'TRANSFERIR',gamesEyebrow:'GANA JUGANDO',choose:'Elige tu juego',gold:'Gold Rush',goldDesc:'Recoge el oro',crystal:'Crystal Hunt',crystalDesc:'Encuentra cristales',miner:'Miner Run',minerDesc:'Sobrevive en la mina',treasure:'Treasure Cave',treasureDesc:'Encuentra el tesoro',minesweeper:'Minesweeper',minesDesc:'Cuidado con las minas',reward:'HASTA $0.001',play:'JUGAR ›',classic:'CLÁSICO',secure:'Las ganancias y límites diarios serán verificados por el servidor.',minTransfer:'⚡ 0.01 MIN',back:'Atrás',soon:'PRÓXIMAMENTE',space:'Space Defender',racer:'Speed Racer',bubble:'Bubble Pop',ninja:'Ninja Strike',dragon:'Dragon Hunter',coming:'PRÓXIMAMENTE',comingGames:'5 JUEGOS NUEVOS PRÓXIMAMENTE',comingText:'Nuevos juegos en preparación. ¡Muy pronto!',adPlaceholder:'ESPACIO PUBLICITARIO',adNetwork:'AdMob / Yandex Ads'},
    de:{hero:'Wähle ein Spiel • sammle Einnahmen',wallet:'GAME CENTER WALLET',today:'HEUTIGE EINNAHMEN',dailyLimit:'TAGESLIMIT',investment:'IN INVESTMENT ÜBERTRAGEN',transferInfo:'Übertrage deine Einnahmen ab $0.01 in dein Investment.',transfer:'ÜBERTRAGEN',gamesEyebrow:'MIT SPIELEN VERDIENEN',choose:'Spiel auswählen',gold:'Gold Rush',goldDesc:'Sammle Gold',crystal:'Crystal Hunt',crystalDesc:'Finde Kristalle',miner:'Miner Run',minerDesc:'Überlebe die Mine',treasure:'Treasure Cave',treasureDesc:'Finde den Schatz',minesweeper:'Minesweeper',minesDesc:'Achte auf die Minen',reward:'BIS ZU $0.001',play:'SPIELEN ›',classic:'KLASSIKER',secure:'Einnahmen und Tageslimits werden später vom Server geprüft.',minTransfer:'⚡ 0.01 MIN',back:'Zurück',soon:'BALD',space:'Space Defender',racer:'Speed Racer',bubble:'Bubble Pop',ninja:'Ninja Strike',dragon:'Dragon Hunter',coming:'BALD',comingGames:'5 NEUE SPIELE KOMMEN BALD',comingText:'Neue Spiele werden vorbereitet. Bald hier!',adPlaceholder:'WERBEFLÄCHE',adNetwork:'AdMob / Yandex Ads'}
  };

  const rawLang = localStorage.getItem('mm_language') || tg?.initDataUnsafe?.user?.language_code || 'en';
  const lang = String(rawLang).slice(0,2).toLowerCase();
  const t = translations[lang] || translations.en;
  document.documentElement.lang = translations[lang] ? lang : 'en';
  document.querySelectorAll('[data-i18n]').forEach(el => { if (t[el.dataset.i18n] !== undefined) el.textContent = t[el.dataset.i18n]; });

  const wallet=window.GameCenterWallet;
  if(!wallet) throw new Error('Game Center cüzdan modülü yüklenemedi.');
  wallet.ensureDay();
  const money=(v)=>'$'+Number(v||0).toFixed(5);
  let balance=wallet.getBalance(), today=wallet.getToday();
  const render=()=>{
    balance=wallet.getBalance(); today=wallet.getToday();
    document.getElementById('balance').textContent=money(balance);
    document.getElementById('today').textContent=money(today);
    const ta=document.getElementById('transferAmount'); if(ta) ta.textContent=money(balance);
    document.getElementById('progressBar').style.width=Math.min(100,today/0.01*100)+'%';
    const btn=document.getElementById('transferBtn'); btn.disabled=balance<0.01;
  };
  render();
  wallet.refresh().then(render).catch(()=>render());

  document.getElementById('transferBtn').addEventListener('click',async()=>{
    if(balance<0.01)return;
    const btn=document.getElementById('transferBtn'); btn.disabled=true;
    try{
      const data=await wallet.transfer(); render();
      const msg=lang==='tr'?`$${Number(data.amount ?? data.transferred ?? 0).toFixed(2)} yatırım hesabına aktarıldı.`:`$${Number(data.amount ?? data.transferred ?? 0).toFixed(2)} transferred to investment.`;
      if(tg?.showPopup) tg.showPopup({title:lang==='tr'?'Başarılı':'Success',message:msg,buttons:[{type:'ok'}]}); else alert(msg);
    }catch(e){
      render(); if(tg?.showPopup) tg.showPopup({title:lang==='tr'?'Hata':'Error',message:e.message,buttons:[{type:'ok'}]}); else alert(e.message);
    }finally{render();}
  });
})();
