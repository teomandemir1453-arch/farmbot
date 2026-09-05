require('dotenv').config();

const { Telegraf, Markup } = require('telegraf');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!BOT_TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN .env içinde bulunamadı.');
}

const bot = new Telegraf(BOT_TOKEN);

// Şimdilik localhost kullanmıyoruz.
// Siteyi dışarı açtığında burayı gerçek HTTPS adresinle değiştireceğiz.
const WEB_APP_URL = process.env.WEB_APP_URL || 'https://google.com';

bot.start((ctx) => {
    const firstName = ctx.from.first_name || 'Kullanıcı';

    ctx.reply(
        `Merhaba ${firstName}! 👋\n\nMicro Monetize'a hoş geldin!`,
        Markup.inlineKeyboard([
            Markup.button.webApp('🚀 Uygulamayı Aç', WEB_APP_URL)
        ])
    );
});

bot.help((ctx) => {
    ctx.reply('Uygulamayı açmak için /start yaz.');
});

bot.catch((err, ctx) => {
    console.error('Telegram bot hatası:', err);
});

console.log('🤖 Micro Monetize botu başlatılıyor...');

bot.launch()
    .then(() => {
        console.log('✅ Telegram botu çalışıyor.');
    })
    .catch((err) => {
        console.error('❌ Bot başlatılamadı:', err);
        process.exit(1);
    });

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));