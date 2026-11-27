CREATE TABLE IF NOT EXISTS mac_stamp_cards (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS mac_stamp_entries (
  card_id TEXT NOT NULL REFERENCES mac_stamp_cards(id),
  season INTEGER NOT NULL,
  booking TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('event', 'referral')),
  extras INTEGER NOT NULL CHECK (extras >= 0),
  PRIMARY KEY (booking, kind)
);
CREATE INDEX IF NOT EXISTS mac_stamp_card_season ON mac_stamp_entries(card_id, season);

CREATE TABLE IF NOT EXISTS mac_promo_likes (
  season INTEGER NOT NULL,
  visitor TEXT NOT NULL,
  PRIMARY KEY (season, visitor)
);
