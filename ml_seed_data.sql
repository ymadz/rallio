-- Seed data for ML Recommendation Engine Testing
-- Generates ~50 dummy users, their profiles, and random reservations/ratings for courts.
-- Ensure we have courts first
DO $$
DECLARE
    court_ids UUID[];
    new_user_id UUID;
    i INT;
    j INT;
    random_court_id UUID;
    random_rating INT;
    random_status TEXT;
    random_days_ago INT;
BEGIN
    SELECT array_agg(id) INTO court_ids FROM public.courts;
    
    IF array_length(court_ids, 1) IS NULL THEN
        RAISE NOTICE 'No courts found. Please insert venues and courts first.';
        RETURN;
    END IF;

    -- Generate 50 Users
    FOR i IN 1..50 LOOP
        new_user_id := gen_random_uuid();
        -- Insert into auth.users (Minimal mock to satisfy foreign key constraints)
        INSERT INTO auth.users (
            instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
        ) VALUES (
            '00000000-0000-0000-0000-000000000000', new_user_id, 'authenticated', 'authenticated', 'ml_test_user_' || i || '@example.com', 'crpyted_password_mock', now(), now(), now(), 
            '{"provider":"email","providers":["email"]}'::jsonb, 
            ('{"display_name":"ML Test User ' || i || '"}')::jsonb, 
            now(), now(), '', '', '', ''
        );
        
        -- The trigger on auth.users automatically creates the public.profiles record, so we do not need to insert it manually.

        -- Generate 3 to 10 random bookings per user
        FOR j IN 1..(floor(random() * 8 + 3)::int) LOOP
            random_court_id := court_ids[floor(random() * array_length(court_ids, 1) + 1)::int];
            random_status := (ARRAY['completed', 'confirmed', 'cancelled'])[floor(random() * 3 + 1)::int];
            
            -- We must evaluate random once so the start_time is fixed when calculating end_time
            random_days_ago := floor(random() * 30)::int;
            
            -- Check if this random time overlaps with an existing booking
            IF NOT EXISTS (
                SELECT 1 FROM public.reservations
                WHERE court_id = random_court_id
                AND start_time < now() - (random_days_ago || ' days')::interval + interval '1 hour'
                AND end_time > now() - (random_days_ago || ' days')::interval
            ) THEN
                -- Insert Reservation
                INSERT INTO public.reservations (
                    user_id, court_id, start_time, end_time, total_amount, status
                ) VALUES (
                    new_user_id, 
                    random_court_id, 
                    now() - (random_days_ago || ' days')::interval, 
                    now() - (random_days_ago || ' days')::interval + interval '1 hour',
                    150.00, 
                    random_status
                );

                -- If completed, 70% chance they left a rating
                IF random_status = 'completed' AND random() > 0.3 THEN
                    -- Random rating biased towards 4 and 5
                    random_rating := floor(random() * 3 + 3)::int; 
                    IF random_rating > 5 THEN random_rating := 5; END IF;

                    INSERT INTO public.court_ratings (
                        court_id, user_id, overall_rating, review
                    ) VALUES (
                        random_court_id,
                        new_user_id,
                        random_rating,
                        'Mock review generated for ML testing.'
                    ) ON CONFLICT (court_id, user_id, reservation_id) DO NOTHING;
                END IF;
            END IF;
        END LOOP;
    END LOOP;
    
    RAISE NOTICE 'Seed generation complete!';
END $$;
