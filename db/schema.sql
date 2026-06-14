CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  full_name TEXT,
  jurisdiction TEXT NOT NULL,
  category TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('P0', 'P1', 'P2', 'P3')),
  risk_score INTEGER NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cases (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  jurisdiction TEXT NOT NULL,
  court TEXT,
  case_number TEXT,
  ecli TEXT,
  status TEXT NOT NULL CHECK (status IN ('WATCH', 'LEAD', 'CASE', 'CLOSED')),
  procedural_stage TEXT NOT NULL,
  claim_types TEXT NOT NULL,
  ai_systems TEXT,
  risk_score INTEGER NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
  priority TEXT NOT NULL CHECK (priority IN ('P0', 'P1', 'P2', 'P3')),
  summary TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS case_organizations (
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  PRIMARY KEY (case_id, organization_id, role)
);

CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL,
  jurisdiction TEXT NOT NULL,
  base_url TEXT NOT NULL,
  refresh_cadence TEXT NOT NULL,
  notes TEXT,
  last_checked_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  case_id TEXT REFERENCES cases(id) ON DELETE SET NULL,
  source_id TEXT REFERENCES sources(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  source_url TEXT NOT NULL,
  document_type TEXT NOT NULL,
  jurisdiction TEXT NOT NULL,
  confidence TEXT NOT NULL CHECK (confidence IN ('official', 'semi_official', 'media_lead')),
  document_date TEXT,
  captured_at TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  ecli TEXT,
  case_number TEXT,
  extracted_text TEXT,
  summary_cn TEXT,
  raw_path TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS monitor_keywords (
  id TEXT PRIMARY KEY,
  organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  query TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS monitor_runs (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS intelligence_cards (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_type TEXT NOT NULL,
  jurisdiction TEXT NOT NULL,
  organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
  case_id TEXT REFERENCES cases(id) ON DELETE SET NULL,
  priority TEXT NOT NULL CHECK (priority IN ('P0', 'P1', 'P2', 'P3')),
  status TEXT NOT NULL CHECK (status IN ('review', 'published', 'rejected')),
  signal_type TEXT NOT NULL,
  tags TEXT NOT NULL,
  confidence TEXT NOT NULL CHECK (confidence IN ('official', 'semi_official', 'media_lead')),
  risk_delta INTEGER NOT NULL DEFAULT 0,
  signal_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  approved_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_cases_priority ON cases(priority, risk_score DESC);
CREATE INDEX IF NOT EXISTS idx_documents_case ON documents(case_id);
CREATE INDEX IF NOT EXISTS idx_documents_sha ON documents(sha256);
CREATE INDEX IF NOT EXISTS idx_sources_checked ON sources(last_checked_at);
CREATE INDEX IF NOT EXISTS idx_intel_status ON intelligence_cards(status, priority, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_intel_org ON intelligence_cards(organization_id);

CREATE VIEW IF NOT EXISTS case_cards AS
SELECT
  c.*,
  COALESCE(GROUP_CONCAT(o.name, ', '), '') AS organizations,
  COUNT(d.id) AS document_count
FROM cases c
LEFT JOIN case_organizations co ON co.case_id = c.id
LEFT JOIN organizations o ON o.id = co.organization_id
LEFT JOIN documents d ON d.case_id = c.id
GROUP BY c.id;
