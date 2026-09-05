/*
 * GAME CENTER SERVER ADD-ON
 *
 * This file does NOT start a second server.
 * It installs routes into the existing Express app and uses the existing pg pool.
 *
 * Integration in existing server.js:
 *
 * const { installGameCenter } = require('./server_gamecenter_addon');
 * installGameCenter({ app, pool, validateTelegramInitData });
 *
 * Put the call AFTER app, pool and validateTelegramInitData are defined.
 */

const crypto = require('crypto');

const GAMES = new Set([
  'gold_rush',
  'crystal_hunt',
  'miner_run',
  'treasure_cave',
  'minesweeper'
]);

const PER_GAME_LIMIT = 0.001;
const GLOBAL_DAILY_LIMIT = 0.01;
const MIN_SESSION_SECONDS = 28;
const SESSION_TTL_SECONDS = 90;
const TRANSFER_BLOCK = 0.01;

function money(v) {
  return Number(Number(v || 0).toFixed(8));
}

function jsonError(res, status, message) {
  return res.status(status).json({ ok: false, message });
}

async function installGameCenter({ app, pool, validateTelegramInitData }) {
  if (!app || !pool || typeof validateTelegramInitData !== 'function') {
    throw new Error('Game Center add-on: app, pool ve validateTelegramInitData gerekli.');
  }

  async function auth(req, res) {
    const initData = req.get('x-telegram-init-data') || req.body?.initData;
    if (!initData) {
      jsonError(res, 401, 'Telegram doğrulaması gerekli.');
      return null;
    }

    const telegram = validateTelegramInitData(initData);
    if (!telegram || !telegram.valid || !telegram.user?.id) {
      jsonError(res, 401, telegram?.error || 'Geçersiz Telegram oturumu.');
      return null;
    }

    const telegramId = Number(telegram.user.id);
    if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
      jsonError(res, 401, 'Geçersiz Telegram kullanıcı kimliği.');
      return null;
    }

    const user = await pool.query(
      `SELECT id, telegram_id FROM users WHERE telegram_id = $1 LIMIT 1`,
      [telegramId]
    );

    if (!user.rowCount) {
      jsonError(res, 404, 'Kullanıcı bulunamadı.');
      return null;
    }

    return { telegramId, userId: user.rows[0].id };
  }

  async function ensureWallet(client, userId) {
    await client.query(
      `INSERT INTO game_center_wallets (user_id)
       VALUES ($1)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    );

    const wallet = await client.query(
      `SELECT id, balance, today_earned, day_date
       FROM game_center_wallets
       WHERE user_id = $1
       FOR UPDATE`,
      [userId]
    );

    const row = wallet.rows[0];
    const reset = await client.query(
      `UPDATE game_center_wallets
       SET today_earned = 0, day_date = CURRENT_DATE, updated_at = NOW()
       WHERE id = $1 AND day_date <> CURRENT_DATE
       RETURNING today_earned, day_date`,
      [row.id]
    );
    if (reset.rowCount) {
      row.today_earned = reset.rows[0].today_earned;
      row.day_date = reset.rows[0].day_date;
    }

    return row;
  }

  app.get('/api/game-center/health', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ ok: true, service: 'game-center' });
    } catch (error) {
      console.error('Game Center health:', error);
      res.status(500).json({ ok: false, message: 'Game Center veritabanı kullanılamıyor.' });
    }
  });

  app.post('/api/game-center/start', async (req, res) => {
    try {
      const identity = await auth(req, res);
      if (!identity) return;

      const game = String(req.body?.game || '');
      if (!GAMES.has(game)) return jsonError(res, 400, 'Geçersiz oyun.');

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const wallet = await ensureWallet(client, identity.userId);

        if (money(wallet.today_earned) >= GLOBAL_DAILY_LIMIT) {
          await client.query('ROLLBACK');
          return jsonError(res, 429, 'Game Center günlük limiti doldu.');
        }

        const gameUsage = await client.query(
          `SELECT COALESCE(SUM(awarded_amount),0) AS earned
           FROM game_center_earnings
           WHERE user_id=$1 AND game_key=$2 AND earned_date=CURRENT_DATE`,
          [identity.userId, game]
        );

        if (money(gameUsage.rows[0].earned) >= PER_GAME_LIMIT) {
          await client.query('ROLLBACK');
          return jsonError(res, 429, 'Bu oyunun günlük limiti doldu.');
        }

        const sessionId = crypto.randomUUID();
        await client.query(
          `INSERT INTO game_center_sessions
             (session_id,user_id,game_key,started_at,expires_at)
           VALUES ($1,$2,$3,NOW(),NOW()+($4 || ' seconds')::interval)`,
          [sessionId, identity.userId, game, SESSION_TTL_SECONDS]
        );

        await client.query('COMMIT');
        res.json({ ok: true, sessionId, minSeconds: MIN_SESSION_SECONDS });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Game Center start:', error);
      res.status(500).json({ ok: false, message: 'Oyun oturumu başlatılamadı.' });
    }
  });

  app.post('/api/game-center/complete', async (req, res) => {
    try {
      const identity = await auth(req, res);
      if (!identity) return;

      const game = String(req.body?.game || '');
      const sessionId = String(req.body?.sessionId || '');
      let requested = Number(req.body?.amount);

      if (!GAMES.has(game)) return jsonError(res, 400, 'Geçersiz oyun.');
      if (!/^[0-9a-f-]{36}$/i.test(sessionId)) return jsonError(res, 400, 'Geçersiz oyun oturumu.');
      if (!Number.isFinite(requested) || requested <= 0) return jsonError(res, 400, 'Geçersiz ödül.');

      requested = Math.min(requested, PER_GAME_LIMIT);

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const sessionResult = await client.query(
          `SELECT session_id, game_key, started_at, expires_at, completed_at
           FROM game_center_sessions
           WHERE session_id=$1 AND user_id=$2
           FOR UPDATE`,
          [sessionId, identity.userId]
        );

        if (!sessionResult.rowCount) {
          await client.query('ROLLBACK');
          return jsonError(res, 404, 'Oyun oturumu bulunamadı.');
        }

        const session = sessionResult.rows[0];
        if (session.game_key !== game) {
          await client.query('ROLLBACK');
          return jsonError(res, 400, 'Oyun oturumu uyuşmuyor.');
        }
        if (session.completed_at) {
          await client.query('ROLLBACK');
          return jsonError(res, 409, 'Bu oyun oturumu zaten kullanıldı.');
        }
        if (new Date(session.expires_at).getTime() < Date.now()) {
          await client.query('ROLLBACK');
          return jsonError(res, 410, 'Oyun oturumu süresi doldu.');
        }

        const elapsed = (Date.now() - new Date(session.started_at).getTime()) / 1000;
        if (elapsed < MIN_SESSION_SECONDS) {
          await client.query('ROLLBACK');
          return jsonError(res, 429, 'Oyun henüz tamamlanabilecek süreye ulaşmadı.');
        }

        const wallet = await ensureWallet(client, identity.userId);
        const globalRoom = Math.max(0, GLOBAL_DAILY_LIMIT - money(wallet.today_earned));

        const gameUsage = await client.query(
          `SELECT COALESCE(SUM(awarded_amount),0) AS earned
           FROM game_center_earnings
           WHERE user_id=$1 AND game_key=$2 AND earned_date=CURRENT_DATE`,
          [identity.userId, game]
        );
        const gameRoom = Math.max(0, PER_GAME_LIMIT - money(gameUsage.rows[0].earned));
        const awarded = Math.min(requested, globalRoom, gameRoom);

        await client.query(
          `UPDATE game_center_sessions
           SET completed_at=NOW()
           WHERE session_id=$1`,
          [sessionId]
        );

        await client.query(
          `INSERT INTO game_center_earnings
             (user_id,game_key,session_id,requested_amount,awarded_amount,earned_date)
           VALUES ($1,$2,$3,$4,$5,CURRENT_DATE)`,
          [identity.userId, game, sessionId, requested, awarded]
        );

        await client.query(
          `UPDATE game_center_wallets
           SET balance=balance+$1,
               today_earned=today_earned+$1,
               updated_at=NOW()
           WHERE user_id=$2`,
          [awarded, identity.userId]
        );

        const finalWallet = await client.query(
          `SELECT balance,today_earned FROM game_center_wallets WHERE user_id=$1`,
          [identity.userId]
        );

        await client.query('COMMIT');

        res.json({
          ok: true,
          awarded: money(awarded).toFixed(8),
          balance: money(finalWallet.rows[0].balance).toFixed(8),
          today: money(finalWallet.rows[0].today_earned).toFixed(8)
        });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Game Center complete:', error);
      res.status(500).json({ ok: false, message: 'Oyun ödülü kaydedilemedi.' });
    }
  });

  app.get('/api/game-center/balance', async (req, res) => {
    try {
      const identity = await auth(req, res);
      if (!identity) return;

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const wallet = await ensureWallet(client, identity.userId);
        await client.query('COMMIT');
        res.json({
          ok: true,
          balance: money(wallet.balance).toFixed(8),
          today: money(wallet.today_earned).toFixed(8),
          dailyLimit: GLOBAL_DAILY_LIMIT.toFixed(8)
        });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Game Center balance:', error);
      res.status(500).json({ ok: false, message: 'Cüzdan okunamadı.' });
    }
  });

  app.post('/api/game-center/transfer', async (req, res) => {
    const client = await pool.connect();
    try {
      const identity = await auth(req, res);
      if (!identity) return;

      await client.query('BEGIN');
      const wallet = await ensureWallet(client, identity.userId);
      const transferable = Math.floor((money(wallet.balance) + 1e-10) / TRANSFER_BLOCK) * TRANSFER_BLOCK;

      if (transferable < TRANSFER_BLOCK) {
        await client.query('ROLLBACK');
        return jsonError(res, 400, 'Transfer için en az $0.01 gerekli.');
      }

      const userResult = await client.query(
        `SELECT id,total_invested FROM users WHERE id=$1 FOR UPDATE`,
        [identity.userId]
      );
      if (!userResult.rowCount) {
        await client.query('ROLLBACK');
        return jsonError(res, 404, 'Kullanıcı bulunamadı.');
      }

      const amount = Number(transferable.toFixed(8));
      const packageName = 'GAME CENTER';

      // Existing investments table is used by the main system.
      // Keep this row as an investment and record the source in transactions.
      const investment = await client.query(
        `INSERT INTO investments
          (user_id, amount, package_name, status, approved_at)
         VALUES ($1,$2,$3,'approved',NOW())
         RETURNING id`,
        [identity.userId, amount, packageName]
      );

      await client.query(
        `UPDATE game_center_wallets
         SET balance=balance-$1, updated_at=NOW()
         WHERE user_id=$2 AND balance >= $1`,
        [amount, identity.userId]
      );

      await client.query(
        `UPDATE users
         SET total_invested=total_invested+$1, last_active=NOW()
         WHERE id=$2`,
        [amount, identity.userId]
      );

      await client.query(
        `INSERT INTO transactions (user_id,type,amount,description)
         VALUES ($1,'game_investment',$2,'Game Center kazancı yatırımı')`,
        [identity.userId, amount]
      );

      const after = await client.query(
        `SELECT balance FROM game_center_wallets WHERE user_id=$1`,
        [identity.userId]
      );

      await client.query('COMMIT');

      res.json({
        ok: true,
        amount: amount.toFixed(8),
        investmentId: investment.rows[0].id,
        balance: money(after.rows[0].balance).toFixed(8)
      });
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      console.error('Game Center transfer:', error);
      res.status(500).json({ ok: false, message: 'Game Center transferi başarısız.' });
    } finally {
      client.release();
    }
  });

  /* =====================================================
     ADMIN — GAME CENTER KAZANÇLARI
     Admin paneli /api/admin/game-center/earnings endpoint'ini
     mevcut PostgreSQL Game Center şemasına göre sağlar.
  ===================================================== */
  app.get('/api/admin/game-center/earnings', async (req, res) => {
    const configuredKey = process.env.ADMIN_PANEL_KEY;
    const suppliedKey = String(req.headers['x-admin-key'] || '');

    if (!configuredKey) {
      return res.status(500).json({
        ok: false,
        message: 'ADMIN_PANEL_KEY .env içinde bulunamadı.'
      });
    }

    if (!suppliedKey) {
      return res.status(401).json({
        ok: false,
        message: 'Admin anahtarı gerekli.'
      });
    }

    const a = Buffer.from(suppliedKey);
    const b = Buffer.from(configuredKey);

    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(403).json({
        ok: false,
        message: 'Yetkisiz admin erişimi.'
      });
    }

    try {
      const summaryResult = await pool.query(`
        SELECT
          COALESCE((SELECT SUM(balance) FROM game_center_wallets), 0) AS pending_total,
          COALESCE((SELECT SUM(awarded_amount) FROM game_center_earnings), 0) AS lifetime_earned,
          COALESCE((
            SELECT SUM(amount)
            FROM transactions
            WHERE type = 'game_investment'
          ), 0) AS total_transferred,
          (SELECT COUNT(*) FROM game_center_wallets) AS users
      `);

      const usersResult = await pool.query(`
        SELECT
          u.id,
          u.telegram_id,
          u.username,
          u.first_name,
          COALESCE(w.balance, 0) AS pending_amount,
          COALESCE((
            SELECT SUM(e.awarded_amount)
            FROM game_center_earnings e
            WHERE e.user_id = u.id
              AND e.earned_date = CURRENT_DATE
          ), 0) AS today_earned,
          COALESCE((
            SELECT SUM(e.awarded_amount)
            FROM game_center_earnings e
            WHERE e.user_id = u.id
          ), 0) AS lifetime_earned,
          COALESCE((
            SELECT SUM(t.amount)
            FROM transactions t
            WHERE t.user_id = u.id
              AND t.type = 'game_investment'
          ), 0) AS total_transferred
        FROM game_center_wallets w
        JOIN users u ON u.id = w.user_id
        ORDER BY w.balance DESC, u.id ASC
      `);

      const gamesResult = await pool.query(`
        SELECT
          game_key AS game,
          COUNT(*)::int AS plays,
          COALESCE(SUM(awarded_amount), 0) AS amount
        FROM game_center_earnings
        GROUP BY game_key
        ORDER BY amount DESC, game_key ASC
      `);

      const summary = summaryResult.rows[0] || {};

      return res.json({
        ok: true,
        summary: {
          pending_total: money(summary.pending_total),
          lifetime_earned: money(summary.lifetime_earned),
          total_transferred: money(summary.total_transferred),
          users: Number(summary.users || 0)
        },
        users: usersResult.rows.map(row => ({
          id: row.id,
          telegram_id: row.telegram_id,
          username: row.username,
          first_name: row.first_name,
          pending_amount: money(row.pending_amount),
          today_earned: money(row.today_earned),
          lifetime_earned: money(row.lifetime_earned),
          total_transferred: money(row.total_transferred)
        })),
        games: gamesResult.rows.map(row => ({
          game: row.game,
          plays: Number(row.plays || 0),
          amount: money(row.amount)
        }))
      });
    } catch (error) {
      console.error('Game Center admin earnings:', error);
      return res.status(500).json({
        ok: false,
        message: 'Game Center admin verileri okunamadı.'
      });
    }
  });

  console.log('🎮 Game Center güvenli API eklendi.');
}

module.exports = { installGameCenter };
