-- FlatMate Database Schema
-- Cloudflare D1 (SQLite)

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  provider TEXT NOT NULL DEFAULT 'google',
  provider_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider, provider_id)
);

-- Groups table
CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  description TEXT,
  emoji TEXT DEFAULT '🏠',
  image_url TEXT,
  currency TEXT DEFAULT 'EUR',
  invite_code TEXT UNIQUE NOT NULL DEFAULT (lower(hex(randomblob(4)))),
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Group members
CREATE TABLE IF NOT EXISTS group_members (
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('admin', 'member')),
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (group_id, user_id)
);

-- Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  amount REAL NOT NULL CHECK(amount > 0),
  currency TEXT DEFAULT 'EUR',
  paid_by TEXT NOT NULL REFERENCES users(id),
  category TEXT DEFAULT 'general',
  notes TEXT,
  date DATETIME DEFAULT CURRENT_TIMESTAMP,
  -- Recurring expenses
  is_recurring INTEGER DEFAULT 0,
  recurring_period TEXT CHECK(recurring_period IN ('weekly', 'monthly', 'yearly') OR recurring_period IS NULL),
  next_due_date DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Expense splits (how expense is divided among members)
CREATE TABLE IF NOT EXISTS expense_splits (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  expense_id TEXT NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  amount_owed REAL NOT NULL,
  is_settled INTEGER DEFAULT 0,
  settled_at DATETIME,
  UNIQUE(expense_id, user_id)
);

-- Payments (settling debts)
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  from_user TEXT NOT NULL REFERENCES users(id),
  to_user TEXT NOT NULL REFERENCES users(id),
  amount REAL NOT NULL CHECK(amount > 0),
  note TEXT,
  date DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Notes (Google Keep style)
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  title TEXT,
  content TEXT NOT NULL DEFAULT '',
  color TEXT DEFAULT '#1e1e2e',
  pinned INTEGER DEFAULT 0,
  created_by TEXT NOT NULL REFERENCES users(id),
  updated_by TEXT REFERENCES users(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tasks (Flatify style)
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'done')),
  priority TEXT DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high')),
  assigned_to TEXT REFERENCES users(id),
  created_by TEXT NOT NULL REFERENCES users(id),
  due_date DATETIME,
  completed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sessions (for JWT-less simple auth)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(32)))),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Push notification subscriptions (Web Push API)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, endpoint)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_group ON expenses(group_id);
CREATE INDEX IF NOT EXISTS idx_expense_splits_expense ON expense_splits(expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_splits_user ON expense_splits(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_group ON payments(group_id);
CREATE INDEX IF NOT EXISTS idx_notes_group ON notes(group_id);
CREATE INDEX IF NOT EXISTS idx_tasks_group ON tasks(group_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
