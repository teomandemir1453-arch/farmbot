require('dotenv').config();

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
const pool = require('./db');
/* =====================================================
   ADMIN TELEGRAM BİLDİRİMLERİ
===================================================== */

const ADMIN_CHAT_ID =
    process.env.ADMIN_CHAT_ID;

const ADMIN_BOT_TOKEN =
    process.env.ADMIN_BOT_TOKEN;

function escapeTelegramHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

async function sendAdminTelegramMessage(text) {

    if (!ADMIN_CHAT_ID || !ADMIN_BOT_TOKEN) {
        console.warn(
            '⚠️ ADMIN_BOT_TOKEN veya ADMIN_CHAT_ID eksik.'
        );
        return;
    }

    try {

        const response = await fetch(
            `https://api.telegram.org/bot${ADMIN_BOT_TOKEN}/sendMessage`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    chat_id: ADMIN_CHAT_ID,
                    text,
                    parse_mode: 'HTML'
                })
            }
        );

        const data = await response.json();

        if (!response.ok || !data.ok) {

            console.error(
                '❌ Admin Telegram bildirimi başarısız:',
                data
            );

            return;
        }

        console.log(
            '✅ Admin Telegram bildirimi gönderildi.'
        );

    } catch (error) {

        console.error(
            '❌ Telegram bildirim hatası:',
            error
        );
    }
}

/* =====================================================
   KULLANICI BİLDİRİMLERİ
===================================================== */

const NOTIFY_BOT_TOKEN =
    process.env.NOTIFY_BOT_TOKEN;

async function sendUserTelegramMessage(
    telegramId,
    text,
    replyMarkup = undefined
) {

    if (!NOTIFY_BOT_TOKEN) {

        console.warn(
            '⚠️ NOTIFY_BOT_TOKEN bulunamadı.'
        );

        return;
    }

    try {

        const body = {
            chat_id: telegramId,
            text: text,
            parse_mode: 'HTML'
        };

        if (replyMarkup) {
            body.reply_markup = replyMarkup;
        }

        const response = await fetch(
            `https://api.telegram.org/bot${NOTIFY_BOT_TOKEN}/sendMessage`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            }
        );

        const data = await response.json();

        if (!response.ok || !data.ok) {

            console.error(
                '❌ Kullanıcı Telegram bildirimi başarısız:',
                data
            );

            return;
        }

        console.log(
            `✅ Kullanıcı bildirimi gönderildi: ${telegramId}`
        );

    } catch (error) {

        console.error(
            '❌ Kullanıcı bildirim hatası:',
            error
        );
    }
}

let NOTIFY_BOT_USERNAME = null;

async function loadNotifyBotUsername() {

    if (!NOTIFY_BOT_TOKEN) {
        console.warn(
            '⚠️ NOTIFY_BOT_TOKEN bulunamadı.'
        );
        return;
    }

    try {

        const response = await fetch(
            `https://api.telegram.org/bot${NOTIFY_BOT_TOKEN}/getMe`
        );

        const data = await response.json();

        if (!response.ok || !data.ok) {

            console.error(
                '❌ Notify bot bilgisi alınamadı:',
                data
            );

            return;
        }

        NOTIFY_BOT_USERNAME =
            data.result.username || null;

        console.log(
            `✅ Notify bot: @${NOTIFY_BOT_USERNAME}`
        );

    } catch (error) {

        console.error(
            '❌ Notify bot getMe hatası:',
            error
        );
    }
}
const app = express();

app.use(cors());
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

/* =====================================================
   YARDIMCI FONKSİYONLAR
===================================================== */

function requireAdmin(req, res) {
    const configuredKey = process.env.ADMIN_PANEL_KEY;

    if (!configuredKey) {
        res.status(500).json({
            ok: false,
            message: 'ADMIN_PANEL_KEY .env içinde bulunamadı.'
        });
        return false;
    }

    const suppliedKey = String(req.headers['x-admin-key'] || '');

    if (!suppliedKey) {
        res.status(401).json({
            ok: false,
            message: 'Admin anahtarı gerekli.'
        });
        return false;
    }

    const a = Buffer.from(suppliedKey);
    const b = Buffer.from(configuredKey);

    if (
        a.length !== b.length ||
        !crypto.timingSafeEqual(a, b)
    ) {
        res.status(403).json({
            ok: false,
            message: 'Yetkisiz admin erişimi.'
        });
        return false;
    }

    return true;
}


/* =====================================================
   KRİPTO FİYATLARI
   Kaynak: PostgreSQL
   Online güncelleme: CoinGecko -> PostgreSQL
===================================================== */

async function ensureCryptoPricesTable() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS crypto_prices (
            id INTEGER PRIMARY KEY DEFAULT 1,
            trx_usd NUMERIC(30,12) NOT NULL DEFAULT 0.12,
            bnb_usd NUMERIC(30,12) NOT NULL DEFAULT 600,
            xrp_usd NUMERIC(30,12) NOT NULL DEFAULT 0.50,
            source VARCHAR(20) NOT NULL DEFAULT 'manual',
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT crypto_prices_singleton CHECK (id = 1)
        )
    `);

    await pool.query(`
        INSERT INTO crypto_prices
            (id, trx_usd, bnb_usd, xrp_usd, source)
        VALUES
            (1, 0.12, 600, 0.50, 'manual')
        ON CONFLICT (id) DO NOTHING
    `);
}

async function fetchLiveCryptoPrices() {
    const response = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=tron,binancecoin,ripple&vs_currencies=usd'
    );

    if (!response.ok) {
        throw new Error(`CoinGecko HTTP ${response.status}`);
    }

    const data = await response.json();

    const trx = Number(data?.tron?.usd);
    const bnb = Number(data?.binancecoin?.usd);
    const xrp = Number(data?.ripple?.usd);

    if (
        !Number.isFinite(trx) || trx <= 0 ||
        !Number.isFinite(bnb) || bnb <= 0 ||
        !Number.isFinite(xrp) || xrp <= 0
    ) {
        throw new Error('CoinGecko geçerli TRX/BNB/XRP fiyatı döndürmedi.');
    }

    return { trx, bnb, xrp };
}

/* Kullanıcı uygulaması: fiyatları doğrudan PostgreSQL'den okur. */
app.get('/api/prices', async (req, res) => {
    try {
        await ensureCryptoPricesTable();

        const result = await pool.query(`
            SELECT
                trx_usd,
                bnb_usd,
                xrp_usd,
                source,
                updated_at
            FROM crypto_prices
            WHERE id = 1
            LIMIT 1
        `);

        const row = result.rows[0];

        res.json({
            ok: true,
            prices: {
                trx: Number(row.trx_usd),
                bnb: Number(row.bnb_usd),
                xrp: Number(row.xrp_usd)
            },
            source: row.source,
            updatedAt: row.updated_at
        });
    } catch (error) {
        console.error('Crypto prices read error:', error);
        res.status(500).json({
            ok: false,
            message: error.message
        });
    }
});

/* Admin: mevcut PostgreSQL fiyatını görür. */
app.get('/api/admin/prices', async (req, res) => {
    if (!requireAdmin(req, res)) return;

    try {
        await ensureCryptoPricesTable();

        const result = await pool.query(`
            SELECT
                trx_usd,
                bnb_usd,
                xrp_usd,
                source,
                updated_at
            FROM crypto_prices
            WHERE id = 1
            LIMIT 1
        `);

        const row = result.rows[0];

        res.json({
            ok: true,
            prices: {
                trx: Number(row.trx_usd),
                bnb: Number(row.bnb_usd),
                xrp: Number(row.xrp_usd)
            },
            source: row.source,
            updatedAt: row.updated_at
        });
    } catch (error) {
        console.error('Admin crypto prices read error:', error);
        res.status(500).json({
            ok: false,
            message: error.message
        });
    }
});

/* Admin: CoinGecko'dan alıp PostgreSQL'e kaydeder. */
app.post('/api/admin/prices/online', async (req, res) => {
    if (!requireAdmin(req, res)) return;

    try {
        await ensureCryptoPricesTable();

        const prices = await fetchLiveCryptoPrices();

        const result = await pool.query(`
            UPDATE crypto_prices
            SET
                trx_usd = $1,
                bnb_usd = $2,
                xrp_usd = $3,
                source = 'online',
                updated_at = NOW()
            WHERE id = 1
            RETURNING
                trx_usd,
                bnb_usd,
                xrp_usd,
                source,
                updated_at
        `, [
            prices.trx,
            prices.bnb,
            prices.xrp
        ]);

        const row = result.rows[0];

        console.log(
            `🪙 Coin fiyatları güncellendi: ` +
            `TRX=$${Number(row.trx_usd).toFixed(8)} ` +
            `BNB=$${Number(row.bnb_usd).toFixed(8)} ` +
            `XRP=$${Number(row.xrp_usd).toFixed(8)}`
        );

        res.json({
            ok: true,
            message: 'Coin fiyatları online olarak güncellendi.',
            prices: {
                trx: Number(row.trx_usd),
                bnb: Number(row.bnb_usd),
                xrp: Number(row.xrp_usd)
            },
            source: row.source,
            updatedAt: row.updated_at
        });
    } catch (error) {
        console.error('Admin online crypto prices error:', error);

        res.status(502).json({
            ok: false,
            message:
                'Online coin fiyatı alınamadı. ' +
                'CoinGecko erişimini kontrol edin: ' +
                error.message
        });
    }
});

/* Admin: elle girilen fiyatları PostgreSQL'e kaydeder. */
app.post('/api/admin/prices/manual', async (req, res) => {
    if (!requireAdmin(req, res)) return;

    try {
        await ensureCryptoPricesTable();

        const trx = Number(req.body?.trx);
        const bnb = Number(req.body?.bnb);
        const xrp = Number(req.body?.xrp);

        if (
            !Number.isFinite(trx) || trx <= 0 ||
            !Number.isFinite(bnb) || bnb <= 0 ||
            !Number.isFinite(xrp) || xrp <= 0
        ) {
            return res.status(400).json({
                ok: false,
                message: 'TRX, BNB ve XRP fiyatları 0’dan büyük olmalıdır.'
            });
        }

        const result = await pool.query(`
            UPDATE crypto_prices
            SET
                trx_usd = $1,
                bnb_usd = $2,
                xrp_usd = $3,
                source = 'manual',
                updated_at = NOW()
            WHERE id = 1
            RETURNING
                trx_usd,
                bnb_usd,
                xrp_usd,
                source,
                updated_at
        `, [trx, bnb, xrp]);

        const row = result.rows[0];

        console.log(
            `✏️ Manuel coin fiyatları kaydedildi: ` +
            `TRX=$${Number(row.trx_usd).toFixed(8)} ` +
            `BNB=$${Number(row.bnb_usd).toFixed(8)} ` +
            `XRP=$${Number(row.xrp_usd).toFixed(8)}`
        );

        res.json({
            ok: true,
            message: 'Manuel coin fiyatları PostgreSQL’e kaydedildi.',
            prices: {
                trx: Number(row.trx_usd),
                bnb: Number(row.bnb_usd),
                xrp: Number(row.xrp_usd)
            },
            source: row.source,
            updatedAt: row.updated_at
        });
    } catch (error) {
        console.error('Admin manual crypto prices error:', error);
        res.status(500).json({
            ok: false,
            message: error.message
        });
    }
});

/* =====================================================
   TELEGRAM MINI APP DOĞRULAMA
===================================================== */

function validateTelegramInitData(initData) {
    if (!initData || typeof initData !== 'string') {
        return {
            valid: false,
            error: 'initData gerekli'
        };
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!botToken) {
        return {
            valid: false,
            error: 'TELEGRAM_BOT_TOKEN .env içinde bulunamadı'
        };
    }

    const params = new URLSearchParams(initData);
    const receivedHash = params.get('hash');

    if (!receivedHash) {
        return {
            valid: false,
            error: 'Telegram hash bulunamadı'
        };
    }

    const authDate = Number(params.get('auth_date') || 0);

    if (!authDate) {
        return {
            valid: false,
            error: 'auth_date bulunamadı'
        };
    }

    const now = Math.floor(Date.now() / 1000);

    if (now - authDate > 86400) {
        return {
            valid: false,
            error: 'Telegram oturum süresi dolmuş'
        };
    }

    const dataCheckArray = [];

    for (const [key, value] of params.entries()) {
        if (key === 'hash') continue;
        dataCheckArray.push(`${key}=${value}`);
    }

    dataCheckArray.sort();

    const dataCheckString = dataCheckArray.join('\n');

    const secretKey = crypto
        .createHmac('sha256', 'WebAppData')
        .update(botToken)
        .digest();

    const calculatedHash = crypto
        .createHmac('sha256', secretKey)
        .update(dataCheckString)
        .digest('hex');

    const receivedBuffer = Buffer.from(receivedHash, 'hex');
    const calculatedBuffer = Buffer.from(calculatedHash, 'hex');

    if (
        receivedBuffer.length !== calculatedBuffer.length ||
        !crypto.timingSafeEqual(
            receivedBuffer,
            calculatedBuffer
        )
    ) {
        return {
            valid: false,
            error: 'Telegram doğrulaması başarısız'
        };
    }

    let user = null;

    const userRaw = params.get('user');

    if (userRaw) {
        try {
            user = JSON.parse(userRaw);
        } catch {
            return {
                valid: false,
                error: 'Telegram kullanıcı verisi okunamadı'
            };
        }
    }

    if (!user || !user.id) {
        return {
            valid: false,
            error: 'Telegram kullanıcı bilgisi bulunamadı'
        };
    }

    return {
        valid: true,
        user,
        startParam: params.get('start_param') || ''
    };
}

/* =====================================================
   YATIRIM ÜRETİMİ
   4 AY = 120 GÜN
   Toplam üretim = yatırım ana parası
   Not: Üretim 8 ondalık muhasebe biriminde hesaplanır.
   Böylece 0.00000000 transaction spamı oluşmaz.
===================================================== */

const ROI_DAYS = 120;
const ROI_DURATION_MS =
    ROI_DAYS * 24 * 60 * 60 * 1000;

const MONEY_SCALE = 100000000n; // 1e-8
const MIN_PRODUCTION_UNIT = 1n;

function toMoneyUnits(value) {
    const n = Number(value || 0);
    if (!Number.isFinite(n) || n <= 0) return 0n;
    return BigInt(Math.round(n * 1e8));
}

function unitsToMoney(units) {
    return Number(units) / 1e8;
}

async function applyInvestmentProduction(userId) {

    const client = await pool.connect();

    try {

        await client.query('BEGIN');

        const userResult =
            await client.query(
                `
                SELECT
                    id,
                    balance
                FROM users
                WHERE id = $1
                FOR UPDATE
                `,
                [userId]
            );

        if (userResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return 0;
        }

        const investmentResult =
            await client.query(
                `
                SELECT
                    i.id,
                    i.amount,
                    i.approved_at,
                    COALESCE(
                        SUM(
                            CASE
                                WHEN t.type = 'investment_roi_earned'
                                THEN t.amount
                                ELSE 0
                            END
                        ),
                        0
                    ) AS credited
                FROM investments i
                LEFT JOIN transactions t
                    ON t.reference_id = i.id
                   AND t.type = 'investment_roi_earned'
                WHERE
                    i.user_id = $1
                    AND i.status = 'approved'
                    AND i.approved_at IS NOT NULL
                GROUP BY
                    i.id,
                    i.amount,
                    i.approved_at
                ORDER BY i.id ASC
                `,
                [userId]
            );

        let totalNewProductionUnits = 0n;
        const now = Date.now();

        for (const investment of investmentResult.rows) {

            const amountUnits =
                toMoneyUnits(investment.amount);

            const creditedUnits =
                toMoneyUnits(investment.credited);

            const approvedAt =
                new Date(investment.approved_at).getTime();

            if (
                amountUnits <= 0n ||
                !Number.isFinite(approvedAt)
            ) {
                continue;
            }

            const elapsedMs =
                Math.max(0, now - approvedAt);

            /*
             * 120 gün sonunda yatırım tutarının tamamı üretilir.
             * BigInt ile 1e-8 biriminde hesaplandığı için
             * JavaScript floating-point hataları muhasebeye girmez.
             */
            let earnedUnits;

            if (elapsedMs >= ROI_DURATION_MS) {
                earnedUnits = amountUnits;
            } else {
                earnedUnits =
                    (amountUnits * BigInt(elapsedMs)) /
                    BigInt(ROI_DURATION_MS);
            }

            if (earnedUnits > amountUnits) {
                earnedUnits = amountUnits;
            }

            let newProductionUnits =
                earnedUnits > creditedUnits
                    ? earnedUnits - creditedUnits
                    : 0n;

            /*
             * Transaction amount kolonu 8 ondalık muhasebe kullanıyor.
             * 1e-8'den küçük farkları transaction olarak yazmıyoruz.
             */
            if (newProductionUnits < MIN_PRODUCTION_UNIT) {
                continue;
            }

            /*
             * 120 gün tamamlandıysa kalan son muhasebe birimini de
             * mutlaka tamamla; toplam üretim hiçbir zaman ana parayı geçmez.
             */
            if (earnedUnits > amountUnits) {
                newProductionUnits =
                    amountUnits > creditedUnits
                        ? amountUnits - creditedUnits
                        : 0n;
            }

            if (newProductionUnits < MIN_PRODUCTION_UNIT) {
                continue;
            }

            const productionAmount =
                unitsToMoney(newProductionUnits);

            await client.query(
                `
                INSERT INTO transactions
                (
                    user_id,
                    type,
                    amount,
                    reference_id,
                    description
                )
                VALUES
                (
                    $1,
                    'investment_roi_earned',
                    $2,
                    $3,
                    'Aktif yatırım üretim kazancı'
                )
                `,
                [
                    userId,
                    productionAmount,
                    investment.id
                ]
            );

            totalNewProductionUnits +=
                newProductionUnits;
        }

        if (totalNewProductionUnits > 0n) {

            const currentBalance =
                Number(
                    userResult.rows[0].balance || 0
                );

            const productionAmount =
                unitsToMoney(totalNewProductionUnits);

            const newBalance =
                currentBalance + productionAmount;

            await client.query(
                `
                UPDATE users
                SET
                    balance = $1,
                    last_active = NOW()
                WHERE id = $2
                `,
                [
                    newBalance,
                    userId
                ]
            );

            console.log(
                `💰 Üretim: user=${userId} ` +
                `+${productionAmount.toFixed(8)}`
            );
        }

        await client.query('COMMIT');

        return unitsToMoney(totalNewProductionUnits);

    } catch (error) {

        await client.query('ROLLBACK');

        console.error(
            'Investment production error:',
            error
        );

        throw error;

    } finally {

        client.release();
    }
}

/* =====================================================
   HEALTH
===================================================== */

app.get('/api/health', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT NOW() AS server_time'
        );

        res.json({
            ok: true,
            database: 'connected',
            serverTime: result.rows[0].server_time
        });
    } catch (error) {
        console.error('Database error:', error);

        res.status(500).json({
            ok: false,
            database: 'error',
            message: error.message
        });
    }
});

/* =====================================================
   ADMIN HEALTH
===================================================== */

app.get('/api/admin/health', async (req, res) => {
    if (!requireAdmin(req, res)) return;

    try {
        const result = await pool.query(
            'SELECT NOW() AS server_time'
        );

        res.json({
            ok: true,
            admin: true,
            database: 'connected',
            serverTime: result.rows[0].server_time
        });
    } catch (error) {
        res.status(500).json({
            ok: false,
            message: error.message
        });
    }
});

/* =====================================================
   TELEGRAM KULLANICI KAYDI
===================================================== */

app.post('/api/user', async (req, res) => {
    console.log('');
    console.log('======================================');
    console.log('📥 /api/user isteği geldi');
    console.log('======================================');

    try {
        const { initData } = req.body;

        const telegram =
            validateTelegramInitData(initData);

        console.log(
            'Telegram doğrulama:',
            telegram.valid
                ? '✅ BAŞARILI'
                : '❌ BAŞARISIZ'
        );

        if (!telegram.valid) {
            return res.status(401).json({
                ok: false,
                message: telegram.error
            });
        }

        const tgUser = telegram.user;

        const telegramId = Number(tgUser.id);
        const username = tgUser.username || null;
        const firstName = tgUser.first_name || 'User';
        const language = tgUser.language_code || 'en';

        let referredBy = null;

        if (
            telegram.startParam &&
            telegram.startParam.startsWith('ref_')
        ) {
            const ref = telegram.startParam.slice(4);

            if (/^\d+$/.test(ref)) {
                referredBy = Number(ref);
            }
        }

        const query = `
            INSERT INTO users
            (
                telegram_id,
                username,
                first_name,
                language,
                referred_by,
                last_active
            )
            VALUES
            ($1,$2,$3,$4,$5,NOW())

            ON CONFLICT (telegram_id)
            DO UPDATE SET
                username = EXCLUDED.username,
                first_name = EXCLUDED.first_name,
                language = EXCLUDED.language,
                last_active = NOW(),
                referred_by = COALESCE(
                    users.referred_by,
                    EXCLUDED.referred_by
                )

            RETURNING
                id,
                telegram_id,
                username,
                first_name,
                language,
                referred_by,
                balance,
                total_invested,
                total_withdrawn,
                referral_earnings,
                created_at,
                last_active,
                (xmax = 0) AS is_new_user;
        `;

        const result = await pool.query(
            query,
            [
                telegramId,
                username,
                firstName,
                language,
                referredBy
            ]
        );
const userId = result.rows[0].id;

// =====================================================
// YENİ ÜYE HOŞ GELDİN BONUSU — $1.00
// Sadece PostgreSQL'e ilk kayıt sırasında verilir.
// localStorage / popup'a bağlı değildir ve tekrar verilemez.
// =====================================================
if (result.rows[0].is_new_user === true) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        await client.query(
            `
            UPDATE users
            SET total_invested = COALESCE(total_invested, 0) + 1.00,
                last_active = NOW()
            WHERE id = $1
            `,
            [userId]
        );
        await client.query(
            `
          INSERT INTO investments
(
    user_id,
    amount,
    package_name,
    status,
    approved_at
)
VALUES
($1, 1.00, 'WELCOME BONUS', 'approved', NOW())
            `,
            [userId]
        );

        await client.query(
            `
            INSERT INTO transactions
            (user_id, type, amount, description)
            VALUES ($1, 'welcome_bonus', 1.00, 'Yeni üye hoş geldin yatırım bonusu')
            `,
            [userId]
        );

        await client.query('COMMIT');

        console.log(
            `🎁 Yeni üye bonusu: user=${userId} → +$1.00 Total Investment`
        );
    } catch (bonusError) {
        try { await client.query('ROLLBACK'); } catch (_) {}
        throw bonusError;
    } finally {
        client.release();
    }

    // Bonus sonrası güncel kullanıcı bakiyesini tekrar çek.
    const refreshed = await pool.query(
        `
        SELECT
            id, telegram_id, username, first_name, language, referred_by,
            balance, total_invested, total_withdrawn, referral_earnings,
            created_at, last_active
        FROM users
        WHERE id = $1
        LIMIT 1
        `,
        [userId]
    );

    if (refreshed.rowCount > 0) {
        result.rows[0] = refreshed.rows[0];
    }
}

console.log(
    '👤 PostgreSQL userId:',
    userId
);

// Üretim burada çalıştırılmaz.
// /api/user istemciler tarafından sık çağrılabildiği için
// üretimi burada tetiklemek transaction spamına yol açıyordu.
// Üretimi yalnızca offline worker dakika bazında çalıştırır.
        console.log(
            '✅ PostgreSQL kullanıcı kaydı başarılı'
        );
console.log(
    '📊 USER RESPONSE:',
    result.rows[0]
);
        res.json({
            ok: true,
            user: result.rows[0]
        });

    } catch (error) {
        console.error(
            'USER SAVE ERROR:',
            error
        );

        res.status(500).json({
            ok: false,
            message: error.message
        });
    }
});
/* =====================================================
   OFFLINE ÜRETİM WORKER
   Kullanıcı Mini App'ten çıksa bile üretim devam eder.
===================================================== */

const PRODUCTION_INTERVAL_MS = 60 * 1000; // 1 dakika — üretimin tek zamanlayıcısı

async function runOfflineProduction() {

    try {

        const result = await pool.query(`
            SELECT id
            FROM users
        `);

        let processed = 0;

        for (const user of result.rows) {

            try {

                const production =
                    await applyInvestmentProduction(
                        user.id
                    );

                if (
                    Number(production || 0) > 0
                ) {
                    processed++;

                    console.log(
                        `💰 Offline üretim: user=${user.id} ` +
                        `+${
                            Number(production)
                                .toFixed(8)
                        }`
                    );
                }

            } catch (error) {

                console.error(
                    `❌ Offline üretim user=${user.id}:`,
                    error.message
                );

            }
        }

        console.log(
            `✅ Offline üretim taraması tamamlandı. ` +
            `Kullanıcı: ${result.rowCount}, ` +
            `üretim alan: ${processed}`
        );

    } catch (error) {

        console.error(
            '❌ Offline production worker error:',
            error
        );
    }
}

/* İlk tarama */
runOfflineProduction();

/* Her dakika tekrar tara */
setInterval(
    runOfflineProduction,
    PRODUCTION_INTERVAL_MS
);
/* =====================================================
   KULLANICI HESABI
===================================================== */
/* =====================================================
   OYUN KAZANCI → TOTAL INVESTMENT
===================================================== */

app.post('/api/game-investment', async (req, res) => {

    const client = await pool.connect();

    try {

        const {
            initData,
            amount
        } = req.body;

        /* TELEGRAM DOĞRULAMA */

        const telegram =
            validateTelegramInitData(initData);

        if (!telegram.valid) {

            return res.status(401).json({
                ok: false,
                message: telegram.error
            });

        }

        /* TUTAR KONTROLÜ */

        const investmentAmount =
            Number(amount);
console.log('🎮 GAME API GELDİ:', {
    telegramId: telegram?.user?.id,
    amount,
    investmentAmount
});
        if (
            !Number.isFinite(investmentAmount) ||
            investmentAmount <= 0 ||
            investmentAmount > 0.01
        ) {

            return res.status(400).json({
                ok: false,
                message: 'Geçersiz oyun yatırım tutarı.'
            });

        }

        const telegramId =
            Number(telegram.user.id);


        await client.query('BEGIN');


        /* KULLANICIYI KİLİTLE */

        const userResult =
            await client.query(
                `
                SELECT
                    id,
                    total_invested
                FROM users
                WHERE telegram_id = $1
                FOR UPDATE
                `,
                [telegramId]
            );


        if (userResult.rowCount === 0) {

            await client.query('ROLLBACK');

            return res.status(404).json({
                ok: false,
                message: 'Kullanıcı bulunamadı.'
            });

        }


        const user =
            userResult.rows[0];


        /*
         * Oyun kazancını gerçek yatırım
         * tutarına ekle.
         */

        await client.query(
            `
            UPDATE users
            SET
                total_invested =
                    total_invested + $1,
                last_active = NOW()
            WHERE id = $2
            `,
            [
                investmentAmount,
                user.id
            ]
        );


        /* İŞLEM KAYDI */

        await client.query(
            `
            INSERT INTO transactions
            (
                user_id,
                type,
                amount,
                description
            )
            VALUES
            (
                $1,
                'game_investment',
                $2,
                'Mining Rush oyun kazancı üretime eklendi'
            )
            `,
            [
                user.id,
                investmentAmount
            ]
        );


        await client.query('COMMIT');


        const newTotal =
            Number(user.total_invested || 0) +
            investmentAmount;


        console.log(
            `🎮 Oyun yatırımı: user=${user.id} ` +
            `+$${investmentAmount.toFixed(8)} ` +
            `→ Total Investment=$${newTotal.toFixed(8)}`
        );


        res.json({
    ok: true,

    amount:
        investmentAmount.toFixed(8),

    total_invested:
        newTotal.toFixed(8)
});


    } catch (error) {

        try {
            await client.query('ROLLBACK');
        } catch (_) {}

        console.error(
            'Game investment error:',
            error
        );

        res.status(500).json({
            ok: false,
            message: error.message
        });

    } finally {

        client.release();

    }

});
app.get('/api/account/:telegramId', async (req, res) => {
    try {
        const telegramId =
            Number(req.params.telegramId);

        const result = await pool.query(
            `
            SELECT
                id,
                telegram_id,
                username,
                first_name,
                language,
                referred_by,
                balance,
                total_invested,
                total_withdrawn,
                referral_earnings,
                created_at,
                last_active
            FROM users
            WHERE telegram_id = $1
            LIMIT 1
            `,
            [telegramId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                ok: false,
                message: 'Kullanıcı bulunamadı'
            });
        }

        res.json({
            ok: true,
            account: result.rows[0]
        });

    } catch (error) {
        res.status(500).json({
            ok: false,
            message: error.message
        });
    }
});

/* =====================================================
   KULLANICI - YATIRIM OLUŞTUR
===================================================== */

app.post('/api/investment', async (req, res) => {
    try {

        const {
            initData,
            amount,
            packageName
        } = req.body;

        const telegram =
            validateTelegramInitData(initData);

        if (!telegram.valid) {
            return res.status(401).json({
                ok: false,
                message: telegram.error
            });
        }

        const investmentAmount =
            Number(amount);

        if (
            !Number.isFinite(investmentAmount) ||
            investmentAmount < 1 ||
            investmentAmount > 9999
        ) {
            return res.status(400).json({
                ok: false,
                message: 'Yatırım tutarı $1 - $9,999 arasında olmalıdır.'
            });
        }

        const telegramId =
            Number(telegram.user.id);

        const userResult =
            await pool.query(
                `
                SELECT id
                FROM users
                WHERE telegram_id = $1
                LIMIT 1
                `,
                [telegramId]
            );

        if (userResult.rowCount === 0) {
            return res.status(404).json({
                ok: false,
                message: 'Kullanıcı bulunamadı.'
            });
        }

        const userId =
            userResult.rows[0].id;

        const result =
            await pool.query(
                `
                INSERT INTO investments
                (
                    user_id,
                    amount,
                    package_name,
                    status,
                    created_at
                )
                VALUES
                ($1,$2,$3,'pending',NOW())
                RETURNING
                    id,
                    user_id,
                    amount,
                    package_name,
                    status,
                    created_at
                `,
                [
                    userId,
                    investmentAmount,
                    packageName || null
                ]
            );
await sendAdminTelegramMessage(
    `💰 <b>YENİ YATIRIM TALEBİ</b>\n\n` +
    `👤 Kullanıcı: <b>${escapeTelegramHtml(telegram.user.first_name || 'User')}</b>\n` +
    `📱 Telegram ID: <code>${telegramId}</code>\n` +
    `💵 Tutar: <b>$${investmentAmount.toFixed(2)}</b>\n` +
    `📦 Paket: <b>${escapeTelegramHtml(packageName || '-')}</b>\n` +
    `🆔 Yatırım ID: <code>${result.rows[0].id}</code>\n` +
    `⏳ Durum: <b>BEKLEMEDE</b>`
);
        res.json({
            ok: true,
            investment: result.rows[0]
        });

    } catch (error) {

        console.error(
            'Investment create error:',
            error
        );

        res.status(500).json({
            ok: false,
            message: error.message
        });
    }
});

/* =====================================================
   KULLANICI - ÇEKİM OLUŞTUR
===================================================== */

app.post('/api/withdrawal', async (req, res) => {

    const client =
        await pool.connect();

    try {

        const {
            initData,
            amount,
            crypto,
            cryptoAmount,
            walletAddress,
            network
        } = req.body;

        const telegram =
            validateTelegramInitData(initData);

        if (!telegram.valid) {
            return res.status(401).json({
                ok: false,
                message: telegram.error
            });
        }

        const withdrawalAmount =
            Number(amount);

        if (
            !Number.isFinite(withdrawalAmount) ||
            withdrawalAmount < 0.25
        ) {
            return res.status(400).json({
                ok: false,
                message: 'Minimum çekim $0.25 olmalıdır.'
            });
        }

        if (!walletAddress) {
            return res.status(400).json({
                ok: false,
                message: 'Cüzdan adresi gerekli.'
            });
        }

        const telegramId =
            Number(telegram.user.id);

        await client.query('BEGIN');

        const userResult =
            await client.query(
                `
                SELECT
                    id,
                    balance
                FROM users
                WHERE telegram_id = $1
                FOR UPDATE
                `,
                [telegramId]
            );

        if (userResult.rowCount === 0) {

            await client.query('ROLLBACK');

            return res.status(404).json({
                ok: false,
                message: 'Kullanıcı bulunamadı.'
            });
        }

        const user =
            userResult.rows[0];

        const currentBalance =
            Number(user.balance || 0);

        if (withdrawalAmount > currentBalance) {

            await client.query('ROLLBACK');

            return res.status(400).json({
                ok: false,
                message: 'Yetersiz bakiye.'
            });
        }

        const result =
            await client.query(
                `
                INSERT INTO withdrawals
                (
                    user_id,
                    amount,
                    crypto,
                    crypto_amount,
                    wallet_address,
                    network,
                    status,
                    created_at
                )
                VALUES
                ($1,$2,$3,$4,$5,$6,'pending',NOW())
                RETURNING
                    id,
                    user_id,
                    amount,
                    crypto,
                    crypto_amount,
                    wallet_address,
                    network,
                    status,
                    created_at
                `,
                [
                    user.id,
                    withdrawalAmount,
                    crypto || 'trx',
                    Number(cryptoAmount || 0),
                    walletAddress,
                    network || 'TRON (TRC20)'
                ]
            );

        /*
         * Çekim talebi oluştuğunda tutarı
         * bakiyeden rezerve ediyoruz.
         */
        const newBalance =
            currentBalance - withdrawalAmount;

        await client.query(
            `
            UPDATE users
            SET
                balance = $1,
                last_active = NOW()
            WHERE id = $2
            `,
            [
                newBalance,
                user.id
            ]
        );

        await client.query(
            `
            INSERT INTO transactions
            (
                user_id,
                type,
                amount,
                reference_id,
                description
            )
            VALUES
            (
                $1,
                'withdrawal_requested',
                $2,
                $3,
                'Çekim talebi oluşturuldu'
            )
            `,
            [
                user.id,
                withdrawalAmount,
                result.rows[0].id
            ]
        );

        await client.query('COMMIT');

await sendAdminTelegramMessage(
    `💸 <b>YENİ ÇEKİM TALEBİ</b>\n\n` +
    `👤 Telegram ID: <code>${telegramId}</code>\n` +
    `💵 Tutar: <b>$${withdrawalAmount.toFixed(2)}</b>\n` +
    `🪙 Coin: <b>${escapeTelegramHtml(crypto || 'TRX')}</b>\n` +
    `🔹 Miktar: <b>${escapeTelegramHtml(cryptoAmount || '0')}</b>\n` +
    `🌐 Ağ: <b>${escapeTelegramHtml(network || 'TRON (TRC20)')}</b>\n` +
    `👛 Cüzdan: <code>${escapeTelegramHtml(walletAddress)}</code>\n` +
    `🆔 Çekim ID: <code>${result.rows[0].id}</code>\n` +
    `⏳ Durum: <b>BEKLEMEDE</b>`
);

        res.json({
            ok: true,
            withdrawal: result.rows[0],
            balance: newBalance
        });

    } catch (error) {

        await client.query('ROLLBACK');

        console.error(
            'Withdrawal create error:',
            error
        );

        res.status(500).json({
            ok: false,
            message: error.message
        });

    } finally {

        client.release();
    }
});

/* =====================================================
   ADMIN - KULLANICILAR
===================================================== */

app.get('/api/admin/users', async (req, res) => {

    if (!requireAdmin(req, res)) return;

    try {

        const result =
            await pool.query(`
                SELECT
                    id,
                    telegram_id,
                    username,
                    first_name,
                    language,
                    balance,
                    total_invested,
                    total_withdrawn,
                    referral_earnings,
                    created_at,
                    last_active
                FROM users
                ORDER BY id DESC
            `);

        res.json({
            ok: true,
            users: result.rows
        });

    } catch (error) {

        console.error(
            'Admin users error:',
            error
        );

        res.status(500).json({
            ok: false,
            message: error.message
        });
    }
});

/* =====================================================
   ADMIN - YATIRIMLAR
===================================================== */

app.get('/api/admin/investments', async (req, res) => {

    if (!requireAdmin(req, res)) return;

    try {

        const result =
            await pool.query(`
                SELECT
                    i.id,
                    i.user_id,
                    i.amount,
                    i.package_name,
                    i.status,
                    i.created_at,
                    i.approved_at,
                    u.telegram_id,
                    u.username,
                    u.first_name
                FROM investments i
                JOIN users u
                    ON u.id = i.user_id
                ORDER BY i.id DESC
            `);

        res.json({
            ok: true,
            investments: result.rows
        });

    } catch (error) {

        console.error(
            'Admin investments error:',
            error
        );

        res.status(500).json({
            ok: false,
            message: error.message
        });
    }
});

/* =====================================================
   ADMIN - ÇEKİMLER
===================================================== */

app.get('/api/admin/withdrawals', async (req, res) => {

    if (!requireAdmin(req, res)) return;

    try {

        const result =
            await pool.query(`
                SELECT
                    w.id,
                    w.user_id,
                    w.amount,
                    w.crypto,
                    w.crypto_amount,
                    w.wallet_address,
                    w.network,
                    w.status,
                    w.created_at,
                    u.telegram_id,
                    u.username,
                    u.first_name
                FROM withdrawals w
                JOIN users u
                    ON u.id = w.user_id
                ORDER BY w.id DESC
            `);

        res.json({
            ok: true,
            withdrawals: result.rows
        });

    } catch (error) {

        console.error(
            'Admin withdrawals error:',
            error
        );

        res.status(500).json({
            ok: false,
            message: error.message
        });
    }
});

/* =====================================================
   ADMIN - DEMO BAKİYE
===================================================== */

app.post(
    '/api/admin/users/:id/balance',
    async (req, res) => {

        if (!requireAdmin(req, res)) return;

        const client =
            await pool.connect();

        try {

            const userId =
                Number(req.params.id);

            const amount =
                Number(req.body.amount);

            const operation =
                req.body.operation;

            if (
                !Number.isInteger(userId) ||
                userId <= 0
            ) {
                return res.status(400).json({
                    ok: false,
                    message: 'Geçersiz kullanıcı ID'
                });
            }

            if (
                !Number.isFinite(amount) ||
                amount <= 0
            ) {
                return res.status(400).json({
                    ok: false,
                    message: 'Geçersiz tutar'
                });
            }

            if (
                operation !== 'add' &&
                operation !== 'remove'
            ) {
                return res.status(400).json({
                    ok: false,
                    message: 'Geçersiz işlem'
                });
            }

            await client.query('BEGIN');

            const userResult =
                await client.query(
                    `
                    SELECT
                        id,
                        balance
                    FROM users
                    WHERE id = $1
                    FOR UPDATE
                    `,
                    [userId]
                );

            if (userResult.rowCount === 0) {

                await client.query('ROLLBACK');

                return res.status(404).json({
                    ok: false,
                    message: 'Kullanıcı bulunamadı'
                });
            }

            const oldBalance =
                Number(
                    userResult.rows[0].balance || 0
                );

            let newBalance;

            if (operation === 'add') {

                newBalance =
                    oldBalance + amount;

            } else {

                newBalance =
                    oldBalance - amount;

                if (newBalance < 0) {

                    await client.query('ROLLBACK');

                    return res.status(400).json({
                        ok: false,
                        message:
                            'Bakiye negatife düşemez'
                    });
                }
            }

            await client.query(
                `
                UPDATE users
                SET
                    balance = $1,
                    last_active = NOW()
                WHERE id = $2
                `,
                [
                    newBalance,
                    userId
                ]
            );

            await client.query(
                `
                INSERT INTO transactions
                (
                    user_id,
                    type,
                    amount,
                    description
                )
                VALUES
                ($1,$2,$3,$4)
                `,
                [
                    userId,
                    operation === 'add'
                        ? 'admin_demo_credit'
                        : 'admin_demo_debit',
                    amount,
                    operation === 'add'
                        ? 'Admin demo bakiye ekledi'
                        : 'Admin demo bakiye düşürdü'
                ]
            );

            await client.query('COMMIT');

            res.json({
                ok: true,
                userId,
                oldBalance:
                    oldBalance.toFixed(8),
                newBalance:
                    newBalance.toFixed(8)
            });

        } catch (error) {

            await client.query('ROLLBACK');

            console.error(
                'Admin balance error:',
                error
            );

            res.status(500).json({
                ok: false,
                message: error.message
            });

        } finally {

            client.release();
        }
    }
);

/* =====================================================
   ADMIN - YATIRIM ONAY
===================================================== */

app.post(
    '/api/admin/investments/:id/approve',
    async (req, res) => {

        if (!requireAdmin(req, res)) return;

        const client =
            await pool.connect();

        try {

            const investmentId =
                Number(req.params.id);

            await client.query('BEGIN');

            const result =
                await client.query(
                    `
                    SELECT
    i.id,
    i.user_id,
    i.amount,
    i.status,
    u.telegram_id,
    u.first_name,
    u.username
FROM investments i
JOIN users u
    ON u.id = i.user_id
WHERE i.id = $1
FOR UPDATE
                    `,
                    [investmentId]
                );

            if (result.rowCount === 0) {

                await client.query('ROLLBACK');

                return res.status(404).json({
                    ok: false,
                    message: 'Yatırım bulunamadı'
                });
            }

            const investment =
                result.rows[0];

            if (
                investment.status !== 'pending'
            ) {

                await client.query('ROLLBACK');

                return res.status(400).json({
                    ok: false,
                    message:
                        'Yatırım zaten işlenmiş'
                });
            }

            const amount =
                Number(investment.amount);

            await client.query(
                `
                UPDATE investments
                SET
                    status = 'approved',
                    approved_at = NOW()
                WHERE id = $1
                `,
                [investmentId]
            );

            await client.query(
                `
                UPDATE users
                SET
                    total_invested =
                        total_invested + $1,
                    last_active = NOW()
                WHERE id = $2
                `,
                [
                    amount,
                    investment.user_id
                ]
            );

            await client.query(
                `
                INSERT INTO transactions
                (
                    user_id,
                    type,
                    amount,
                    reference_id,
                    description
                )
                VALUES
                (
                    $1,
                    'investment_approved',
                    $2,
                    $3,
                    'Demo yatırım onaylandı'
                )
                `,
                [
                    investment.user_id,
                    amount,
                    investmentId
                ]
            );

            await client.query('COMMIT');

const notifyUrl =
    NOTIFY_BOT_USERNAME
        ? `https://t.me/${NOTIFY_BOT_USERNAME}?start=alerts`
        : 'https://t.me/hashmining_notify_bot?start=alerts';

await sendUserTelegramMessage(
    investment.telegram_id,

    `✅ <b>YATIRIMINIZ ONAYLANDI</b>\n\n` +
    `💰 Yatırım tutarı: <b>$${amount.toFixed(2)}</b>\n` +
    `⏱️ Yatırımınız aktif edildi ve üretiminiz başladı.\n\n` +
    `🔔 Detaylar ve bildirimler için Alerts botunu açın.`,

    {
        inline_keyboard: [
            [
                {
                    text: '🔔 Alerts',
                    url: notifyUrl
                }
            ]
        ]
    }
);

            res.json({
                ok: true,
                message:
                    ' yatırım onaylandı'
            });

        } catch (error) {

            await client.query('ROLLBACK');

            console.error(
                'Investment approve error:',
                error
            );

            res.status(500).json({
                ok: false,
                message: error.message
            });

        } finally {

            client.release();
        }
    }
);

/* =====================================================
   ADMIN - YATIRIM RED
===================================================== */

app.post(
    '/api/admin/investments/:id/reject',
    async (req, res) => {

        if (!requireAdmin(req, res)) return;

        try {

            const investmentId =
                Number(req.params.id);

            const result =
                await pool.query(
                    `
                    UPDATE investments
                    SET
                        status = 'rejected'
                    WHERE id = $1
                      AND status = 'pending'
                    RETURNING
                        id,
                        user_id,
                        amount
                    `,
                    [investmentId]
                );

            if (result.rowCount === 0) {

                return res.status(404).json({
                    ok: false,
                    message:
                        'Bekleyen yatırım bulunamadı'
                });
            }

            res.json({
                ok: true,
                message:
                    'Demo yatırım reddedildi'
            });

        } catch (error) {

            console.error(
                'Investment reject error:',
                error
            );

            res.status(500).json({
                ok: false,
                message: error.message
            });
        }
    }
);

/* =====================================================
   ADMIN - ÇEKİM ONAY
===================================================== */

app.post(
    '/api/admin/withdrawals/:id/approve',
    async (req, res) => {

        if (!requireAdmin(req, res)) return;

        const client =
            await pool.connect();

        try {

            const withdrawalId =
                Number(req.params.id);

            await client.query('BEGIN');

            const result =
                await client.query(
                    `
                  SELECT
    w.id,
    w.user_id,
    w.amount,
    w.crypto,
    w.network,
    w.status,
    u.telegram_id,
    u.first_name,
    u.username
FROM withdrawals w
JOIN users u
    ON u.id = w.user_id
WHERE w.id = $1
FOR UPDATE
                    `,
                    [withdrawalId]
                );

            if (result.rowCount === 0) {

                await client.query('ROLLBACK');

                return res.status(404).json({
                    ok: false,
                    message:
                        'Çekim bulunamadı'
                });
            }

            const withdrawal =
                result.rows[0];

            if (
                withdrawal.status !== 'pending'
            ) {

                await client.query('ROLLBACK');

                return res.status(400).json({
                    ok: false,
                    message:
                        'Çekim zaten işlenmiş'
                });
            }

            const amount =
                Number(withdrawal.amount);

            await client.query(
                `
                UPDATE withdrawals
                SET
                    status = 'approved'
                WHERE id = $1
                `,
                [withdrawalId]
            );

            await client.query(
                `
                UPDATE users
                SET
                    total_withdrawn =
                        total_withdrawn + $1,
                    last_active = NOW()
                WHERE id = $2
                `,
                [
                    amount,
                    withdrawal.user_id
                ]
            );

            await client.query(
                `
                INSERT INTO transactions
                (
                    user_id,
                    type,
                    amount,
                    reference_id,
                    description
                )
                VALUES
                (
                    $1,
                    'withdrawal_approved',
                    $2,
                    $3,
                    'Demo çekim onaylandı'
                )
                `,
                [
                    withdrawal.user_id,
                    amount,
                    withdrawalId
                ]
            );

            await client.query('COMMIT');
const notifyUrl =
    NOTIFY_BOT_USERNAME
        ? `https://t.me/${NOTIFY_BOT_USERNAME}?start=alerts`
        : 'https://t.me/hashmining_notify_bot?start=alerts';

await sendUserTelegramMessage(
    withdrawal.telegram_id,

    `✅ <b>ÇEKİM TALEBİNİZ ONAYLANDI</b>\n\n` +
    `💸 Tutar: <b>$${amount.toFixed(2)}</b>\n` +
    `🪙 Coin: <b>${escapeTelegramHtml(withdrawal.crypto || 'TRX')}</b>\n` +
    `🌐 Ağ: <b>${escapeTelegramHtml(withdrawal.network || 'TRON (TRC20)')}</b>\n\n` +
    `✅ Çekim işleminiz onaylandı.\n\n` +
    `🔔 Detaylar için Alerts botunu açın.`,

    {
        inline_keyboard: [
            [
                {
                    text: '🔔 Alerts',
                    url: notifyUrl
                }
            ]
        ]
    }
);

            res.json({
                ok: true,
                message:
                    ' çekim onaylandı'
            });

        } catch (error) {

            await client.query('ROLLBACK');

            console.error(
                'Withdrawal approve error:',
                error
            );

            res.status(500).json({
                ok: false,
                message: error.message
            });

        } finally {

            client.release();
        }
    }
);

/* =====================================================
   ADMIN - ÇEKİM RED
===================================================== */

app.post(
    '/api/admin/withdrawals/:id/reject',
    async (req, res) => {

        if (!requireAdmin(req, res)) return;

        const client =
            await pool.connect();

        try {

            const withdrawalId =
                Number(req.params.id);

            await client.query('BEGIN');

            const result =
                await client.query(
                    `
                    SELECT
                        id,
                        user_id,
                        amount,
                        status
                    FROM withdrawals
                    WHERE id = $1
                    FOR UPDATE
                    `,
                    [withdrawalId]
                );

            if (result.rowCount === 0) {

                await client.query('ROLLBACK');

                return res.status(404).json({
                    ok: false,
                    message:
                        'Çekim bulunamadı'
                });
            }

            const withdrawal =
                result.rows[0];

            if (
                withdrawal.status !== 'pending'
            ) {

                await client.query('ROLLBACK');

                return res.status(400).json({
                    ok: false,
                    message:
                        'Çekim zaten işlenmiş'
                });
            }

            const amount =
                Number(withdrawal.amount);

            await client.query(
                `
                UPDATE withdrawals
                SET
                    status = 'rejected'
                WHERE id = $1
                `,
                [withdrawalId]
            );

            /*
             * Çekim reddedildiğinde daha önce
             * rezerve edilen tutarı geri ver.
             */
            await client.query(
                `
                UPDATE users
                SET
                    balance = balance + $1,
                    last_active = NOW()
                WHERE id = $2
                `,
                [
                    amount,
                    withdrawal.user_id
                ]
            );

            await client.query(
                `
                INSERT INTO transactions
                (
                    user_id,
                    type,
                    amount,
                    reference_id,
                    description
                )
                VALUES
                (
                    $1,
                    'withdrawal_rejected',
                    $2,
                    $3,
                    'Demo çekim reddedildi ve bakiye iade edildi'
                )
                `,
                [
                    withdrawal.user_id,
                    amount,
                    withdrawalId
                ]
            );

            await client.query('COMMIT');

            res.json({
                ok: true,
                message:
                    'Demo çekim reddedildi ve bakiye iade edildi'
            });

        } catch (error) {

            await client.query('ROLLBACK');

            console.error(
                'Withdrawal reject error:',
                error
            );

            res.status(500).json({
                ok: false,
                message: error.message
            });

        } finally {

            client.release();
        }
    }
);

/* =====================================================
   ANA SAYFA
===================================================== */

app.get('/', (req, res) => {
    res.sendFile(
        path.join(__dirname, 'index.html')
    );
});

/* =====================================================
   SERVER
===================================================== */

const PORT =
    Number(process.env.PORT || 3000);

loadNotifyBotUsername();

ensureCryptoPricesTable()
    .then(() => {
        console.log('✅ PostgreSQL crypto_prices tablosu hazır');
    })
    .catch((error) => {
        console.error('❌ crypto_prices tablo hazırlama hatası:', error);
    });
const { installGameCenter } = require('./server_gamecenter_addon');

installGameCenter({
    app,
    pool,
    validateTelegramInitData
});
app.listen(PORT, () => {

    console.log('');
    console.log('======================================');
    console.log('✅ Micro Monetize Server');
    console.log(`✅ http://localhost:${PORT}`);
    console.log('✅ PostgreSQL bağlantısı hazır');
    console.log('✅ Admin API hazır');
    console.log('======================================');
    console.log('');
});
