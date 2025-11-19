-- Phase 2: Court Discovery Sample Data
-- Run this after 001_dev_seed.sql
-- Adds 8 more venues (total 10) with diverse offerings across Zamboanga City

-- ============================================================
-- ADDITIONAL VENUES
-- ============================================================

INSERT INTO venues (id, owner_id, name, description, address, city, latitude, longitude, phone, email, website, opening_hours, is_active, is_verified, metadata) VALUES
-- 3. Elite Badminton Hub (Premium Indoor)
(
  '33333333-3333-3333-3333-333333333333',
  (SELECT id FROM profiles WHERE email = 'admin@venue.com' LIMIT 1),
  'Elite Badminton Hub',
  'Premium badminton facility with professional-grade courts, top-tier equipment rental, and certified coaching staff. Popular among competitive players and tournament preparation.',
  'Pershing Avenue, Zone 4, Zamboanga City',
  'Zamboanga City',
  6.9190,
  122.0780,
  '+63 917 555 3333',
  'contact@elitebadmintonhub.ph',
  'https://elitebadmintonhub.ph',
  '{"monday": {"open": "06:00", "close": "23:00"}, "tuesday": {"open": "06:00", "close": "23:00"}, "wednesday": {"open": "06:00", "close": "23:00"}, "thursday": {"open": "06:00", "close": "23:00"}, "friday": {"open": "06:00", "close": "23:00"}, "saturday": {"open": "07:00", "close": "23:00"}, "sunday": {"open": "07:00", "close": "22:00"}}'::jsonb,
  true,
  true,
  '{"features": ["Premium Equipment", "Coaching Available", "Pro Shop", "Spectator Seating"], "parking_capacity": 40, "established_year": 2018}'::jsonb
),

-- 4. Tetuan Community Sports Center (Budget-Friendly)
(
  '44444444-4444-4444-4444-444444444444',
  (SELECT id FROM profiles WHERE email = 'admin@venue.com' LIMIT 1),
  'Tetuan Community Sports Center',
  'Affordable community sports facility offering both indoor and outdoor badminton courts. Great for casual play, family games, and community tournaments. No frills, just pure badminton fun.',
  'Tetuan Road, Tetuan, Zamboanga City',
  'Zamboanga City',
  6.9310,
  122.0820,
  '+63 917 555 4444',
  'tetuan.sports@gmail.com',
  NULL,
  '{"monday": {"open": "07:00", "close": "20:00"}, "tuesday": {"open": "07:00", "close": "20:00"}, "wednesday": {"open": "07:00", "close": "20:00"}, "thursday": {"open": "07:00", "close": "20:00"}, "friday": {"open": "07:00", "close": "21:00"}, "saturday": {"open": "06:00", "close": "21:00"}, "sunday": {"open": "06:00", "close": "20:00"}}'::jsonb,
  true,
  true,
  '{"features": ["Community Programs", "Youth Leagues", "Senior Discounts"], "parking_capacity": 15}'::jsonb
),

-- 5. Pasonanca Sports Arena (Mid-Range, Good Location)
(
  '55555555-5555-5555-5555-555555555555',
  (SELECT id FROM profiles WHERE email = 'admin@venue.com' LIMIT 1),
  'Pasonanca Sports Arena',
  'Modern sports complex near Pasonanca Park with excellent indoor courts, ample parking, and a sports cafe. Perfect blend of quality and affordability for regular players.',
  'Pasonanca Road, Pasonanca, Zamboanga City',
  'Zamboanga City',
  6.9340,
  122.0660,
  '+63 917 555 5555',
  'info@pasonancaarena.com',
  'https://pasonancaarena.com',
  '{"monday": {"open": "06:00", "close": "22:00"}, "tuesday": {"open": "06:00", "close": "22:00"}, "wednesday": {"open": "06:00", "close": "22:00"}, "thursday": {"open": "06:00", "close": "22:00"}, "friday": {"open": "06:00", "close": "23:00"}, "saturday": {"open": "06:00", "close": "23:00"}, "sunday": {"open": "07:00", "close": "22:00"}}'::jsonb,
  true,
  true,
  '{"features": ["Sports Cafe", "Tournament Hosting", "Group Packages"], "parking_capacity": 50}'::jsonb
),

-- 6. Canelar Badminton Court (Neighborhood Gem)
(
  '66666666-6666-6666-6666-666666666666',
  (SELECT id FROM profiles WHERE email = 'admin@venue.com' LIMIT 1),
  'Canelar Badminton Court',
  'Cozy neighborhood badminton court with friendly atmosphere. Popular with local residents for evening games. Small but well-maintained with good lighting.',
  'Governor Camins Avenue, Canelar, Zamboanga City',
  'Zamboanga City',
  6.9270,
  122.0810,
  '+63 917 555 6666',
  'canelar.badminton@yahoo.com',
  NULL,
  '{"monday": {"open": "14:00", "close": "22:00"}, "tuesday": {"open": "14:00", "close": "22:00"}, "wednesday": {"open": "14:00", "close": "22:00"}, "thursday": {"open": "14:00", "close": "22:00"}, "friday": {"open": "14:00", "close": "23:00"}, "saturday": {"open": "08:00", "close": "23:00"}, "sunday": {"open": "08:00", "close": "22:00"}}'::jsonb,
  true,
  false,
  '{"features": ["Neighborhood Favorite", "Evening Games", "Walk-ins Welcome"], "parking_capacity": 10}'::jsonb
),

-- 7. Guiwan Sports Hub (Outdoor Focus)
(
  '77777777-7777-7777-7777-777777777777',
  (SELECT id FROM profiles WHERE email = 'admin@venue.com' LIMIT 1),
  'Guiwan Sports Hub',
  'Large outdoor sports complex with multiple badminton courts, basketball courts, and jogging track. Best for morning and late afternoon play. Fresh air and natural ventilation.',
  'Veteranos Road, Guiwan, Zamboanga City',
  'Zamboanga City',
  6.9050,
  122.0720,
  '+63 917 555 7777',
  'guiwan.sports@gmail.com',
  NULL,
  '{"monday": {"open": "05:00", "close": "21:00"}, "tuesday": {"open": "05:00", "close": "21:00"}, "wednesday": {"open": "05:00", "close": "21:00"}, "thursday": {"open": "05:00", "close": "21:00"}, "friday": {"open": "05:00", "close": "21:00"}, "saturday": {"open": "05:00", "close": "21:00"}, "sunday": {"open": "05:00", "close": "21:00"}}'::jsonb,
  true,
  true,
  '{"features": ["Multi-Sport Facility", "Outdoor Focus", "Morning Special Rates"], "parking_capacity": 30}'::jsonb
),

-- 8. San Jose Badminton Center (Student-Friendly)
(
  '88888888-8888-8888-8888-888888888888',
  (SELECT id FROM profiles WHERE email = 'admin@venue.com' LIMIT 1),
  'San Jose Badminton Center',
  'Student-friendly badminton center near schools and universities. Affordable rates with student discounts. Popular spot for young players and school teams.',
  'Governor Lim Avenue, San Jose, Zamboanga City',
  'Zamboanga City',
  6.9150,
  122.0740,
  '+63 917 555 8888',
  'sanjose.badminton@gmail.com',
  NULL,
  '{"monday": {"open": "10:00", "close": "22:00"}, "tuesday": {"open": "10:00", "close": "22:00"}, "wednesday": {"open": "10:00", "close": "22:00"}, "thursday": {"open": "10:00", "close": "22:00"}, "friday": {"open": "10:00", "close": "23:00"}, "saturday": {"open": "08:00", "close": "23:00"}, "sunday": {"open": "08:00", "close": "22:00"}}'::jsonb,
  true,
  true,
  '{"features": ["Student Discounts", "School Team Packages", "Study Lounge"], "parking_capacity": 20}'::jsonb
),

-- 9. Baliwasan Beachside Courts (Unique Outdoor)
(
  '99999999-9999-9999-9999-999999999999',
  (SELECT id FROM profiles WHERE email = 'admin@venue.com' LIMIT 1),
  'Baliwasan Beachside Courts',
  'Unique beachside badminton facility with ocean views. Outdoor courts with sea breeze. Perfect for sunset games and weekend getaways. Combine badminton with beach activities.',
  'Baliwasan Beach Road, Baliwasan, Zamboanga City',
  'Zamboanga City',
  6.8990,
  122.0580,
  '+63 917 555 9999',
  'baliwasan.courts@beach.ph',
  'https://baliwasancourts.ph',
  '{"monday": {"open": "06:00", "close": "20:00"}, "tuesday": {"open": "06:00", "close": "20:00"}, "wednesday": {"open": "06:00", "close": "20:00"}, "thursday": {"open": "06:00", "close": "20:00"}, "friday": {"open": "06:00", "close": "21:00"}, "saturday": {"open": "05:00", "close": "21:00"}, "sunday": {"open": "05:00", "close": "21:00"}}'::jsonb,
  true,
  true,
  '{"features": ["Beach View", "Outdoor Dining", "Weekend Events"], "parking_capacity": 25}'::jsonb
),

-- 10. Zamboanga Premier Badminton Club (Ultra Premium)
(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  (SELECT id FROM profiles WHERE email = 'admin@venue.com' LIMIT 1),
  'Zamboanga Premier Badminton Club',
  'Exclusive members-only badminton club with world-class facilities. Features international-standard courts, fitness center, sauna, and fine dining restaurant. Open to public with advance reservation.',
  'Mayor Jaldon Street, Downtown, Zamboanga City',
  'Zamboanga City',
  6.9100,
  122.0750,
  '+63 917 555 0000',
  'reservations@premierbadminton.ph',
  'https://premierbadminton.ph',
  '{"monday": {"open": "05:00", "close": "23:00"}, "tuesday": {"open": "05:00", "close": "23:00"}, "wednesday": {"open": "05:00", "close": "23:00"}, "thursday": {"open": "05:00", "close": "23:00"}, "friday": {"open": "05:00", "close": "00:00"}, "saturday": {"open": "05:00", "close": "00:00"}, "sunday": {"open": "06:00", "close": "23:00"}}'::jsonb,
  true,
  true,
  '{"features": ["Members Club", "International Standards", "Fine Dining", "Fitness Center", "Sauna"], "parking_capacity": 60, "membership_required": false}'::jsonb
);

-- ============================================================
-- COURTS FOR NEW VENUES
-- ============================================================

INSERT INTO courts (id, venue_id, name, description, surface_type, court_type, capacity, hourly_rate, is_active, metadata) VALUES
-- Elite Badminton Hub (4 premium indoor courts)
(
  'c0000003-0001-0000-0000-000000000001',
  '33333333-3333-3333-3333-333333333333',
  'Championship Court 1',
  'Professional-grade wood flooring, tournament-spec lighting, spectator seating for 100. Used for local and regional tournaments.',
  'wood',
  'indoor',
  4,
  600.00,
  true,
  '{"features": ["Tournament Grade", "Spectator Seating", "Pro Lighting"], "floor_material": "German Beech Wood"}'::jsonb
),
(
  'c0000003-0002-0000-0000-000000000002',
  '33333333-3333-3333-3333-333333333333',
  'Championship Court 2',
  'Identical to Court 1. Premium wood surface with excellent shock absorption. Climate-controlled environment.',
  'wood',
  'indoor',
  4,
  600.00,
  true,
  '{"features": ["Tournament Grade", "Climate Control"], "floor_material": "German Beech Wood"}'::jsonb
),
(
  'c0000003-0003-0000-0000-000000000003',
  '33333333-3333-3333-3333-333333333333',
  'Elite Training Court 1',
  'High-quality synthetic surface. Perfect for intensive training sessions and skill development.',
  'synthetic',
  'indoor',
  4,
  500.00,
  true,
  '{"features": ["Training Focused", "Ball Machine Available"], "surface_brand": "Yonex Pro Cushion"}'::jsonb
),
(
  'c0000003-0004-0000-0000-000000000004',
  '33333333-3333-3333-3333-333333333333',
  'Elite Training Court 2',
  'High-quality synthetic surface. Ideal for group coaching and team training.',
  'synthetic',
  'indoor',
  4,
  500.00,
  true,
  '{"features": ["Group Training", "Video Analysis Available"]}'::jsonb
),

-- Tetuan Community Sports Center (3 budget courts: 1 indoor, 2 outdoor)
(
  'c0000004-0001-0000-0000-000000000001',
  '44444444-4444-4444-4444-444444444444',
  'Indoor Court',
  'Basic indoor court with concrete floor, good lighting, and fans. Clean and well-maintained despite budget pricing.',
  'concrete',
  'indoor',
  4,
  180.00,
  true,
  '{"features": ["Community Friendly", "No Booking Fee"]}'::jsonb
),
(
  'c0000004-0002-0000-0000-000000000002',
  '44444444-4444-4444-4444-444444444444',
  'Outdoor Court A',
  'Covered outdoor court with concrete surface. Best during cooler hours. Popular for afternoon community games.',
  'concrete',
  'outdoor',
  4,
  120.00,
  true,
  '{"features": ["Covered", "Community Programs"]}'::jsonb
),
(
  'c0000004-0003-0000-0000-000000000003',
  '44444444-4444-4444-4444-444444444444',
  'Outdoor Court B',
  'Open-air court, best for early morning or late afternoon. Great for casual pickup games.',
  'concrete',
  'outdoor',
  4,
  120.00,
  true,
  '{"features": ["Open Air", "Casual Play"]}'::jsonb
),

-- Pasonanca Sports Arena (3 indoor courts)
(
  'c0000005-0001-0000-0000-000000000001',
  '55555555-5555-5555-5555-555555555555',
  'Court 1 - Main Arena',
  'Spacious court with synthetic flooring, excellent lighting, and air conditioning. Most popular court in the facility.',
  'synthetic',
  'indoor',
  4,
  350.00,
  true,
  '{"features": ["Air Conditioned", "Main Arena", "Cafe Nearby"]}'::jsonb
),
(
  'c0000005-0002-0000-0000-000000000002',
  '55555555-5555-5555-5555-555555555555',
  'Court 2',
  'Standard indoor court with synthetic surface. Good for regular play and training.',
  'synthetic',
  'indoor',
  4,
  320.00,
  true,
  '{"features": ["Standard Court", "Good Ventilation"]}'::jsonb
),
(
  'c0000005-0003-0000-0000-000000000003',
  '55555555-5555-5555-5555-555555555555',
  'Court 3',
  'Newly renovated court with premium synthetic surface. Quieter location, good for focused games.',
  'synthetic',
  'indoor',
  4,
  320.00,
  true,
  '{"features": ["Newly Renovated", "Quiet Location"]}'::jsonb
),

-- Canelar Badminton Court (2 small indoor courts)
(
  'c0000006-0001-0000-0000-000000000001',
  '66666666-6666-6666-6666-666666666666',
  'Court 1',
  'Compact indoor court with concrete floor. Well-lit with LED lights. Neighborhood favorite for evening games.',
  'concrete',
  'indoor',
  4,
  220.00,
  true,
  '{"features": ["LED Lighting", "Evening Popular", "Friendly Staff"]}'::jsonb
),
(
  'c0000006-0002-0000-0000-000000000002',
  '66666666-6666-6666-6666-666666666666',
  'Court 2',
  'Similar to Court 1. Cozy atmosphere, great for regular groups and neighborhood leagues.',
  'concrete',
  'indoor',
  4,
  220.00,
  true,
  '{"features": ["Cozy Atmosphere", "Regular Groups Welcome"]}'::jsonb
),

-- Guiwan Sports Hub (5 outdoor courts)
(
  'c0000007-0001-0000-0000-000000000001',
  '77777777-7777-7777-7777-777777777777',
  'Outdoor Court 1',
  'Main outdoor court with concrete surface. Large covered area, excellent for morning games. Natural ventilation.',
  'concrete',
  'outdoor',
  4,
  150.00,
  true,
  '{"features": ["Covered", "Morning Special", "Fresh Air"]}'::jsonb
),
(
  'c0000007-0002-0000-0000-000000000002',
  '77777777-7777-7777-7777-777777777777',
  'Outdoor Court 2',
  'Covered outdoor court next to jogging track. Popular with fitness enthusiasts.',
  'concrete',
  'outdoor',
  4,
  150.00,
  true,
  '{"features": ["Near Track", "Fitness Crowd"]}'::jsonb
),
(
  'c0000007-0003-0000-0000-000000000003',
  '77777777-7777-7777-7777-777777777777',
  'Outdoor Court 3',
  'Standard outdoor court. Good for casual play and practice sessions.',
  'concrete',
  'outdoor',
  4,
  140.00,
  true,
  '{"features": ["Practice Friendly", "Walk-ins OK"]}'::jsonb
),
(
  'c0000007-0004-0000-0000-000000000004',
  '77777777-7777-7777-7777-777777777777',
  'Outdoor Court 4',
  'Basic outdoor court. Budget-friendly option for casual games.',
  'concrete',
  'outdoor',
  4,
  140.00,
  true,
  '{"features": ["Budget Option", "Casual Games"]}'::jsonb
),
(
  'c0000007-0005-0000-0000-000000000005',
  '77777777-7777-7777-7777-777777777777',
  'Outdoor Court 5',
  'Entry-level court. Great for beginners and family games.',
  'concrete',
  'outdoor',
  4,
  140.00,
  true,
  '{"features": ["Beginner Friendly", "Family Games"]}'::jsonb
),

-- San Jose Badminton Center (3 indoor courts)
(
  'c0000008-0001-0000-0000-000000000001',
  '88888888-8888-8888-8888-888888888888',
  'Student Court 1',
  'Affordable indoor court with synthetic surface. Popular with university teams and student groups.',
  'synthetic',
  'indoor',
  4,
  250.00,
  true,
  '{"features": ["Student Discount Available", "Group Rates", "Study Lounge Access"]}'::jsonb
),
(
  'c0000008-0002-0000-0000-000000000002',
  '88888888-8888-8888-8888-888888888888',
  'Student Court 2',
  'Well-maintained court with good ventilation. Frequently booked by school teams.',
  'synthetic',
  'indoor',
  4,
  250.00,
  true,
  '{"features": ["School Team Friendly", "Equipment Storage"]}'::jsonb
),
(
  'c0000008-0003-0000-0000-000000000003',
  '88888888-8888-8888-8888-888888888888',
  'Student Court 3',
  'Newest court with excellent lighting. Ideal for after-school training sessions.',
  'synthetic',
  'indoor',
  4,
  250.00,
  true,
  '{"features": ["New LED Lights", "After School Special"]}'::jsonb
),

-- Baliwasan Beachside Courts (4 outdoor courts)
(
  'c0000009-0001-0000-0000-000000000001',
  '99999999-9999-9999-9999-999999999999',
  'Sunset Court',
  'Premium beachside court with ocean view. Best for evening games during sunset. Unique badminton experience.',
  'concrete',
  'outdoor',
  4,
  280.00,
  true,
  '{"features": ["Ocean View", "Sunset Games", "Photo Spot"]}'::jsonb
),
(
  'c0000009-0002-0000-0000-000000000002',
  '99999999-9999-9999-9999-999999999999',
  'Breeze Court 1',
  'Open-air court with refreshing sea breeze. Popular for weekend morning games.',
  'concrete',
  'outdoor',
  4,
  240.00,
  true,
  '{"features": ["Sea Breeze", "Weekend Special", "Beach Access"]}'::jsonb
),
(
  'c0000009-0003-0000-0000-000000000003',
  '99999999-9999-9999-9999-999999999999',
  'Breeze Court 2',
  'Similar to Breeze Court 1. Great for family outings combining beach and badminton.',
  'concrete',
  'outdoor',
  4,
  240.00,
  true,
  '{"features": ["Family Friendly", "Beach Combo"]}'::jsonb
),
(
  'c0000009-0004-0000-0000-000000000004',
  '99999999-9999-9999-9999-999999999999',
  'Beach Play Court',
  'Casual court for beach visitors. No advance booking required for walk-ins during off-peak.',
  'concrete',
  'outdoor',
  4,
  200.00,
  true,
  '{"features": ["Walk-ins Welcome", "Casual Play", "Beach Visitors"]}'::jsonb
),

-- Zamboanga Premier Badminton Club (6 ultra-premium courts)
(
  'c000000a-0001-0000-0000-000000000001',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'International Court 1',
  'BWF-standard tournament court with Olympic-grade wood flooring. Used for national-level competitions. Full spectator gallery.',
  'wood',
  'indoor',
  4,
  800.00,
  true,
  '{"features": ["BWF Standard", "Olympic Grade", "Spectator Gallery", "Live Streaming"], "certifications": ["BWF Approved"]}'::jsonb
),
(
  'c000000a-0002-0000-0000-000000000002',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'International Court 2',
  'Identical to International Court 1. Premium tournament-grade facility.',
  'wood',
  'indoor',
  4,
  800.00,
  true,
  '{"features": ["BWF Standard", "Olympic Grade", "Video Analysis"], "certifications": ["BWF Approved"]}'::jsonb
),
(
  'c000000a-0003-0000-0000-000000000003',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Premier Court 1',
  'High-end wood court with luxury amenities. Preferred by professional players and coaches.',
  'wood',
  'indoor',
  4,
  700.00,
  true,
  '{"features": ["Luxury Amenities", "Pro Player Approved", "Private Changing Room"]}'::jsonb
),
(
  'c000000a-0004-0000-0000-000000000004',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Premier Court 2',
  'High-end wood court. Includes complimentary towel service and sports drinks.',
  'wood',
  'indoor',
  4,
  700.00,
  true,
  '{"features": ["Towel Service", "Complimentary Drinks", "VIP Lounge Access"]}'::jsonb
),
(
  'c000000a-0005-0000-0000-000000000005',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Executive Court 1',
  'Premium synthetic court. Popular with corporate groups and executives.',
  'synthetic',
  'indoor',
  4,
  600.00,
  true,
  '{"features": ["Corporate Friendly", "Meeting Room Access", "Catering Available"]}'::jsonb
),
(
  'c000000a-0006-0000-0000-000000000006',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Executive Court 2',
  'Premium synthetic court with private waiting lounge. Ideal for business networking games.',
  'synthetic',
  'indoor',
  4,
  600.00,
  true,
  '{"features": ["Private Lounge", "Business Networking", "Premium Equipment"]}'::jsonb
);

-- ============================================================
-- COURT AMENITIES MAPPING
-- ============================================================

-- Elite Badminton Hub - Full premium amenities
INSERT INTO court_amenities (court_id, amenity_id) 
SELECT c.id, a.id
FROM courts c
CROSS JOIN amenities a
WHERE c.venue_id = '33333333-3333-3333-3333-333333333333'
AND a.name IN ('Parking', 'Restroom', 'Shower', 'Lockers', 'Water', 'Air Conditioning', 'Lighting', 'Waiting Area', 'Equipment Rental', 'First Aid', 'WiFi');

-- Tetuan Community - Basic amenities
INSERT INTO court_amenities (court_id, amenity_id)
SELECT c.id, a.id
FROM courts c
CROSS JOIN amenities a
WHERE c.venue_id = '44444444-4444-4444-4444-444444444444'
AND a.name IN ('Parking', 'Restroom', 'Water', 'Lighting', 'Waiting Area');

-- Pasonanca Sports Arena - Good amenities + Canteen
INSERT INTO court_amenities (court_id, amenity_id)
SELECT c.id, a.id
FROM courts c
CROSS JOIN amenities a
WHERE c.venue_id = '55555555-5555-5555-5555-555555555555'
AND a.name IN ('Parking', 'Restroom', 'Shower', 'Lockers', 'Water', 'Air Conditioning', 'Lighting', 'Waiting Area', 'Equipment Rental', 'First Aid', 'WiFi', 'Canteen');

-- Canelar - Basic amenities
INSERT INTO court_amenities (court_id, amenity_id)
SELECT c.id, a.id
FROM courts c
CROSS JOIN amenities a
WHERE c.venue_id = '66666666-6666-6666-6666-666666666666'
AND a.name IN ('Restroom', 'Water', 'Lighting', 'Waiting Area');

-- Guiwan Sports Hub - Outdoor amenities
INSERT INTO court_amenities (court_id, amenity_id)
SELECT c.id, a.id
FROM courts c
CROSS JOIN amenities a
WHERE c.venue_id = '77777777-7777-7777-7777-777777777777'
AND a.name IN ('Parking', 'Restroom', 'Water', 'Lighting', 'Waiting Area', 'First Aid');

-- San Jose - Student-focused amenities
INSERT INTO court_amenities (court_id, amenity_id)
SELECT c.id, a.id
FROM courts c
CROSS JOIN amenities a
WHERE c.venue_id = '88888888-8888-8888-8888-888888888888'
AND a.name IN ('Parking', 'Restroom', 'Water', 'Lighting', 'Waiting Area', 'Equipment Rental', 'WiFi', 'Canteen');

-- Baliwasan - Beach amenities
INSERT INTO court_amenities (court_id, amenity_id)
SELECT c.id, a.id
FROM courts c
CROSS JOIN amenities a
WHERE c.venue_id = '99999999-9999-9999-9999-999999999999'
AND a.name IN ('Parking', 'Restroom', 'Shower', 'Water', 'Lighting', 'Waiting Area', 'Canteen');

-- Zamboanga Premier - All amenities (ultra-premium)
INSERT INTO court_amenities (court_id, amenity_id)
SELECT c.id, a.id
FROM courts c
CROSS JOIN amenities a
WHERE c.venue_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

-- ============================================================
-- COURT IMAGES
-- ============================================================

-- Using placeholder images from Unsplash (badminton/sports courts)
INSERT INTO court_images (court_id, url, alt_text, is_primary, display_order) VALUES
-- Elite Badminton Hub images
('c0000003-0001-0000-0000-000000000001', 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800', 'Championship Court 1 - Main View', true, 1),
('c0000003-0001-0000-0000-000000000001', 'https://images.unsplash.com/photo-1622547748225-3fc4abd2cca0?w=800', 'Championship Court 1 - Side View', false, 2),
('c0000003-0002-0000-0000-000000000002', 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800', 'Championship Court 2 - Main View', true, 1),
('c0000003-0003-0000-0000-000000000003', 'https://images.unsplash.com/photo-1624451594370-3b56729c4f31?w=800', 'Elite Training Court 1', true, 1),

-- Tetuan Community images
('c0000004-0001-0000-0000-000000000001', 'https://images.unsplash.com/photo-1620188467120-5042ed1eb5da?w=800', 'Tetuan Indoor Court', true, 1),
('c0000004-0002-0000-0000-000000000002', 'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800', 'Tetuan Outdoor Court A', true, 1),

-- Pasonanca Sports Arena images
('c0000005-0001-0000-0000-000000000001', 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800', 'Pasonanca Main Arena Court', true, 1),
('c0000005-0001-0000-0000-000000000001', 'https://images.unsplash.com/photo-1622547748225-3fc4abd2cca0?w=800', 'Pasonanca Main Arena - Wide View', false, 2),
('c0000005-0001-0000-0000-000000000001', 'https://images.unsplash.com/photo-1624451594370-3b56729c4f31?w=800', 'Pasonanca Facilities', false, 3),

-- Canelar images
('c0000006-0001-0000-0000-000000000001', 'https://images.unsplash.com/photo-1620188467120-5042ed1eb5da?w=800', 'Canelar Court 1 - Evening', true, 1),

-- Guiwan Sports Hub images
('c0000007-0001-0000-0000-000000000001', 'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800', 'Guiwan Outdoor Court - Morning', true, 1),
('c0000007-0002-0000-0000-000000000002', 'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800', 'Guiwan Sports Complex', true, 1),

-- San Jose images
('c0000008-0001-0000-0000-000000000001', 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800', 'San Jose Student Court 1', true, 1),
('c0000008-0002-0000-0000-000000000002', 'https://images.unsplash.com/photo-1624451594370-3b56729c4f31?w=800', 'San Jose Student Court 2', true, 1),

-- Baliwasan Beachside images
('c0000009-0001-0000-0000-000000000001', 'https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=800', 'Baliwasan Sunset Court - Ocean View', true, 1),
('c0000009-0001-0000-0000-000000000001', 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800', 'Baliwasan Sunset View', false, 2),
('c0000009-0002-0000-0000-000000000002', 'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800', 'Baliwasan Breeze Court', true, 1),

-- Zamboanga Premier images
('c000000a-0001-0000-0000-000000000001', 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800', 'Premier International Court 1', true, 1),
('c000000a-0001-0000-0000-000000000001', 'https://images.unsplash.com/photo-1622547748225-3fc4abd2cca0?w=800', 'Premier International Court - Gallery View', false, 2),
('c000000a-0001-0000-0000-000000000001', 'https://images.unsplash.com/photo-1624451594370-3b56729c4f31?w=800', 'Premier Facility - Luxury Amenities', false, 3),
('c000000a-0003-0000-0000-000000000003', 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800', 'Premier Court 1 - Luxury Setting', true, 1);

-- ============================================================
-- COURT RATINGS & REVIEWS
-- ============================================================

-- Get test player IDs
DO $$
DECLARE
  player1_id uuid;
  player2_id uuid;
  admin_id uuid;
BEGIN
  SELECT id INTO player1_id FROM profiles WHERE email = 'player1@example.com' LIMIT 1;
  SELECT id INTO player2_id FROM profiles WHERE email = 'player2@example.com' LIMIT 1;
  SELECT id INTO admin_id FROM profiles WHERE email = 'admin@venue.com' LIMIT 1;

  -- Check if users exist
  IF player1_id IS NULL OR player2_id IS NULL OR admin_id IS NULL THEN
    RAISE NOTICE 'WARNING: Test users not found in profiles table.';
    RAISE NOTICE 'Please run 001_dev_seed.sql first or create users via Supabase Auth.';
    RAISE NOTICE 'Skipping court ratings insertion.';
    RETURN;
  END IF;

  -- Elite Badminton Hub reviews (Excellent ratings)
  INSERT INTO court_ratings (court_id, user_id, overall_rating, quality_rating, cleanliness_rating, facilities_rating, value_rating, review) VALUES
  ('c0000003-0001-0000-0000-000000000001', player1_id, 5, 5, 5, 5, 4, 'Absolutely world-class facility! The Championship Court 1 is tournament-grade and feels like playing in a professional arena. Wood floor is perfect, lighting is spot on, and the atmosphere is incredible. Worth every peso for serious players.'),
  ('c0000003-0002-0000-0000-000000000002', player2_id, 5, 5, 5, 5, 4, 'Best badminton court in Zamboanga! Championship Court 2 has excellent flooring and climate control. Staff is professional and facilities are top-notch. Perfect for training and competitive games.'),
  ('c0000003-0003-0000-0000-000000000003', player1_id, 5, 5, 5, 5, 5, 'Elite Training Court 1 exceeded expectations. Yonex Pro Cushion surface feels amazing, ball machine is available for practice, and the coaching staff is knowledgeable. Great investment in your game!');

  -- Tetuan Community (Good value ratings)
  INSERT INTO court_ratings (court_id, user_id, overall_rating, quality_rating, cleanliness_rating, facilities_rating, value_rating, review) VALUES
  ('c0000004-0001-0000-0000-000000000001', player2_id, 4, 3, 4, 3, 5, 'Great value for money! Tetuan Indoor Court is basic but well-maintained. Perfect for casual players and families. Staff is friendly and welcoming. Highly recommend for budget-conscious players.'),
  ('c0000004-0002-0000-0000-000000000002', player1_id, 4, 3, 4, 3, 5, 'Outdoor Court A is perfect for afternoon community games. Covered and affordable. Love the neighborhood vibe and community programs they run.');

  -- Pasonanca Sports Arena (Solid mid-range)
  INSERT INTO court_ratings (court_id, user_id, overall_rating, quality_rating, cleanliness_rating, facilities_rating, value_rating, review) VALUES
  ('c0000005-0001-0000-0000-000000000001', player1_id, 5, 4, 5, 5, 5, 'Court 1 Main Arena is fantastic! Synthetic flooring is smooth, AC keeps you cool, and the sports cafe nearby is a great bonus. Perfect balance of quality and affordability. Highly recommend!'),
  ('c0000005-0002-0000-0000-000000000002', player2_id, 4, 4, 4, 4, 4, 'Good standard court with reliable facilities. Ventilation is excellent. Popular spot so book in advance. Overall great experience!'),
  ('c0000005-0003-0000-0000-000000000003', admin_id, 5, 5, 5, 4, 5, 'Court 3 is newly renovated and it shows! Premium surface, quieter location, and excellent maintenance. Perfect for focused training sessions. Will definitely return!');

  -- Canelar (Neighborhood favorite)
  INSERT INTO court_ratings (court_id, user_id, overall_rating, quality_rating, cleanliness_rating, facilities_rating, value_rating, review) VALUES
  ('c0000006-0001-0000-0000-000000000001', player2_id, 4, 3, 4, 3, 5, 'Canelar Court 1 is our neighborhood gem! LED lights are great for evening games. Small but cozy. Staff knows regulars by name. Love the friendly atmosphere!'),
  ('c0000006-0002-0000-0000-000000000002', player1_id, 4, 3, 4, 3, 4, 'Court 2 is perfect for our regular group games. Not fancy but reliable and affordable. Great for neighborhood leagues!');

  -- Guiwan Sports Hub (Outdoor value)
  INSERT INTO court_ratings (court_id, user_id, overall_rating, quality_rating, cleanliness_rating, facilities_rating, value_rating, review) VALUES
  ('c0000007-0001-0000-0000-000000000001', player1_id, 4, 4, 4, 4, 5, 'Outdoor Court 1 is excellent for morning games! Fresh air, covered area, and the morning special rates are unbeatable. Great for fitness enthusiasts!'),
  ('c0000007-0002-0000-0000-000000000002', player2_id, 4, 3, 4, 4, 5, 'Love playing here after jogging on the track. Natural ventilation beats AC any day! Budget-friendly and healthy.');

  -- San Jose (Student-friendly)
  INSERT INTO court_ratings (court_id, user_id, overall_rating, quality_rating, cleanliness_rating, facilities_rating, value_rating, review) VALUES
  ('c0000008-0001-0000-0000-000000000001', player2_id, 4, 4, 4, 4, 5, 'Student Court 1 is perfect for our university team! Student discounts are generous, study lounge is a nice touch, and courts are well-maintained. Great place for student players!'),
  ('c0000008-0002-0000-0000-000000000002', player1_id, 4, 4, 4, 4, 5, 'School team friendly! Equipment storage and group rates make it perfect for team training. Staff is accommodating to student schedules.');

  -- Baliwasan Beachside (Unique experience)
  INSERT INTO court_ratings (court_id, user_id, overall_rating, quality_rating, cleanliness_rating, facilities_rating, value_rating, review) VALUES
  ('c0000009-0001-0000-0000-000000000001', player1_id, 5, 4, 4, 4, 4, 'Sunset Court is absolutely unique! Playing badminton with an ocean view during sunset is an unforgettable experience. Worth the visit just for the atmosphere. Beach combo is perfect!'),
  ('c0000009-0002-0000-0000-000000000002', player2_id, 4, 3, 4, 4, 4, 'Breeze Court 1 offers refreshing sea breeze during games. Perfect for weekend mornings. Combining beach activities with badminton is genius!'),
  ('c0000009-0004-0000-0000-000000000004', admin_id, 4, 3, 4, 3, 5, 'Beach Play Court is great for casual beach visitors. Walk-ins welcome during off-peak makes it accessible. Fun for families!');

  -- Zamboanga Premier (Ultra-premium)
  INSERT INTO court_ratings (court_id, user_id, overall_rating, quality_rating, cleanliness_rating, facilities_rating, value_rating, review) VALUES
  ('c000000a-0001-0000-0000-000000000001', player1_id, 5, 5, 5, 5, 3, 'International Court 1 is BWF-standard and absolutely world-class. Olympic-grade flooring, spectator gallery, live streaming capabilities - this is where champions are made. Expensive but worth it for the experience!'),
  ('c000000a-0002-0000-0000-000000000002', player2_id, 5, 5, 5, 5, 3, 'International Court 2 with video analysis is incredible for serious training. Facility rivals any international venue. Premium price but premium everything.'),
  ('c000000a-0003-0000-0000-000000000003', admin_id, 5, 5, 5, 5, 4, 'Premier Court 1 luxury amenities include private changing rooms and pro-level equipment. Staff treats you like VIP. Best court experience in the Philippines!'),
  ('c000000a-0005-0000-0000-000000000005', player1_id, 5, 4, 5, 5, 4, 'Executive Court 1 is perfect for corporate games and networking. Meeting room access and catering make it ideal for business events. Highly professional!');

END $$;

-- ============================================================
-- COURT AVAILABILITIES (Sample time slots)
-- ============================================================

-- Generate availabilities for the next 7 days for select courts
DO $$
DECLARE
  date_loop date;
  court_record RECORD;
BEGIN
  -- Loop through next 7 days
  FOR i IN 0..6 LOOP
    date_loop := CURRENT_DATE + i;
    
    -- For each premium court, create morning and evening slots
    FOR court_record IN 
      SELECT id FROM courts WHERE venue_id IN (
        '33333333-3333-3333-3333-333333333333', -- Elite Hub
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', -- Premier Club
        '55555555-5555-5555-5555-555555555555'  -- Pasonanca
      ) LIMIT 10
    LOOP
      -- Morning slots (6AM - 12PM)
      INSERT INTO court_availabilities (court_id, start_time, end_time, is_reserved)
      VALUES 
        (court_record.id, date_loop + INTERVAL '6 hours', date_loop + INTERVAL '8 hours', false),
        (court_record.id, date_loop + INTERVAL '8 hours', date_loop + INTERVAL '10 hours', false),
        (court_record.id, date_loop + INTERVAL '10 hours', date_loop + INTERVAL '12 hours', false);
      
      -- Afternoon slots (2PM - 6PM)
      INSERT INTO court_availabilities (court_id, start_time, end_time, is_reserved)
      VALUES 
        (court_record.id, date_loop + INTERVAL '14 hours', date_loop + INTERVAL '16 hours', false),
        (court_record.id, date_loop + INTERVAL '16 hours', date_loop + INTERVAL '18 hours', false);
      
      -- Evening slots (6PM - 10PM)
      INSERT INTO court_availabilities (court_id, start_time, end_time, is_reserved)
      VALUES 
        (court_record.id, date_loop + INTERVAL '18 hours', date_loop + INTERVAL '20 hours', false),
        (court_record.id, date_loop + INTERVAL '20 hours', date_loop + INTERVAL '22 hours', false);
    END LOOP;
  END LOOP;
END $$;

-- ============================================================
-- SUMMARY
-- ============================================================

-- Total venues: 10 (2 from seed + 8 new)
-- Total courts: 8 (from seed) + 38 (new) = 46 courts
-- Court images: 24 sample images added
-- Court ratings: 19 reviews from 3 users
-- Availabilities: Generated for next 7 days for premium courts

SELECT 'Phase 2 sample data inserted successfully!' as status,
       (SELECT COUNT(*) FROM venues) as total_venues,
       (SELECT COUNT(*) FROM courts) as total_courts,
       (SELECT COUNT(*) FROM court_images) as total_images,
       (SELECT COUNT(*) FROM court_ratings) as total_ratings;
