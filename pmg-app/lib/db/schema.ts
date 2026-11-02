export const SCHEMA = `
CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, headcount INTEGER NOT NULL,
  self_done_base INTEGER NOT NULL DEFAULT 0, mgr_done_base INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS people (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, title TEXT NOT NULL, team_id TEXT REFERENCES teams(id),
  manager_id TEXT REFERENCES people(id), role TEXT NOT NULL CHECK (role IN ('employee','manager','hr')),
  email TEXT NOT NULL, recognition_pref TEXT NOT NULL DEFAULT 'team',
  default_visibility TEXT NOT NULL DEFAULT 'manager', chat_connected INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT, level TEXT NOT NULL CHECK (level IN ('company','team','individual')),
  title TEXT NOT NULL, owner_id TEXT REFERENCES people(id), team_id TEXT REFERENCES teams(id),
  parent_id INTEGER REFERENCES goals(id), measure TEXT, baseline REAL, target REAL, current REAL, unit TEXT,
  progress_mode TEXT NOT NULL DEFAULT 'milestones' CHECK (progress_mode IN ('metric','milestones','count','manual')),
  count_done INTEGER, count_total INTEGER, manual_progress REAL,
  start_date TEXT NOT NULL DEFAULT '2026-10-01', due_date TEXT NOT NULL,
  rubric TEXT NOT NULL DEFAULT '{}', dependencies TEXT, contribution TEXT,
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('draft','pending','changes_requested','approved')),
  approved_by TEXT, approved_at TEXT, submitted_at TEXT, created_at TEXT NOT NULL,
  horizon TEXT CHECK (horizon IN ('week','month','quarter','feature')), source TEXT NOT NULL DEFAULT 'manual',
  plan_key TEXT, plan_sig TEXT, title_locked INTEGER NOT NULL DEFAULT 0, expected_date TEXT,
  kind TEXT NOT NULL DEFAULT 'work' CHECK (kind IN ('work','personal'))
);
CREATE TABLE IF NOT EXISTS milestones (
  id INTEGER PRIMARY KEY AUTOINCREMENT, goal_id INTEGER NOT NULL REFERENCES goals(id),
  title TEXT NOT NULL, due_date TEXT, done_at TEXT, position INTEGER NOT NULL DEFAULT 0,
  work_item_id INTEGER REFERENCES work_items(id), note TEXT, pending_since TEXT
);
CREATE TABLE IF NOT EXISTS goal_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT, goal_id INTEGER NOT NULL REFERENCES goals(id),
  summary TEXT NOT NULL, reason TEXT, by_id TEXT, at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS goal_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT, goal_id INTEGER NOT NULL REFERENCES goals(id),
  field TEXT, author_id TEXT NOT NULL, body TEXT NOT NULL, at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS checkins (
  id INTEGER PRIMARY KEY AUTOINCREMENT, person_id TEXT NOT NULL REFERENCES people(id), week_of TEXT NOT NULL,
  moved TEXT, stuck TEXT, next TEXT, mood INTEGER, source TEXT NOT NULL DEFAULT 'web',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed')),
  submitted_at TEXT NOT NULL, confirmed_at TEXT
);
CREATE TABLE IF NOT EXISTS checkin_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT, checkin_id INTEGER NOT NULL REFERENCES checkins(id),
  kind TEXT NOT NULL CHECK (kind IN ('progress','win','blocker','existing_blocker','unplanned','next')),
  text TEXT NOT NULL, goal_id INTEGER REFERENCES goals(id), data TEXT NOT NULL DEFAULT '{}',
  state TEXT NOT NULL DEFAULT 'suggested' CHECK (state IN ('suggested','confirmed','removed'))
);
CREATE TABLE IF NOT EXISTS blockers (
  id INTEGER PRIMARY KEY AUTOINCREMENT, raised_by TEXT NOT NULL REFERENCES people(id),
  owner_id TEXT NOT NULL REFERENCES people(id), goal_id INTEGER REFERENCES goals(id),
  title TEXT NOT NULL, details TEXT, opened_at TEXT NOT NULL, need_by TEXT,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','accepted','needs_info','redirected','resolved')),
  reply TEXT, resolved_at TEXT, escalated_to TEXT, escalated_at TEXT, nudged_at TEXT,
  category TEXT, needed TEXT, milestone_id INTEGER REFERENCES milestones(id), origin TEXT, group_key TEXT,
  team_id TEXT REFERENCES teams(id), delegated_by TEXT, meeting_requested_at TEXT
);
CREATE TABLE IF NOT EXISTS accounts (
  person_id TEXT PRIMARY KEY REFERENCES people(id), email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, last_sign_in_at TEXT
);
CREATE TABLE IF NOT EXISTS outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT, to_id TEXT NOT NULL REFERENCES people(id), channel TEXT NOT NULL, kind TEXT NOT NULL,
  subject TEXT, body TEXT NOT NULL, blocker_id INTEGER REFERENCES blockers(id), at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS wins (
  id INTEGER PRIMARY KEY AUTOINCREMENT, person_id TEXT NOT NULL REFERENCES people(id),
  kind TEXT NOT NULL CHECK (kind IN ('win','kudos','helped','unplanned')),
  title TEXT NOT NULL, body TEXT, goal_id INTEGER REFERENCES goals(id), from_id TEXT REFERENCES people(id),
  visibility TEXT NOT NULL DEFAULT 'manager' CHECK (visibility IN ('private','manager','team','company')),
  evidence TEXT NOT NULL DEFAULT '[]', source TEXT NOT NULL DEFAULT 'web', tag TEXT, at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT, from_id TEXT NOT NULL REFERENCES people(id), to_id TEXT NOT NULL REFERENCES people(id),
  goal_id INTEGER REFERENCES goals(id), about TEXT NOT NULL, keep TEXT, improve TEXT, next_action TEXT,
  request_id INTEGER, at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS feedback_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT, requester_id TEXT NOT NULL REFERENCES people(id),
  reviewer_id TEXT NOT NULL REFERENCES people(id), goal_id INTEGER REFERENCES goals(id), about TEXT NOT NULL,
  due TEXT, kind TEXT NOT NULL DEFAULT 'quick', status TEXT NOT NULL DEFAULT 'open', at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS one_on_ones (
  id INTEGER PRIMARY KEY AUTOINCREMENT, employee_id TEXT NOT NULL REFERENCES people(id),
  manager_id TEXT NOT NULL REFERENCES people(id), scheduled_at TEXT NOT NULL, notes TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS agenda_topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT, one_on_one_id INTEGER NOT NULL REFERENCES one_on_ones(id),
  author_id TEXT NOT NULL REFERENCES people(id), text TEXT NOT NULL, at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS action_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT, employee_id TEXT NOT NULL, manager_id TEXT NOT NULL,
  one_on_one_id INTEGER REFERENCES one_on_ones(id), owner_id TEXT NOT NULL REFERENCES people(id),
  text TEXT NOT NULL, due TEXT, goal_id INTEGER, blocker_id INTEGER, carried_from TEXT,
  done_at TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS review_cycles (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, self_due TEXT NOT NULL, manager_due TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', peer_enabled INTEGER NOT NULL DEFAULT 0, show_rubric INTEGER NOT NULL DEFAULT 1,
  require_comment INTEGER NOT NULL DEFAULT 1, forced_distribution INTEGER NOT NULL DEFAULT 0, participants INTEGER NOT NULL DEFAULT 312
);
CREATE TABLE IF NOT EXISTS rating_levels (
  cycle_id INTEGER NOT NULL REFERENCES review_cycles(id), level INTEGER NOT NULL, label TEXT NOT NULL,
  description TEXT NOT NULL, PRIMARY KEY (cycle_id, level)
);
CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT, cycle_id INTEGER NOT NULL REFERENCES review_cycles(id),
  person_id TEXT NOT NULL REFERENCES people(id), reviewer_id TEXT NOT NULL REFERENCES people(id),
  kind TEXT NOT NULL CHECK (kind IN ('self','manager')), status TEXT NOT NULL DEFAULT 'draft',
  payload TEXT NOT NULL DEFAULT '{}', submitted_at TEXT, UNIQUE (cycle_id, person_id, kind)
);
CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT, to_id TEXT NOT NULL REFERENCES people(id), from_id TEXT NOT NULL,
  kind TEXT NOT NULL, body TEXT NOT NULL, data TEXT NOT NULL DEFAULT '{}', at TEXT NOT NULL, handled TEXT
);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS goal_attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT, comment_id INTEGER NOT NULL REFERENCES goal_comments(id), name TEXT NOT NULL,
  mime TEXT NOT NULL, size INTEGER NOT NULL, stored TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT, person_id TEXT NOT NULL REFERENCES people(id), kind TEXT NOT NULL,
  external_id TEXT NOT NULL, label TEXT, last_synced_at TEXT, last_error TEXT, UNIQUE (person_id, kind)
);
CREATE TABLE IF NOT EXISTS work_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT, person_id TEXT NOT NULL REFERENCES people(id), source TEXT NOT NULL,
  external_key TEXT, url TEXT, title TEXT NOT NULL, kind TEXT,
  status TEXT NOT NULL CHECK (status IN ('todo','in_progress','review','on_hold','done')), status_label TEXT,
  size REAL, parent_key TEXT, parent_title TEXT, epic_key TEXT, epic_title TEXT,
  created_at TEXT NOT NULL, started_at TEXT, done_at TEXT, due_date TEXT, synced_at TEXT,
  outcome TEXT, outcome_of TEXT, marked_done_at TEXT,
  UNIQUE (source, external_key)
);
`;

/** Bump when the schema changes: an older demo database is backed up and re-seeded (see lib/db/index.ts). */
export const SCHEMA_VERSION = 8;
