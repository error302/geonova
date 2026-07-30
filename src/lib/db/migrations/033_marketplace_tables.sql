-- Migration 033: Create marketplace tables (instrument_listings + inquiries)
-- Date: 2026-07-03
-- Audit finding: The marketplace page (880 lines) + API routes exist and
-- query an 'instrument_listings' table, but the table was never created.
-- Every marketplace request fails with a SQL error. This migration
-- creates the table so the marketplace actually works.

CREATE TABLE IF NOT EXISTS instrument_listings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type            VARCHAR(20) NOT NULL CHECK (type IN ('sale', 'rent', 'trade')),
  category        VARCHAR(50) NOT NULL,
  title           VARCHAR(255) NOT NULL,
  brand           VARCHAR(100),
  model           VARCHAR(100),
  condition       VARCHAR(20) NOT NULL CHECK (condition IN ('new', 'excellent', 'good', 'fair', 'for_parts')),
  year            INTEGER,
  description     TEXT,
  price           DECIMAL(12,2) NOT NULL,
  currency        VARCHAR(3) DEFAULT 'KES',
  rent_period     VARCHAR(20),  -- 'day', 'week', 'month' (for rent type)
  location        VARCHAR(255),
  country         VARCHAR(50) DEFAULT 'Kenya',
  seller_name     VARCHAR(255),
  seller_contact  VARCHAR(255),
  images          JSONB DEFAULT '[]',
  verified        BOOLEAN DEFAULT FALSE,
  sold            BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_listings_user ON instrument_listings(user_id);
CREATE INDEX IF NOT EXISTS idx_listings_category ON instrument_listings(category, type);
CREATE INDEX IF NOT EXISTS idx_listings_active ON instrument_listings(sold, created_at DESC);

DO $$
BEGIN
  DROP TRIGGER IF EXISTS trg_listings_updated_at ON instrument_listings;
  CREATE TRIGGER trg_listings_updated_at
    BEFORE UPDATE ON instrument_listings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
END $$;

-- Enable RLS
ALTER TABLE instrument_listings ENABLE ROW LEVEL SECURITY;

-- Anyone can browse, only owner can modify
DROP POLICY IF EXISTS "browse_listings" ON instrument_listings;
CREATE POLICY "browse_listings" ON instrument_listings
  FOR SELECT USING (sold = FALSE OR user_id::text = current_setting('request.user_id', true));

DROP POLICY IF EXISTS "owner_all_listings" ON instrument_listings;
CREATE POLICY "owner_all_listings" ON instrument_listings
  FOR ALL USING (user_id::text = current_setting('request.user_id', true))
  WITH CHECK (user_id::text = current_setting('request.user_id', true));

-- ─── Inquiries table ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS listing_inquiries (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id      UUID NOT NULL REFERENCES instrument_listings(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message         TEXT,
  contact_email   VARCHAR(255),
  contact_phone   VARCHAR(50),
  status          VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'responded', 'closed')),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inquiries_listing ON listing_inquiries(listing_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_user ON listing_inquiries(user_id);

ALTER TABLE listing_inquiries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "browse_inquiries" ON listing_inquiries;
CREATE POLICY "browse_inquiries" ON listing_inquiries
  FOR SELECT USING (
    user_id::text = current_setting('request.user_id', true)
    OR EXISTS (
      SELECT 1 FROM instrument_listings l
      WHERE l.id = listing_inquiries.listing_id
        AND l.user_id::text = current_setting('request.user_id', true)
    )
  );

DROP POLICY IF EXISTS "create_inquiries" ON listing_inquiries;
CREATE POLICY "create_inquiries" ON listing_inquiries
  FOR INSERT WITH CHECK (user_id::text = current_setting('request.user_id', true));

COMMENT ON TABLE instrument_listings IS 'Equipment marketplace — buy, sell, rent survey instruments';
COMMENT ON TABLE listing_inquiries IS 'Inquiries from buyers interested in marketplace listings';
