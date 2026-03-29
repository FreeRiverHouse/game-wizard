CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  build_script TEXT DEFAULT 'build.sh',
  screenshot_script TEXT DEFAULT 'screenshot.sh',
  reference_image TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS iterations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id TEXT REFERENCES games(id),
  number INTEGER NOT NULL,
  screenshot_path TEXT,
  reference_path TEXT,
  ai_analysis TEXT,
  files_modified TEXT,
  diff TEXT,
  commit_hash TEXT,
  commit_message TEXT,
  status TEXT DEFAULT 'pending',
  error TEXT,
  ai_tokens_used INTEGER DEFAULT 0,
  duration_ms INTEGER,
  pm_summary TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Migration: aggiungi pm_summary se non esiste (idempotente)
CREATE TABLE IF NOT EXISTS _migrations (key TEXT PRIMARY KEY);
INSERT OR IGNORE INTO _migrations VALUES ('add_pm_summary');


CREATE TABLE IF NOT EXISTS builders (
  id TEXT PRIMARY KEY,
  game_id TEXT REFERENCES games(id),
  file_path TEXT NOT NULL,
  description TEXT,
  category TEXT,
  params_json TEXT,
  last_modified DATETIME
);

CREATE TABLE IF NOT EXISTS levels (
  id TEXT PRIMARY KEY,
  game_id TEXT REFERENCES games(id),
  name TEXT NOT NULL,
  setup_file TEXT,
  builders_used TEXT,
  config_json TEXT
);

CREATE TABLE IF NOT EXISTS operation_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id TEXT,
  operation TEXT NOT NULL,
  details TEXT,
  duration_ms INTEGER,
  status TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Seed PGR come primo gioco
INSERT OR IGNORE INTO games (id, name, path, build_script, screenshot_script, reference_image)
VALUES (
  'pgr',
  'Pizza Gelato Rush',
  '/Volumes/SSD-FRH-1/Free-River-House/Games/Pizza-Gelato/PizzaGelato-LA-URP',
  'build.sh',
  'screenshot.sh',
  '/Volumes/SSD-FRH-1/Free-River-House/Games/Pizza-Gelato/PizzaGelato-LA-URP/references/fly-ride-reference.png'
);
