-- =====================================================
-- RALLIO SEED DATA - ZAMBOANGA CITY
-- =====================================================
-- Run delete_all_except_accounts_amenities.sql FIRST!
--
-- Inserts:
--   • 10 Venues (real Zamboanga barangays & landmarks)
--   • 24 Courts (varied types, surfaces, rates)
--   • Court-Amenity links
--   • Discount rules
--   • Sample ratings & reviews
--
-- Requires at least 1 existing user account.
-- =====================================================

DO $$
DECLARE
    -- Existing user references
    owner_id UUID;
    rater_1 UUID;
    rater_2 UUID;

    -- Role IDs
    r_court_admin UUID;

    -- Venue IDs
    v_paseo UUID := gen_random_uuid();
    v_kcc UUID := gen_random_uuid();
    v_canelar UUID := gen_random_uuid();
    v_tetuan UUID := gen_random_uuid();
    v_pasonanca UUID := gen_random_uuid();
    v_tumaga UUID := gen_random_uuid();
    v_sta_maria UUID := gen_random_uuid();
    v_cabatangan UUID := gen_random_uuid();
    v_mercedes UUID := gen_random_uuid();
    v_culianan UUID := gen_random_uuid();

    -- Court IDs
    c_paseo_1 UUID := gen_random_uuid();
    c_paseo_2 UUID := gen_random_uuid();
    c_paseo_3 UUID := gen_random_uuid();
    c_kcc_1 UUID := gen_random_uuid();
    c_kcc_2 UUID := gen_random_uuid();
    c_kcc_3 UUID := gen_random_uuid();
    c_canelar_1 UUID := gen_random_uuid();
    c_canelar_2 UUID := gen_random_uuid();
    c_tetuan_1 UUID := gen_random_uuid();
    c_tetuan_2 UUID := gen_random_uuid();
    c_pasonanca_1 UUID := gen_random_uuid();
    c_pasonanca_2 UUID := gen_random_uuid();
    c_tumaga_1 UUID := gen_random_uuid();
    c_tumaga_2 UUID := gen_random_uuid();
    c_tumaga_3 UUID := gen_random_uuid();
    c_sta_maria_1 UUID := gen_random_uuid();
    c_sta_maria_2 UUID := gen_random_uuid();
    c_cabatangan_1 UUID := gen_random_uuid();
    c_cabatangan_2 UUID := gen_random_uuid();
    c_mercedes_1 UUID := gen_random_uuid();
    c_mercedes_2 UUID := gen_random_uuid();
    c_culianan_1 UUID := gen_random_uuid();
    c_culianan_2 UUID := gen_random_uuid();
    c_culianan_3 UUID := gen_random_uuid();

    -- Amenity IDs (fetched from existing amenities table)
    a_parking UUID;
    a_restroom UUID;
    a_shower UUID;
    a_lockers UUID;
    a_water UUID;
    a_aircon UUID;
    a_lighting UUID;
    a_waiting UUID;
    a_equipment UUID;
    a_firstaid UUID;
    a_wifi UUID;
    a_canteen UUID;

BEGIN
    -- =====================================================
    -- 1. GET EXISTING USERS
    -- =====================================================

    -- Prefer a court_admin, fallback to any user
    SELECT id INTO r_court_admin FROM roles WHERE name = 'court_admin';

    SELECT p.id INTO owner_id
    FROM profiles p
    JOIN user_roles ur ON p.id = ur.user_id
    WHERE ur.role_id = r_court_admin
    LIMIT 1;

    IF owner_id IS NULL THEN
        SELECT id INTO owner_id FROM profiles LIMIT 1;
    END IF;

    IF owner_id IS NULL THEN
        RAISE EXCEPTION '❌ No user accounts found. Create at least one account first.';
    END IF;

    -- Get raters (different users for realistic reviews)
    SELECT id INTO rater_1 FROM profiles WHERE id != owner_id ORDER BY created_at LIMIT 1;
    SELECT id INTO rater_2 FROM profiles WHERE id != owner_id AND id != COALESCE(rater_1, owner_id) ORDER BY created_at LIMIT 1;
    IF rater_1 IS NULL THEN rater_1 := owner_id; END IF;
    IF rater_2 IS NULL THEN rater_2 := owner_id; END IF;

    RAISE NOTICE '→ owner_id: %', owner_id;
    RAISE NOTICE '→ rater_1:  %', rater_1;
    RAISE NOTICE '→ rater_2:  %', rater_2;

    -- =====================================================
    -- 2. FETCH AMENITY IDs
    -- =====================================================
    SELECT id INTO a_parking FROM amenities WHERE name = 'Parking';
    SELECT id INTO a_restroom FROM amenities WHERE name = 'Restroom';
    SELECT id INTO a_shower FROM amenities WHERE name = 'Shower';
    SELECT id INTO a_lockers FROM amenities WHERE name = 'Lockers';
    SELECT id INTO a_water FROM amenities WHERE name = 'Water';
    SELECT id INTO a_aircon FROM amenities WHERE name = 'Air Conditioning';
    SELECT id INTO a_lighting FROM amenities WHERE name = 'Lighting';
    SELECT id INTO a_waiting FROM amenities WHERE name = 'Waiting Area';
    SELECT id INTO a_equipment FROM amenities WHERE name = 'Equipment Rental';
    SELECT id INTO a_firstaid FROM amenities WHERE name = 'First Aid';
    SELECT id INTO a_wifi FROM amenities WHERE name = 'WiFi';
    SELECT id INTO a_canteen FROM amenities WHERE name = 'Canteen';

    -- =====================================================
    -- 3. INSERT VENUES (Real Zamboanga City Locations)
    -- =====================================================
    RAISE NOTICE 'Inserting Venues...';

    -- 1. Paseo del Mar Badminton Center
    -- (Near the famous Paseo del Mar boardwalk, Brgy. San Jose Cawa-Cawa)
    INSERT INTO venues (id, owner_id, name, description, address, city, latitude, longitude, phone, email, opening_hours, is_active, is_verified)
    VALUES (v_paseo, owner_id,
        'Paseo Badminton Center',
        'Premium badminton facility near the famous Paseo del Mar boardwalk. Features 3 air-conditioned indoor courts with synthetic flooring, a canteen, and ocean breeze from the nearby waterfront.',
        'R.T. Lim Boulevard, Brgy. San Jose Cawa-Cawa, Zamboanga City',
        'Zamboanga City', 6.9032, 122.0590,
        '+63 917 801 2345', 'paseo.badminton@gmail.com',
        '{"monday":{"open":"06:00","close":"22:00"},"tuesday":{"open":"06:00","close":"22:00"},"wednesday":{"open":"06:00","close":"22:00"},"thursday":{"open":"06:00","close":"22:00"},"friday":{"open":"06:00","close":"23:00"},"saturday":{"open":"06:00","close":"23:00"},"sunday":{"open":"07:00","close":"21:00"}}',
        true, true);

    -- 2. KCC Mall Badminton Complex
    -- (Near KCC Mall of Zamboanga, Brgy. Zone IV / Canelar area)
    INSERT INTO venues (id, owner_id, name, description, address, city, latitude, longitude, phone, email, opening_hours, is_active, is_verified)
    VALUES (v_kcc, owner_id,
        'KCC Badminton Complex',
        'State-of-the-art badminton complex adjacent to KCC Mall of Zamboanga. 3 professional-grade courts with maple flooring, full air conditioning, equipment rental, and ample parking.',
        'Mayor Jaldon Street, Brgy. Zone IV, Zamboanga City',
        'Zamboanga City', 6.9098, 122.0612,
        '+63 927 902 3456', 'kcc.badminton@gmail.com',
        '{"monday":{"open":"09:00","close":"22:00"},"tuesday":{"open":"09:00","close":"22:00"},"wednesday":{"open":"09:00","close":"22:00"},"thursday":{"open":"09:00","close":"22:00"},"friday":{"open":"09:00","close":"23:00"},"saturday":{"open":"08:00","close":"23:00"},"sunday":{"open":"09:00","close":"21:00"}}',
        true, true);

    -- 3. Canelar Sports Complex
    -- (Brgy. Canelar, near the historic Fort Pilar area)
    INSERT INTO venues (id, owner_id, name, description, address, city, latitude, longitude, phone, email, opening_hours, is_active, is_verified)
    VALUES (v_canelar, owner_id,
        'Canelar Sports Complex',
        'Multi-sport complex in the historic Canelar district, minutes from Fort Pilar. Features 2 indoor courts, locker rooms, and a welcoming community atmosphere.',
        'Don Alfaro Street, Brgy. Canelar, Zamboanga City',
        'Zamboanga City', 6.9134, 122.0738,
        '+63 938 103 4567', 'canelar.sports@gmail.com',
        '{"monday":{"open":"05:00","close":"21:00"},"tuesday":{"open":"05:00","close":"21:00"},"wednesday":{"open":"05:00","close":"21:00"},"thursday":{"open":"05:00","close":"21:00"},"friday":{"open":"05:00","close":"21:00"},"saturday":{"open":"06:00","close":"22:00"},"sunday":{"open":"06:00","close":"20:00"}}',
        true, true);

    -- 4. Tetuan Badminton Hub
    -- (Brgy. Tetuan, along Governor Lim Avenue — major commercial strip)
    INSERT INTO venues (id, owner_id, name, description, address, city, latitude, longitude, phone, email, opening_hours, is_active, is_verified)
    VALUES (v_tetuan, owner_id,
        'Tetuan Badminton Hub',
        'Modern badminton hub on Governor Lim Avenue, the main commercial strip of Zamboanga. LED-lit courts with synthetic flooring, popular with office workers and students.',
        'Governor Lim Avenue, Brgy. Tetuan, Zamboanga City',
        'Zamboanga City', 6.9089, 122.0689,
        '+63 945 204 5678', 'tetuan.badminton@gmail.com',
        '{"monday":{"open":"08:00","close":"22:00"},"tuesday":{"open":"08:00","close":"22:00"},"wednesday":{"open":"08:00","close":"22:00"},"thursday":{"open":"08:00","close":"22:00"},"friday":{"open":"08:00","close":"23:00"},"saturday":{"open":"07:00","close":"23:00"},"sunday":{"open":"08:00","close":"21:00"}}',
        true, true);

    -- 5. Pasonanca Park Badminton Courts
    -- (Inside Pasonanca Park, a famous nature park with tree houses)
    INSERT INTO venues (id, owner_id, name, description, address, city, latitude, longitude, phone, email, opening_hours, is_active, is_verified)
    VALUES (v_pasonanca, owner_id,
        'Pasonanca Park Courts',
        'Open-air badminton courts nestled within the scenic Pasonanca Park — Zamboanga''s famous nature destination. Enjoy games surrounded by lush greenery and mountain views. Covered courts with night lighting.',
        'Pasonanca Road, Brgy. Pasonanca, Zamboanga City',
        'Zamboanga City', 6.9523, 122.0234,
        '+63 956 305 6789', 'pasonanca.courts@gmail.com',
        '{"monday":{"open":"06:00","close":"18:00"},"tuesday":{"open":"06:00","close":"18:00"},"wednesday":{"open":"06:00","close":"18:00"},"thursday":{"open":"06:00","close":"18:00"},"friday":{"open":"06:00","close":"18:00"},"saturday":{"open":"06:00","close":"18:00"},"sunday":{"open":"06:00","close":"17:00"}}',
        true, false);

    -- 6. Tumaga Sports Hub
    -- (Brgy. Tumaga, along the National Highway heading to airport)
    INSERT INTO venues (id, owner_id, name, description, address, city, latitude, longitude, phone, email, opening_hours, is_active, is_verified)
    VALUES (v_tumaga, owner_id,
        'Tumaga Sports Hub',
        'Full-service sports facility with 3 badminton courts in the Tumaga area, conveniently located along the highway near the airport road. Features shower facilities and a small canteen.',
        'National Highway, Brgy. Tumaga, Zamboanga City',
        'Zamboanga City', 6.9412, 122.1023,
        '+63 967 406 7890', 'tumaga.sports@gmail.com',
        '{"monday":{"open":"05:30","close":"21:30"},"tuesday":{"open":"05:30","close":"21:30"},"wednesday":{"open":"05:30","close":"21:30"},"thursday":{"open":"05:30","close":"21:30"},"friday":{"open":"05:30","close":"22:00"},"saturday":{"open":"06:00","close":"22:00"},"sunday":{"open":"06:00","close":"20:00"}}',
        true, true);

    -- 7. Sta. Maria Community Gym
    -- (Brgy. Sta. Maria, a residential barangay)
    INSERT INTO venues (id, owner_id, name, description, address, city, latitude, longitude, phone, email, opening_hours, is_active, is_verified)
    VALUES (v_sta_maria, owner_id,
        'Sta. Maria Community Gym',
        'Affordable community gym with 2 badminton courts. Popular among local residents and school teams. Budget-friendly rates make this the go-to spot for casual players.',
        'Barangay Hall Road, Brgy. Sta. Maria, Zamboanga City',
        'Zamboanga City', 6.9245, 122.0512,
        '+63 978 507 8901', 'stamaria.gym@gmail.com',
        '{"monday":{"open":"06:00","close":"20:00"},"tuesday":{"open":"06:00","close":"20:00"},"wednesday":{"open":"06:00","close":"20:00"},"thursday":{"open":"06:00","close":"20:00"},"friday":{"open":"06:00","close":"20:00"},"saturday":{"open":"07:00","close":"21:00"},"sunday":{"open":"07:00","close":"18:00"}}',
        true, true);

    -- 8. Cabatangan Badminton Arena
    -- (Brgy. Cabatangan, near Southcom area)
    INSERT INTO venues (id, owner_id, name, description, address, city, latitude, longitude, phone, email, opening_hours, is_active, is_verified)
    VALUES (v_cabatangan, owner_id,
        'Cabatangan Badminton Arena',
        'Well-maintained indoor arena near the Southcom military area. Features 2 courts with vinyl flooring, clean restrooms, and a peaceful neighborhood setting.',
        'San Jose Road, Brgy. Cabatangan, Zamboanga City',
        'Zamboanga City', 6.8942, 122.0678,
        '+63 989 608 9012', 'cabatangan.arena@gmail.com',
        '{"monday":{"open":"07:00","close":"21:00"},"tuesday":{"open":"07:00","close":"21:00"},"wednesday":{"open":"07:00","close":"21:00"},"thursday":{"open":"07:00","close":"21:00"},"friday":{"open":"07:00","close":"22:00"},"saturday":{"open":"07:00","close":"22:00"},"sunday":{"open":"08:00","close":"20:00"}}',
        true, true);

    -- 9. Mercedes Badminton Court
    -- (Brgy. Mercedes, near the fishing wharf)
    INSERT INTO venues (id, owner_id, name, description, address, city, latitude, longitude, phone, email, opening_hours, is_active, is_verified)
    VALUES (v_mercedes, owner_id,
        'Mercedes Badminton Court',
        'Simple but well-loved badminton court in the Mercedes district near the fishing wharf. Known for a strong local badminton community and friendly pickup games.',
        'Mercedes Street, Brgy. Mercedes, Zamboanga City',
        'Zamboanga City', 6.9178, 122.0802,
        '+63 991 709 0123', 'mercedes.badminton@gmail.com',
        '{"monday":{"open":"06:00","close":"20:00"},"tuesday":{"open":"06:00","close":"20:00"},"wednesday":{"open":"06:00","close":"20:00"},"thursday":{"open":"06:00","close":"20:00"},"friday":{"open":"06:00","close":"21:00"},"saturday":{"open":"06:00","close":"21:00"},"sunday":{"open":"07:00","close":"19:00"}}',
        true, false);

    -- 10. Culianan Sports Center
    -- (Brgy. Culianan, outer area of Zamboanga City)
    INSERT INTO venues (id, owner_id, name, description, address, city, latitude, longitude, phone, email, opening_hours, is_active, is_verified)
    VALUES (v_culianan, owner_id,
        'Culianan Sports Center',
        'Spacious sports center serving the Culianan community. 3 courts, generous parking space, and a covered waiting area. Great for group sessions and team practice.',
        'Culianan Road, Brgy. Culianan, Zamboanga City',
        'Zamboanga City', 6.9678, 122.0345,
        '+63 906 810 1234', 'culianan.sports@gmail.com',
        '{"monday":{"open":"06:00","close":"21:00"},"tuesday":{"open":"06:00","close":"21:00"},"wednesday":{"open":"06:00","close":"21:00"},"thursday":{"open":"06:00","close":"21:00"},"friday":{"open":"06:00","close":"22:00"},"saturday":{"open":"06:00","close":"22:00"},"sunday":{"open":"07:00","close":"20:00"}}',
        true, true);

    -- =====================================================
    -- 4. INSERT COURTS
    -- =====================================================
    RAISE NOTICE 'Inserting Courts...';

    INSERT INTO courts (id, venue_id, name, description, surface_type, court_type, capacity, hourly_rate, is_active) VALUES
        -- Paseo (3 courts)
        (c_paseo_1, v_paseo, 'Court 1 - Waterfront', 'Premium court nearest to the seaside with ocean breeze ventilation', 'Synthetic', 'indoor', 4, 180.00, true),
        (c_paseo_2, v_paseo, 'Court 2 - Main', 'Air-conditioned main court with spectator area', 'Synthetic', 'indoor', 4, 200.00, true),
        (c_paseo_3, v_paseo, 'Court 3 - Practice', 'Practice court with standard flooring', 'Vinyl', 'indoor', 4, 120.00, true),

        -- KCC (3 courts)
        (c_kcc_1, v_kcc, 'Championship Court', 'Tournament-grade maple flooring, full LED lighting', 'Wood', 'indoor', 4, 300.00, true),
        (c_kcc_2, v_kcc, 'Pro Court 1', 'Professional synthetic court with aircon', 'Synthetic', 'indoor', 4, 250.00, true),
        (c_kcc_3, v_kcc, 'Pro Court 2', 'Professional synthetic court with aircon', 'Synthetic', 'indoor', 4, 250.00, true),

        -- Canelar (2 courts)
        (c_canelar_1, v_canelar, 'Court A', 'Competition-grade synthetic court', 'Synthetic', 'indoor', 4, 160.00, true),
        (c_canelar_2, v_canelar, 'Court B', 'Standard training court', 'Vinyl', 'indoor', 4, 130.00, true),

        -- Tetuan (2 courts)
        (c_tetuan_1, v_tetuan, 'Court 1', 'LED-lit synthetic court, air-conditioned', 'Synthetic', 'indoor', 4, 180.00, true),
        (c_tetuan_2, v_tetuan, 'Court 2', 'Standard court with good ventilation', 'Vinyl', 'indoor', 4, 140.00, true),

        -- Pasonanca (2 outdoor courts)
        (c_pasonanca_1, v_pasonanca, 'Hillside Court', 'Covered outdoor court with mountain panorama', 'Concrete', 'outdoor', 4, 70.00, true),
        (c_pasonanca_2, v_pasonanca, 'Garden Court', 'Covered outdoor court surrounded by trees', 'Concrete', 'outdoor', 4, 70.00, true),

        -- Tumaga (3 courts)
        (c_tumaga_1, v_tumaga, 'Court Alpha', 'Maple-floor court, premium tier', 'Wood', 'indoor', 4, 170.00, true),
        (c_tumaga_2, v_tumaga, 'Court Beta', 'Synthetic court, mid-range', 'Synthetic', 'indoor', 4, 140.00, true),
        (c_tumaga_3, v_tumaga, 'Court Gamma', 'Vinyl training court, budget-friendly', 'Vinyl', 'indoor', 4, 100.00, true),

        -- Sta. Maria (2 courts)
        (c_sta_maria_1, v_sta_maria, 'Main Court', 'Community court, basic amenities', 'Concrete', 'indoor', 4, 80.00, true),
        (c_sta_maria_2, v_sta_maria, 'Practice Court', 'Casual play court', 'Concrete', 'indoor', 4, 60.00, true),

        -- Cabatangan (2 courts)
        (c_cabatangan_1, v_cabatangan, 'Court 1', 'Indoor vinyl court, well-maintained', 'Vinyl', 'indoor', 4, 110.00, true),
        (c_cabatangan_2, v_cabatangan, 'Court 2', 'Indoor vinyl court with good lighting', 'Vinyl', 'indoor', 4, 110.00, true),

        -- Mercedes (2 courts)
        (c_mercedes_1, v_mercedes, 'Court A', 'Community court near the wharf', 'Concrete', 'indoor', 4, 75.00, true),
        (c_mercedes_2, v_mercedes, 'Court B', 'Basic court for casual games', 'Concrete', 'indoor', 4, 75.00, true),

        -- Culianan (3 courts)
        (c_culianan_1, v_culianan, 'Court 1', 'Synthetic court, newest in the center', 'Synthetic', 'indoor', 4, 150.00, true),
        (c_culianan_2, v_culianan, 'Court 2', 'Standard vinyl court', 'Vinyl', 'indoor', 4, 120.00, true),
        (c_culianan_3, v_culianan, 'Court 3', 'Outdoor covered court for group play', 'Concrete', 'outdoor', 4, 80.00, true);

    -- =====================================================
    -- 5. LINK COURT AMENITIES
    -- =====================================================
    RAISE NOTICE 'Linking Amenities...';

    -- Paseo del Mar (parking, restroom, aircon, water, canteen, wifi, lighting)
    INSERT INTO court_amenities (court_id, amenity_id) VALUES
        (c_paseo_1, a_parking), (c_paseo_1, a_restroom), (c_paseo_1, a_aircon), (c_paseo_1, a_water), (c_paseo_1, a_canteen), (c_paseo_1, a_wifi), (c_paseo_1, a_lighting),
        (c_paseo_2, a_parking), (c_paseo_2, a_restroom), (c_paseo_2, a_aircon), (c_paseo_2, a_water), (c_paseo_2, a_canteen), (c_paseo_2, a_wifi), (c_paseo_2, a_lighting),
        (c_paseo_3, a_parking), (c_paseo_3, a_restroom), (c_paseo_3, a_water), (c_paseo_3, a_lighting)
    ON CONFLICT DO NOTHING;

    -- KCC Mall (parking, restroom, shower, lockers, aircon, equipment, wifi, waiting, canteen, firstaid, lighting)
    INSERT INTO court_amenities (court_id, amenity_id) VALUES
        (c_kcc_1, a_parking), (c_kcc_1, a_restroom), (c_kcc_1, a_shower), (c_kcc_1, a_lockers), (c_kcc_1, a_aircon), (c_kcc_1, a_equipment), (c_kcc_1, a_wifi), (c_kcc_1, a_waiting), (c_kcc_1, a_canteen), (c_kcc_1, a_firstaid), (c_kcc_1, a_lighting),
        (c_kcc_2, a_parking), (c_kcc_2, a_restroom), (c_kcc_2, a_shower), (c_kcc_2, a_aircon), (c_kcc_2, a_wifi), (c_kcc_2, a_waiting), (c_kcc_2, a_canteen), (c_kcc_2, a_lighting),
        (c_kcc_3, a_parking), (c_kcc_3, a_restroom), (c_kcc_3, a_shower), (c_kcc_3, a_aircon), (c_kcc_3, a_wifi), (c_kcc_3, a_waiting), (c_kcc_3, a_canteen), (c_kcc_3, a_lighting)
    ON CONFLICT DO NOTHING;

    -- Canelar (parking, restroom, lockers, water, lighting)
    INSERT INTO court_amenities (court_id, amenity_id) VALUES
        (c_canelar_1, a_parking), (c_canelar_1, a_restroom), (c_canelar_1, a_lockers), (c_canelar_1, a_water), (c_canelar_1, a_lighting),
        (c_canelar_2, a_parking), (c_canelar_2, a_restroom), (c_canelar_2, a_water), (c_canelar_2, a_lighting)
    ON CONFLICT DO NOTHING;

    -- Tetuan (restroom, aircon, water, wifi, lighting)
    INSERT INTO court_amenities (court_id, amenity_id) VALUES
        (c_tetuan_1, a_restroom), (c_tetuan_1, a_aircon), (c_tetuan_1, a_water), (c_tetuan_1, a_wifi), (c_tetuan_1, a_lighting),
        (c_tetuan_2, a_restroom), (c_tetuan_2, a_water), (c_tetuan_2, a_lighting)
    ON CONFLICT DO NOTHING;

    -- Pasonanca (water, firstaid, lighting — outdoor, no aircon)
    INSERT INTO court_amenities (court_id, amenity_id) VALUES
        (c_pasonanca_1, a_water), (c_pasonanca_1, a_firstaid), (c_pasonanca_1, a_lighting),
        (c_pasonanca_2, a_water), (c_pasonanca_2, a_firstaid), (c_pasonanca_2, a_lighting)
    ON CONFLICT DO NOTHING;

    -- Tumaga (parking, restroom, shower, water, canteen, lighting)
    INSERT INTO court_amenities (court_id, amenity_id) VALUES
        (c_tumaga_1, a_parking), (c_tumaga_1, a_restroom), (c_tumaga_1, a_shower), (c_tumaga_1, a_water), (c_tumaga_1, a_canteen), (c_tumaga_1, a_lighting),
        (c_tumaga_2, a_parking), (c_tumaga_2, a_restroom), (c_tumaga_2, a_water), (c_tumaga_2, a_lighting),
        (c_tumaga_3, a_parking), (c_tumaga_3, a_restroom), (c_tumaga_3, a_water), (c_tumaga_3, a_lighting)
    ON CONFLICT DO NOTHING;

    -- Sta. Maria (restroom, water — bare minimum community court)
    INSERT INTO court_amenities (court_id, amenity_id) VALUES
        (c_sta_maria_1, a_restroom), (c_sta_maria_1, a_water),
        (c_sta_maria_2, a_restroom), (c_sta_maria_2, a_water)
    ON CONFLICT DO NOTHING;

    -- Cabatangan (restroom, water, lighting, parking)
    INSERT INTO court_amenities (court_id, amenity_id) VALUES
        (c_cabatangan_1, a_restroom), (c_cabatangan_1, a_water), (c_cabatangan_1, a_lighting), (c_cabatangan_1, a_parking),
        (c_cabatangan_2, a_restroom), (c_cabatangan_2, a_water), (c_cabatangan_2, a_lighting), (c_cabatangan_2, a_parking)
    ON CONFLICT DO NOTHING;

    -- Mercedes (restroom, water — basic)
    INSERT INTO court_amenities (court_id, amenity_id) VALUES
        (c_mercedes_1, a_restroom), (c_mercedes_1, a_water),
        (c_mercedes_2, a_restroom), (c_mercedes_2, a_water)
    ON CONFLICT DO NOTHING;

    -- Culianan (parking, restroom, water, waiting, lighting)
    INSERT INTO court_amenities (court_id, amenity_id) VALUES
        (c_culianan_1, a_parking), (c_culianan_1, a_restroom), (c_culianan_1, a_water), (c_culianan_1, a_waiting), (c_culianan_1, a_lighting),
        (c_culianan_2, a_parking), (c_culianan_2, a_restroom), (c_culianan_2, a_water), (c_culianan_2, a_lighting),
        (c_culianan_3, a_parking), (c_culianan_3, a_restroom), (c_culianan_3, a_water), (c_culianan_3, a_lighting)
    ON CONFLICT DO NOTHING;

    -- =====================================================
    -- 6. DISCOUNT RULES
    -- =====================================================
    RAISE NOTICE 'Inserting Discount Rules...';

    INSERT INTO discount_rules (venue_id, name, description, discount_type, discount_value, discount_unit, min_weeks, is_active) VALUES
        (v_paseo, 'Weekly Loyalty', 'Book 3+ consecutive weeks and save', 'recurring', 10.00, 'percent', 3, true),
        (v_kcc, 'Weekly Pass', 'Book for 5 weeks', 'recurring', 15.00, 'percent', 5, true);

    INSERT INTO discount_rules (venue_id, name, description, discount_type, discount_value, discount_unit, advance_days, is_active) VALUES
        (v_kcc, 'Early Bird', 'Book 7+ days in advance', 'early_bird', 5.00, 'percent', 7, true);

    -- =====================================================
    -- 7. SAMPLE RATINGS & REVIEWS
    -- =====================================================
    RAISE NOTICE 'Inserting Ratings...';

    INSERT INTO court_ratings (court_id, user_id, overall_rating, quality_rating, cleanliness_rating, facilities_rating, value_rating, review, is_verified) VALUES
        -- Paseo
        (c_paseo_1, rater_1, 5, 5, 5, 5, 4, 'Ganda ng court, lalo na pag late afternoon kasi may ocean breeze. Best in Zambo!', true),
        (c_paseo_2, rater_2, 4, 4, 4, 5, 4, 'Maayos naman, medyo mahal lang compared sa iba pero worth it ang aircon.', true),
        -- KCC
        (c_kcc_1, rater_1, 5, 5, 5, 5, 3, 'Championship-level court talaga. Maple flooring is smooth. Pero presyo is premium.', true),
        (c_kcc_2, rater_2, 5, 5, 5, 5, 4, 'Complete facilities, may shower pa at locker. Very clean.', true),
        -- Canelar
        (c_canelar_1, rater_1, 4, 4, 3, 4, 5, 'Good court, accessible area. Parking lang medyo sikip.', true),
        -- Tetuan
        (c_tetuan_1, rater_2, 4, 4, 4, 4, 4, 'Maganda lighting, convenient location sa Gov Lim Ave.', true),
        -- Pasonanca
        (c_pasonanca_1, rater_1, 4, 3, 4, 3, 5, 'Fresh air, scenic, sobrang relaxing maglaro dito. Budget friendly pa.', true),
        -- Tumaga
        (c_tumaga_1, rater_2, 5, 5, 4, 5, 5, 'Best value for a maple court. Friendly staff, may shower pa.', true),
        (c_tumaga_2, rater_1, 4, 4, 4, 4, 4, 'Standard court but well-maintained. OK ang canteen.', true),
        -- Sta. Maria
        (c_sta_maria_1, rater_2, 3, 3, 3, 2, 5, 'Basic lang pero sobrang mura. Good for casual games with friends.', true),
        -- Cabatangan
        (c_cabatangan_1, rater_1, 4, 4, 4, 3, 4, 'Peaceful area, maganda court condition. Di masyadong crowded.', true),
        -- Mercedes
        (c_mercedes_1, rater_2, 3, 3, 3, 2, 5, 'Simple court but ang saya ng community dito, laging may kalaro.', true),
        -- Culianan
        (c_culianan_1, rater_1, 4, 4, 4, 4, 4, 'Maluwag, maraming parking. Good for team practices.', true)
    ON CONFLICT DO NOTHING;

    -- =====================================================
    -- DONE
    -- =====================================================
    RAISE NOTICE '✅ Zamboanga seed data inserted successfully!';
    RAISE NOTICE '   → 10 Venues';
    RAISE NOTICE '   → 24 Courts';
    RAISE NOTICE '   → Court amenity links';
    RAISE NOTICE '   → 3 Discount rules';
    RAISE NOTICE '   → 13 Ratings/reviews';

END $$;
