const { Telegraf, Markup } = require('telegraf');

// ⚠️ BURAYA BOTFATHER'DAN ALDIĞIN TOKEN'I YAPIŞTIR ⚠️
const BOT_TOKEN = '8893590328:AAGlkQyb6yjfdOEBVS0eawNej107C_BpkWg'; 

const bot = new Telegraf(BOT_TOKEN);

// Geçici test linki (sonra değiştireceğiz)
const WEB_APP_URL = 'https://google.com'; 

bot.start((ctx) => {
    const firstName = ctx.from.first_name;
    ctx.reply(
        `Merhaba ${firstName}! 🚜🌾\n\nFarm My Country'ye hoş geldin!`,
        Markup.inlineKeyboard([
            Markup.button.webApp('🎮 Oyuna Başla', WEB_APP_URL)
        ])
    );
});

bot.help((ctx) => {
    ctx.reply('Oynamak için /start yaz!');
});

console.log('🤖 Bot çalışıyor...');
bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));