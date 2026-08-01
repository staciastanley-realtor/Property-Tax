-- Michigan Property Tax Estimator — Database Schema
-- PostgreSQL + PostGIS
-- Maps to Blueprint Section 6 (Data Model)

CREATE EXTENSION IF NOT EXISTS postgis;

-- ---------------------------------------------------------------------
-- Jurisdictions (county, city, township, village)
-- ---------------------------------------------------------------------
CREATE TYPE jurisdiction_type AS ENUM ('county', 'city', 'township', 'village');

CREATE TABLE jurisdictions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type            jurisdiction_type NOT NULL,
  canonical_name  TEXT NOT NULL,
  county_id       UUID REFERENCES jurisdictions(id), -- null for county rows themselves
  external_gis_id TEXT,                              -- stable ID from GIS provider
  geometry        GEOMETRY(MultiPolygon, 4326),
  active          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_jurisdictions_geom ON jurisdictions USING GIST (geometry);
CREATE INDEX idx_jurisdictions_type ON jurisdictions (type);

CREATE TABLE jurisdiction_aliases (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction_id   UUID NOT NULL REFERENCES jurisdictions(id) ON DELETE CASCADE,
  source            TEXT NOT NULL,   -- e.g. 'gis', 'millage_report', 'manual_correction'
  alias_name        TEXT NOT NULL,
  normalized_alias  TEXT NOT NULL,   -- lowercased, punctuation-stripped, suffix-normalized
  approved          BOOLEAN NOT NULL DEFAULT false, -- manual corrections require admin approval
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_jurisdiction_aliases_norm ON jurisdiction_aliases (normalized_alias);

-- ---------------------------------------------------------------------
-- School districts
-- ---------------------------------------------------------------------
CREATE TABLE school_districts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name  TEXT NOT NULL,
  external_gis_id TEXT,
  geometry        GEOMETRY(MultiPolygon, 4326),
  active          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_school_districts_geom ON school_districts USING GIST (geometry);

CREATE TABLE school_district_aliases (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_district_id  UUID NOT NULL REFERENCES school_districts(id) ON DELETE CASCADE,
  source              TEXT NOT NULL,
  alias_name          TEXT NOT NULL,
  normalized_alias    TEXT NOT NULL,
  approved            BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_school_district_aliases_norm ON school_district_aliases (normalized_alias);

-- ---------------------------------------------------------------------
-- Millage rates (annual, per jurisdiction combination)
-- ---------------------------------------------------------------------
CREATE TABLE millage_rates (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_year                    INT NOT NULL,
  county_id                   UUID NOT NULL REFERENCES jurisdictions(id),
  municipality_id              UUID NOT NULL REFERENCES jurisdictions(id),
  village_id                  UUID REFERENCES jurisdictions(id),        -- nullable
  school_district_id          UUID NOT NULL REFERENCES school_districts(id),
  principal_residence_rate    NUMERIC(9,4) NOT NULL,                    -- mills
  nonhomestead_rate           NUMERIC(9,4) NOT NULL,                    -- mills
  source_reference            TEXT NOT NULL,                            -- citation to the annual report
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tax_year, county_id, municipality_id, village_id, school_district_id)
);
CREATE INDEX idx_millage_rates_lookup
  ON millage_rates (tax_year, county_id, municipality_id, school_district_id);

-- ---------------------------------------------------------------------
-- Lookup logs (privacy-conscious: avoid retaining full addresses longer than necessary)
-- ---------------------------------------------------------------------
CREATE TYPE match_status AS ENUM ('matched', 'ambiguous', 'unmatched', 'manual_override');

CREATE TABLE lookup_logs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "timestamp"         TIMESTAMPTZ NOT NULL DEFAULT now(),
  normalized_address  TEXT,             -- consider hashing/truncating per retention policy
  latitude            DOUBLE PRECISION,
  longitude           DOUBLE PRECISION,
  match_status        match_status NOT NULL,
  detected_county_id           UUID REFERENCES jurisdictions(id),
  detected_municipality_id     UUID REFERENCES jurisdictions(id),
  detected_village_id          UUID REFERENCES jurisdictions(id),
  detected_school_district_id  UUID REFERENCES school_districts(id),
  manual_override     BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX idx_lookup_logs_timestamp ON lookup_logs ("timestamp");

-- Retention: a scheduled job should purge/anonymize normalized_address
-- older than the documented retention window (Section 10 / Section 16).

-- ---------------------------------------------------------------------
-- Referral network (V2) — statewide lead capture + private tracking.
--
-- Manual assignment only for now (assigned_partner_agent_id nullable,
-- set by Stacia herself). The territory/county columns on partner_agents
-- exist so automatic assignment-by-county can be added later without a
-- schema change — see Blueprint-equivalent Section for V2, "design the
-- database so future automatic assignment... can be added later."
--
-- All PII here (name, email, phone) is private, authenticated-access-
-- only data — never exposed through any public API route. The public
-- referral form (app/api/referral/route.ts) only ever INSERTs; nothing
-- in this table is ever read back by a public/unauthenticated route.
-- ---------------------------------------------------------------------

CREATE TYPE referral_intent AS ENUM ('buying', 'selling', 'both');
CREATE TYPE contact_preference AS ENUM ('call', 'text', 'email');
CREATE TYPE lead_status AS ENUM ('new', 'contacted', 'assigned', 'inactive');
CREATE TYPE referral_agreement_status AS ENUM ('not_sent', 'sent', 'signed', 'declined');
CREATE TYPE transaction_stage AS ENUM (
  'assigned', 'client_contacted', 'under_contract', 'closed', 'fell_through'
);

CREATE TABLE partner_agents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  brokerage         TEXT,
  email             TEXT,
  phone             TEXT,
  -- Territory fields, unused by manual assignment today, present so
  -- automatic assignment-by-county/territory can be added without a
  -- migration later.
  counties_served     TEXT[],   -- e.g. {'Oakland','Genesee'}
  active            BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE referral_leads (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Contact info (private — see note above)
  full_name                 TEXT NOT NULL,
  email                     TEXT NOT NULL,
  phone                     TEXT NOT NULL,
  contact_preference        contact_preference NOT NULL,

  -- What they told us
  intent                    referral_intent NOT NULL,
  preferred_location        TEXT NOT NULL,     -- free text, buyer's own words
  timeframe                 TEXT,               -- free text, e.g. "3-6 months"
  wants_lender_intro        BOOLEAN NOT NULL DEFAULT false,

  -- Context carried over from the property report that generated this lead
  searched_address          TEXT,
  searched_county           TEXT,
  searched_municipality     TEXT,
  entered_purchase_price    NUMERIC(12,2),
  estimated_annual_taxes    NUMERIC(10,2),

  -- Owner-managed tracking (Section: "private owner referral dashboard")
  status                    lead_status NOT NULL DEFAULT 'new',
  assigned_partner_agent_id UUID REFERENCES partner_agents(id),
  contact_date              DATE,
  referral_agreement_status referral_agreement_status NOT NULL DEFAULT 'not_sent',
  transaction_stage         transaction_stage,
  expected_referral_fee     NUMERIC(10,2),
  closed_date               DATE,
  paid_referral_fee         NUMERIC(10,2)
);
CREATE INDEX idx_referral_leads_status ON referral_leads (status);
CREATE INDEX idx_referral_leads_created ON referral_leads (created_at);

-- ---------------------------------------------------------------------
-- V2 Phase 2 — blog + analytics
-- ---------------------------------------------------------------------

CREATE TABLE blog_posts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT NOT NULL UNIQUE,
  title         TEXT NOT NULL,
  excerpt       TEXT,
  body_markdown TEXT NOT NULL,
  category      TEXT,               -- e.g. 'Market News', 'Law & Regulation', 'Buyer Tips'
  published     BOOLEAN NOT NULL DEFAULT false,
  published_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_blog_posts_published ON blog_posts (published, published_at);

-- One row per visitor (identified by an anonymous cookie ID, not PII).
-- "user_type" is only ever set if the visitor answers the first-visit
-- prompt — null means "unknown," never guessed.
CREATE TYPE visitor_type AS ENUM ('realtor', 'lender', 'consumer');

CREATE TABLE visitors (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cookie_id     TEXT NOT NULL UNIQUE,
  user_type     visitor_type,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  visit_count   INT NOT NULL DEFAULT 1
);

-- One row per completed calculation (a "search"). Deliberately narrow —
-- no address stored here beyond county/municipality (already
-- aggregate-level, not a specific street address tied to a visitor),
-- keeping this table safe to build broad reporting on without it
-- doubling as a PII store.
CREATE TABLE search_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id          UUID REFERENCES visitors(id),
  "timestamp"         TIMESTAMPTZ NOT NULL DEFAULT now(),
  county              TEXT,
  municipality        TEXT,
  purchase_price      NUMERIC(12,2),
  property_use        TEXT,
  match_status        TEXT
);
CREATE INDEX idx_search_events_timestamp ON search_events ("timestamp");
CREATE INDEX idx_search_events_county ON search_events (county);
