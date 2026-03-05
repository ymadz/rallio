
-- Promotional codes
CREATE TABLE IF NOT EXISTS promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(50) UNIQUE NOT NULL,
  description text,
  discount_type varchar(10) NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value numeric(9,2) NOT NULL CHECK (discount_value > 0),
  max_uses int,
  max_uses_per_user int DEFAULT 1,
  current_uses int DEFAULT 0,
  venue_id uuid REFERENCES venues(id) ON DELETE CASCADE,
  valid_from timestamptz NOT NULL,
  valid_until timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code);
CREATE INDEX IF NOT EXISTS idx_promo_codes_venue ON promo_codes(venue_id);
CREATE INDEX IF NOT EXISTS idx_promo_codes_active ON promo_codes(is_active) WHERE is_active = true;

COMMENT ON TABLE promo_codes IS 'Promotional discount codes';

-- Promo code usage tracking
CREATE TABLE IF NOT EXISTS promo_code_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id uuid NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reservation_id uuid REFERENCES reservations(id) ON DELETE SET NULL,
  discount_amount numeric(9,2) NOT NULL,
  used_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (promo_code_id, reservation_id)
);

CREATE INDEX IF NOT EXISTS idx_promo_code_usage_code ON promo_code_usage(promo_code_id);
CREATE INDEX IF NOT EXISTS idx_promo_code_usage_user ON promo_code_usage(user_id);

COMMENT ON TABLE promo_code_usage IS 'Tracks promo code redemptions';

ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_code_usage ENABLE ROW LEVEL SECURITY;

-- Promo codes policies
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'promo_codes' AND policyname = 'Active promo codes are viewable by everyone'
    ) THEN
        CREATE POLICY "Active promo codes are viewable by everyone" ON promo_codes
          FOR SELECT USING (is_active = true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'promo_codes' AND policyname = 'Venue owners can manage their promo codes'
    ) THEN
        CREATE POLICY "Venue owners can manage their promo codes" ON promo_codes
          FOR ALL USING (
            venue_id IS NULL OR EXISTS (
              SELECT 1 FROM venues
              WHERE venues.id = promo_codes.venue_id
              AND venues.owner_id = auth.uid()
            )
          );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'promo_code_usage' AND policyname = 'Users can view own promo code usage'
    ) THEN
        CREATE POLICY "Users can view own promo code usage" ON promo_code_usage
          FOR SELECT USING (auth.uid() = user_id);
    END IF;
END $$;
