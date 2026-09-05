-- Game Center PostgreSQL security layer
-- Database: telegram_game

CREATE TABLE IF NOT EXISTS game_center_wallets (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    balance NUMERIC(20,8) NOT NULL DEFAULT 0,
    today_earned NUMERIC(20,8) NOT NULL DEFAULT 0,
    day_date DATE NOT NULL DEFAULT CURRENT_DATE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT gc_wallet_balance_nonnegative CHECK (balance >= 0),
    CONSTRAINT gc_wallet_today_nonnegative CHECK (today_earned >= 0),
    CONSTRAINT gc_wallet_today_limit CHECK (today_earned <= 0.01000000)
);

CREATE TABLE IF NOT EXISTS game_center_earnings (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    game_key TEXT NOT NULL,
    session_id UUID NOT NULL UNIQUE,
    requested_amount NUMERIC(20,8) NOT NULL DEFAULT 0,
    awarded_amount NUMERIC(20,8) NOT NULL DEFAULT 0,
    earned_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT gc_earning_requested_nonnegative CHECK (requested_amount >= 0),
    CONSTRAINT gc_earning_awarded_nonnegative CHECK (awarded_amount >= 0),
    CONSTRAINT gc_game_key CHECK (
        game_key IN ('gold_rush','crystal_hunt','miner_run','treasure_cave','minesweeper')
    )
);

CREATE INDEX IF NOT EXISTS idx_gc_earnings_user_date
    ON game_center_earnings(user_id, earned_date);

CREATE INDEX IF NOT EXISTS idx_gc_earnings_game_date
    ON game_center_earnings(user_id, game_key, earned_date);

CREATE TABLE IF NOT EXISTS game_center_sessions (
    session_id UUID PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    game_key TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    CONSTRAINT gc_session_game_key CHECK (
        game_key IN ('gold_rush','crystal_hunt','miner_run','treasure_cave','minesweeper')
    )
);

CREATE INDEX IF NOT EXISTS idx_gc_sessions_user
    ON game_center_sessions(user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_gc_sessions_expiry
    ON game_center_sessions(expires_at);
