-- Change play_style column from VARCHAR(50) to TEXT to accommodate multiple selections
ALTER TABLE public.players 
ALTER COLUMN play_style TYPE text;
