-- Insert Court Ratings Only
-- Run this after creating test users (player1@example.com, player2@example.com, admin@venue.com)
-- This extracts just the ratings insertion from 002_phase2_sample_data.sql

-- Elite Badminton Hub reviews (Excellent ratings)
INSERT INTO court_ratings (court_id, user_id, overall_rating, quality_rating, cleanliness_rating, facilities_rating, value_rating, review) VALUES
('c0000003-0001-0000-0000-000000000001', (SELECT id FROM profiles WHERE email = 'player1@example.com' LIMIT 1), 5, 5, 5, 5, 4, 'Absolutely world-class facility! The Championship Court 1 is tournament-grade and feels like playing in a professional arena. Wood floor is perfect, lighting is spot on, and the atmosphere is incredible. Worth every peso for serious players.'),
('c0000003-0002-0000-0000-000000000002', (SELECT id FROM profiles WHERE email = 'player2@example.com' LIMIT 1), 5, 5, 5, 5, 4, 'Best badminton court in Zamboanga! Championship Court 2 has excellent flooring and climate control. Staff is professional and facilities are top-notch. Perfect for training and competitive games.'),
('c0000003-0003-0000-0000-000000000003', (SELECT id FROM profiles WHERE email = 'player1@example.com' LIMIT 1), 5, 5, 5, 5, 5, 'Elite Training Court 1 exceeded expectations. Yonex Pro Cushion surface feels amazing, ball machine is available for practice, and the coaching staff is knowledgeable. Great investment in your game!');

-- Tetuan Community (Good value ratings)
INSERT INTO court_ratings (court_id, user_id, overall_rating, quality_rating, cleanliness_rating, facilities_rating, value_rating, review) VALUES
('c0000004-0001-0000-0000-000000000001', (SELECT id FROM profiles WHERE email = 'player2@example.com' LIMIT 1), 4, 3, 4, 3, 5, 'Great value for money! Tetuan Indoor Court is basic but well-maintained. Perfect for casual players and families. Staff is friendly and welcoming. Highly recommend for budget-conscious players.'),
('c0000004-0002-0000-0000-000000000002', (SELECT id FROM profiles WHERE email = 'player1@example.com' LIMIT 1), 4, 3, 4, 3, 5, 'Outdoor Court A is perfect for afternoon community games. Covered and affordable. Love the neighborhood vibe and community programs they run.');

-- Pasonanca Sports Arena (Solid mid-range)
INSERT INTO court_ratings (court_id, user_id, overall_rating, quality_rating, cleanliness_rating, facilities_rating, value_rating, review) VALUES
('c0000005-0001-0000-0000-000000000001', (SELECT id FROM profiles WHERE email = 'player1@example.com' LIMIT 1), 5, 4, 5, 5, 5, 'Court 1 Main Arena is fantastic! Synthetic flooring is smooth, AC keeps you cool, and the sports cafe nearby is a great bonus. Perfect balance of quality and affordability. Highly recommend!'),
('c0000005-0002-0000-0000-000000000002', (SELECT id FROM profiles WHERE email = 'player2@example.com' LIMIT 1), 4, 4, 4, 4, 4, 'Good standard court with reliable facilities. Ventilation is excellent. Popular spot so book in advance. Overall great experience!'),
('c0000005-0003-0000-0000-000000000003', (SELECT id FROM profiles WHERE email = 'admin@venue.com' LIMIT 1), 5, 5, 5, 4, 5, 'Court 3 is newly renovated and it shows! Premium surface, quieter location, and excellent maintenance. Perfect for focused training sessions. Will definitely return!');

-- Canelar (Neighborhood favorite)
INSERT INTO court_ratings (court_id, user_id, overall_rating, quality_rating, cleanliness_rating, facilities_rating, value_rating, review) VALUES
('c0000006-0001-0000-0000-000000000001', (SELECT id FROM profiles WHERE email = 'player2@example.com' LIMIT 1), 4, 3, 4, 3, 5, 'Canelar Court 1 is our neighborhood gem! LED lights are great for evening games. Small but cozy. Staff knows regulars by name. Love the friendly atmosphere!'),
('c0000006-0002-0000-0000-000000000002', (SELECT id FROM profiles WHERE email = 'player1@example.com' LIMIT 1), 4, 3, 4, 3, 4, 'Court 2 is perfect for our regular group games. Not fancy but reliable and affordable. Great for neighborhood leagues!');

-- Guiwan Sports Hub (Outdoor value)
INSERT INTO court_ratings (court_id, user_id, overall_rating, quality_rating, cleanliness_rating, facilities_rating, value_rating, review) VALUES
('c0000007-0001-0000-0000-000000000001', (SELECT id FROM profiles WHERE email = 'player1@example.com' LIMIT 1), 4, 4, 4, 4, 5, 'Outdoor Court 1 is excellent for morning games! Fresh air, covered area, and the morning special rates are unbeatable. Great for fitness enthusiasts!'),
('c0000007-0002-0000-0000-000000000002', (SELECT id FROM profiles WHERE email = 'player2@example.com' LIMIT 1), 4, 3, 4, 4, 5, 'Love playing here after jogging on the track. Natural ventilation beats AC any day! Budget-friendly and healthy.');

-- San Jose (Student-friendly)
INSERT INTO court_ratings (court_id, user_id, overall_rating, quality_rating, cleanliness_rating, facilities_rating, value_rating, review) VALUES
('c0000008-0001-0000-0000-000000000001', (SELECT id FROM profiles WHERE email = 'player2@example.com' LIMIT 1), 4, 4, 4, 4, 5, 'Student Court 1 is perfect for our university team! Student discounts are generous, study lounge is a nice touch, and courts are well-maintained. Great place for student players!'),
('c0000008-0002-0000-0000-000000000002', (SELECT id FROM profiles WHERE email = 'player1@example.com' LIMIT 1), 4, 4, 4, 4, 5, 'School team friendly! Equipment storage and group rates make it perfect for team training. Staff is accommodating to student schedules.');

-- Baliwasan Beachside (Unique experience)
INSERT INTO court_ratings (court_id, user_id, overall_rating, quality_rating, cleanliness_rating, facilities_rating, value_rating, review) VALUES
('c0000009-0001-0000-0000-000000000001', (SELECT id FROM profiles WHERE email = 'player1@example.com' LIMIT 1), 5, 4, 4, 4, 4, 'Sunset Court is absolutely unique! Playing badminton with an ocean view during sunset is an unforgettable experience. Worth the visit just for the atmosphere. Beach combo is perfect!'),
('c0000009-0002-0000-0000-000000000002', (SELECT id FROM profiles WHERE email = 'player2@example.com' LIMIT 1), 4, 3, 4, 4, 4, 'Breeze Court 1 offers refreshing sea breeze during games. Perfect for weekend mornings. Combining beach activities with badminton is genius!'),
('c0000009-0004-0000-0000-000000000004', (SELECT id FROM profiles WHERE email = 'admin@venue.com' LIMIT 1), 4, 3, 4, 3, 5, 'Beach Play Court is great for casual beach visitors. Walk-ins welcome during off-peak makes it accessible. Fun for families!');

-- Zamboanga Premier (Ultra-premium)
INSERT INTO court_ratings (court_id, user_id, overall_rating, quality_rating, cleanliness_rating, facilities_rating, value_rating, review) VALUES
('c000000a-0001-0000-0000-000000000001', (SELECT id FROM profiles WHERE email = 'player1@example.com' LIMIT 1), 5, 5, 5, 5, 3, 'International Court 1 is BWF-standard and absolutely world-class. Olympic-grade flooring, spectator gallery, live streaming capabilities - this is where champions are made. Expensive but worth it for the experience!'),
('c000000a-0002-0000-0000-000000000002', (SELECT id FROM profiles WHERE email = 'player2@example.com' LIMIT 1), 5, 5, 5, 5, 3, 'International Court 2 with video analysis is incredible for serious training. Facility rivals any international venue. Premium price but premium everything.'),
('c000000a-0003-0000-0000-000000000003', (SELECT id FROM profiles WHERE email = 'admin@venue.com' LIMIT 1), 5, 5, 5, 5, 4, 'Premier Court 1 luxury amenities include private changing rooms and pro-level equipment. Staff treats you like VIP. Best court experience in the Philippines!'),
('c000000a-0005-0000-0000-000000000005', (SELECT id FROM profiles WHERE email = 'player1@example.com' LIMIT 1), 5, 4, 5, 5, 4, 'Executive Court 1 is perfect for corporate games and networking. Meeting room access and catering make it ideal for business events. Highly professional!');

-- Summary
SELECT 'Court ratings inserted successfully!' as status,
       (SELECT COUNT(*) FROM court_ratings) as total_ratings;
