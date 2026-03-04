-- Add down payment configuration to courts
ALTER TABLE courts
ADD COLUMN IF NOT EXISTS allow_down_payment boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS minimum_down_payment numeric DEFAULT 0;
