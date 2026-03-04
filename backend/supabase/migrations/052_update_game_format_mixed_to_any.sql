-- Migration to rename 'mixed' game format to 'any'

-- 1. Update existing records in queue_sessions
UPDATE queue_sessions 
SET game_format = 'any' 
WHERE game_format = 'mixed';

-- 2. Update existing records in matches
UPDATE matches 
SET game_format = 'any' 
WHERE game_format = 'mixed';

-- 3. Drop existing constraints (if they exist with a specific name, assuming default names or we can use a DO block to find and replace them)
DO $$
DECLARE
    r_constraint RECORD;
BEGIN
    FOR r_constraint IN
        SELECT tc.constraint_name, tc.table_name
        FROM information_schema.table_constraints tc
        WHERE tc.table_name IN ('queue_sessions', 'matches')
        AND tc.constraint_type = 'CHECK'
        AND tc.constraint_name LIKE '%game_format%'
    LOOP
        EXECUTE 'ALTER TABLE ' || quote_ident(r_constraint.table_name) || ' DROP CONSTRAINT ' || quote_ident(r_constraint.constraint_name);
    END LOOP;
END
$$;

-- 4. Add new constraints
ALTER TABLE queue_sessions
ADD CONSTRAINT queue_sessions_game_format_check 
CHECK (game_format IN ('singles', 'doubles', 'any'));

ALTER TABLE matches
ADD CONSTRAINT matches_game_format_check 
CHECK (game_format IN ('singles', 'doubles', 'any'));
