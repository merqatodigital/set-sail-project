-- Phase 3: Seed data for Marina Terrace
-- Real resort tour data for testing the read vertical slice.

INSERT INTO tenants (id, name, slug, settings) VALUES
('marina_terrace', 'Marina Terrace', 'marina_terrace', '{"siteName": "Marina Terrace", "location": "San Vicente, Palawan", "currency": "PHP"}')
ON CONFLICT(id) DO NOTHING;

INSERT INTO tenant_members (id, tenant_id, user_id, role) VALUES
('mt_owner_001', 'marina_terrace', 'owner@marinaterrace.com', 'owner'),
('mt_admin_001', 'marina_terrace', 'admin@marinaterrace.com', 'admin')
ON CONFLICT(id) DO NOTHING;

INSERT INTO tours_catalog (id, tenant_id, name, description, duration, price, capacity, inclusions, active, sort_order) VALUES
('tour_island_hopping', 'marina_terrace', 'Island Hopping', 'Full day island hopping tour visiting pristine beaches, snorkeling spots, and hidden lagoons in the Bacuit Archipelago. Lunch included.', 'Full day (8 hours)', 1800, 10, '["Boat transfer", "Guide", "Lunch", "Snorkeling gear", "Entrance fees"]', 1, 1),
('tour_reef_snorkeling', 'marina_terrace', 'Reef Snorkeling', 'Half-day snorkeling trip to protected coral reefs with abundant marine life. Perfect for beginners and families.', 'Half day (4 hours)', 1200, 8, '["Boat transfer", "Guide", "Snorkeling gear", "Refreshments"]', 1, 2),
('tour_sunset_cruise', 'marina_terrace', 'Sunset Cruise', 'Evening cruise along the coast with panoramic views of the Palawan sunset. Includes drinks and light snacks.', '3 hours', 1500, 12, '["Boat transfer", "Drinks", "Snacks", "Crew"]', 1, 3),
('tour_jungle_trek', 'marina_terrace', 'Jungle Trek', 'Guided trek through the lush Palawan jungle to a scenic waterfall. Moderate difficulty, rewarding views.', 'Half day (5 hours)', 1000, 6, '["Guide", "Lunch", "Water", "Trail fees"]', 1, 4),
('tour_diving', 'marina_terrace', 'Discover Scuba Diving', 'Introductory scuba diving experience for non-certified divers. Two dives in protected marine sanctuaries.', 'Full day (6 hours)', 3500, 4, '["Equipment", "Guide", "Boat", "Lunch", "Certification"]', 0, 5)
ON CONFLICT(id) DO NOTHING;
