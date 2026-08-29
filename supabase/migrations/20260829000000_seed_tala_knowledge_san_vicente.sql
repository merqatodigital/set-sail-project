-- ============================================================================
-- SEED: Correct San Vicente property knowledge for TALA
-- Replaces the wrong El Nido entries from 20260826000000_seed_tala_knowledge_ops.sql
--
-- The previous seed described an El Nido resort (Garden View Room, Sea Breeze
-- Room, 10 min from El Nido town). Marina Terrace is in San Vicente, Palawan.
-- This migration disables the wrong entries and adds the correct ones.
--
-- Pricing is intentionally excluded — prices come from the CMS rooms/pricing
-- pages and are the single source of truth. The knowledge base contains only
-- factual, non-pricing information.
-- ============================================================================

-- Disable the wrong El Nido entries (don't delete — admin may have edited them)
UPDATE public.tala_knowledge SET enabled = false
WHERE topic IN ('operations', 'transport', 'location', 'staff', 'contact', 'payment', 'dietary', 'medical', 'amenities')
  AND label IN (
    'Breakfast Hours', 'Breakfast Included', 'WiFi Network', 'WiFi Speed',
    'Check-in Time', 'Check-out Time', 'Pet Policy',
    'Airport Transfer — Private Van', 'Airport Transfer — Shared Van',
    'Airport Transfer — Tricycle', 'Getting Here — From El Nido Town',
    'Getting Here — From Puerto Princesa City', 'Getting Here — From Lio Airport (ENI)',
    'Payment Methods', 'Deposit Policy', 'Cancellation Policy',
    'Resort Facilities', 'Room Amenities', 'Shared Kitchen', 'Tour Desk',
    'Where Is Marina Terrace', 'Nearest Town Facilities',
    'Who Runs the Resort', 'Resort Contact',
    'Dietary Requirements', 'Medical / Emergency',
    'Children and Infants', 'Room Types and Rates'
  );

-- Insert correct San Vicente property knowledge
INSERT INTO public.tala_knowledge (topic, label, body, tags, enabled, sort_order)
VALUES
  -- INTERNET / WORKSPACE
  ('operations', 'Internet Speed',
   'We use redundant Starlink Business connections with Smart 5G/4G LTE failover. Speeds average 80 to 150 Mbps. Our system automatically switches to 5G backup in under 2 seconds during any satellite drops to ensure uninterrupted video calls.',
   'wifi,internet,speed,starlink,fiber,connectivity', true, 1),

  ('operations', 'Workspace Hours',
   'The rooftop workspace is open daily from 6:00 AM to 11:00 PM. We maintain a Quiet Deep Work Policy during daytime hours to protect focus for calls and deep work.',
   'workspace,hours,coworking,roof,quiet', true, 2),

  ('operations', 'Workspace Features',
   'The rooftop offers panoramic ocean views. Every seat faces the water. Heavy canvas shading blocks tropical glare while maximizing cross-breeze. Power outlets are integrated at every seat. A backup generator ensures power is never interrupted.',
   'workspace,roof,views,ocean,power,generator', true, 3),

  ('operations', 'Evening Vibe',
   'At 5:00 PM we have a sunset reset. Laptops close, the vinyl turntable comes on, and guests enjoy a relaxed evening with community dinners on the rooftop.',
   'evening,sunset,community,dinner,vibe', true, 4),

  -- KITCHEN / FOOD
  ('operations', 'Shared Kitchen Concept',
   'We run a shared community kitchen model. You can buy fresh seafood locally, cook it, and our team handles all the cleanup. You do not have to wash dishes. The shared kitchen includes free premium cooking oils, real spices, salt, pepper, and daily cooking staples.',
   'kitchen,cook,shared,dishwashing,community', true, 5),

  ('operations', 'Buying Fresh Seafood',
   'You can buy the morning fresh catch directly from the Poblacion port, just a short walk away, and grill it on the rooftop.',
   'seafood,fresh,market,port,grill', true, 6),

  ('operations', 'Breakfast',
   'Breakfast is available daily on the rooftop terrace featuring homemade yogurt, granola, eggs, and Italian coffee.',
   'breakfast,meals,food,morning', true, 7),

  ('operations', 'Bar and Drinks',
   'We offer a curated selection of wines, Italian coffee, champagne, and cocktails on the sun terrace. Sunset sessions typically begin around 5:00 PM.',
   'bar,drinks,wine,coffee,cocktails,sunset', true, 8),

  ('operations', 'Nearby Groceries',
   'Local sari-sari stores, vegetable stands, and bakeries are within a 2-minute walking radius in Poblacion.',
   'groceries,stores,shops,poblacion', true, 9),

  ('operations', 'Meal Periods',
   'Breakfast is served until 11:00 AM. Lunch is served from 11:00 AM to 3:00 PM. Dinner is served from 5:00 PM to 9:00 PM. Drinks are available all day.',
   'meals,hours,breakfast,lunch,dinner', true, 10),

  ('operations', 'Food Ordering',
   'To order food, just tell TALA what you want from the menu and she will place the order for you. You can also order directly from the Guest Portal at /portal. Some items may be sold out for the day.',
   'food,order,menu,portal', true, 11),

  -- ROOMS (descriptions only — pricing comes from CMS)
  ('operations', 'Room Types',
   'We offer three room categories: Superior Room UNO (24 sqm), Standard Room DUE (20 sqm), and Basic Room TRE (15 sqm). All long-stay suites include high-speed Wi-Fi, AC, mini-bar, kettle, TV, hot shower, private bathroom, desk, linens, and towels.',
   'rooms,types,uno,due,tre,amenities', true, 12),

  ('operations', 'Room Details',
   'Superior Room UNO is our largest suite for 2 adults featuring a sofa, coffee table, large TV, and bright windows with city views. Standard Room DUE is a 20 sqm standard double suite with a full desk and complete amenities for up to 2 adults. Basic Room TRE is a 15 sqm compact suite designed for essential comfort, budget-friendly for up to 2 adults.',
   'rooms,uno,due,tre,description', true, 13),

  ('operations', 'Bathrooms',
   'Our private bathrooms are wet-room style, meaning the shower, toilet, and sink share a single tiled enclosure.',
   'bathroom,shower,wet room', true, 14),

  ('operations', 'Room Cleaning',
   'Our local team provides regular housekeeping to ensure your suite remains clean and comfortable during your stay.',
   'housekeeping,cleaning,room', true, 15),

  ('operations', 'Air Conditioning',
   'Every room is equipped with split-type air conditioning to keep you cool, powered by our backup generator during outages.',
   'aircon,ac,cooling,generator', true, 16),

  -- PACKAGES (descriptions only — pricing comes from CMS)
  ('operations', 'All-Inclusive Packages',
   'We offer 3-Day, 7-Day, and 15-Day All-Inclusive packages. They bundle accommodation, daily breakfast, island hopping tours, unlimited motorbike rental, and San Vicente Airport transfers. Ask TALA for details on any specific package.',
   'packages,all-inclusive,3-day,7-day,15-day', true, 17),

  -- POLICIES
  ('operations', 'Check-in and Check-out',
   'Check-in is from 1:00 PM to 9:00 PM. Please let us know your estimated arrival time in advance. Check-out is strictly by 10:30 AM to allow our team to prepare the suite for the next guest.',
   'check-in,check-out,arrival,departure,policy', true, 18),

  ('operations', 'Adults Only Policy',
   'Marina Terrace is an adults-only property. Children are not permitted to ensure a quiet work environment.',
   'adults,only,children,policy', true, 19),

  ('operations', 'Pet Policy',
   'Pets are not allowed on the property.',
   'pets,animals,dogs,cats,policy', true, 20),

  ('operations', 'Smoking Policy',
   'Smoking is only permitted in designated outdoor areas.',
   'smoking,cigarettes,policy', true, 21),

  -- TRANSPORT / LOCATION
  ('transport', 'San Vicente Airport',
   'San Vicente Airport (SWL) is only 2.3 km (1.2 miles) away, about a 5 to 10-minute drive.',
   'airport,swl,distance,drive', true, 22),

  ('transport', 'From Puerto Princesa',
   'Travel from Puerto Princesa takes about 3 to 3.5 hours via shared or private AC vans along the paved highway.',
   'puerto princesa,van,drive,3 hours', true, 23),

  ('transport', 'From El Nido',
   'Travel from El Nido takes roughly 3 hours by private car or AC van.',
   'el nido,drive,3 hours,van', true, 24),

  ('transport', 'Getting Around Town',
   'E-trikes and standard tricycles operate continuously in Poblacion. We also offer motorbike and scooter rentals at reception.',
   'tricycle,etrike,transport,town,rental', true, 25),

  ('transport', 'Parking',
   'We offer free private parking on-site for guests. No advance reservation is needed.',
   'parking,car,free', true, 26),

  ('transport', 'Nearest ATM',
   'The main municipal ATM is located in Poblacion town proper, just a short walk from our door.',
   'atm,money,cash,bank,poblacion', true, 27),

  -- LOCAL AREA
  ('location', 'San Vicente Overview',
   'San Vicente is a municipality in Palawan, Philippines. The main zones are Poblacion (town center and airport), Alimanguan (15 km north, surf town), and Port Barton (southwest across the bay, bohemian tourism enclave with bars, cafes, and dive shops).',
   'san vicente,poblacion,alimanguan,port barton,overview', true, 28),

  ('location', 'Long Beach',
   'Long Beach is a 14.7 km stretch of pristine white sand running through Poblacion, New Agutaya, San Isidro, and Alimanguan. The southern end, Pinagmangalokan Beach, is a 13-minute walk (1.1 km) away.',
   'long beach,beach,sand,walk,pinagmangalokan', true, 29),

  ('location', 'Nearby Beaches',
   'Nearby beaches include Penanindigan (2.2 km), New Capari (2.3 km), and Makatombaten (2.6 km).',
   'beaches,nearby,penanindigan,capari,makatombaten', true, 30),

  ('location', 'Port Barton',
   'Port Barton is a bohemian established tourism enclave across the bay from Poblacion. It has bars, cafes, hostels, and dive shops. By land it takes 1 to 1.5 hours looping via the Roxas highway. By boat it is only 10 to 15 minutes from Poblacion or Panindigan Beach.',
   'port barton,bay,boat,barangay,tourism', true, 31),

  ('location', 'Alimanguan',
   'Alimanguan is 15 km north of Poblacion. It is an emerging surf town and traditional fishing village with unobstructed sunsets. Tandol Rock Islet with a swim-through cave is a local landmark. The drive takes about 20 to 25 minutes on a fully paved coastal road.',
   'alimanguan,surf,fishing,village,sunset', true, 32),

  ('location', 'Surfing Season',
   'Alimanguan is the primary surf spot in San Vicente. The season runs during Amihan (Northeast Monsoon) from November to March with peak swell in January and February. It is a long sand-bottom beach break best for longboarding, noseriding, and beginners. Board rentals and local instructors are available.',
   'surf,surfing,alimanguan,november,march,amihan', true, 33),

  -- ACTIVITIES
  ('activities', 'Island Hopping',
   'We can organize island-hopping tours to 22 islets including Inaladelan (German) Island, Turtle Point, and Twin Reef. Tours depart by outrigger boat from the shore. Expect calm clear water, sea turtles, and shallow coral reefs. No guarantee on turtle sightings as they are wild.',
   'island hopping,tours,boat,inaladelan,turtle,reef', true, 34),

  ('activities', 'Pamuayan Falls',
   'Pamuayan Falls is near Port Barton. It is a relatively easy and flat 30 to 40 minute shaded jungle walk along a riverbed. The falls are 8 meters high with a deep, wide, cold freshwater pool suitable for swimming. Best combined with a Port Barton day trip.',
   'pamuayan,falls,waterfall,hike,port barton', true, 35),

  ('activities', 'Bigaho Waterfalls',
   'Bigaho or Ipanganan Waterfalls is in northern San Vicente near Alimanguan. It features a cascading tier system in dense primary forest with a natural swimming pool at the base. Known for a maintained wooden eco-walkway from the road.',
   'bigaho,ipanganan,waterfall,alimanguan,hike', true, 36),

  ('activities', 'Turtle Bay',
   'Turtle Bay or Inaladelan Island is a popular island hopping stop in Port Barton Bay. Sea turtle encounters are possible but not guaranteed as they are wild animals. The water is calm and clear with shallow coral reefs.',
   'turtle,inaladelan,island,snorkel,reef', true, 37),

  ('activities', 'German Island',
   'German Island is a white sandbar stop on island hopping tours. It has hammocks and is a popular spot for beach lunch. Part of the Port Barton Bay Marine Park.',
   'german island,sandbar,hammock,lunch,beach', true, 38),

  ('activities', 'Twin Reef',
   'Twin Reef is a shallow snorkeling spot with fan corals. Part of the Port Barton Bay Marine Park island hopping circuit. Water conditions depend on weather and tide.',
   'twin reef,snorkel,coral,marine park', true, 39),

  -- CONNECTIVITY
  ('operations', 'Cell Signal',
   'Globe and Smart have 4G/5G coverage in Poblacion though thick walls can occasionally affect indoor signal.',
   'cell,signal,globe,smart,4g,5g', true, 40),

  -- GENERAL
  ('operations', 'Quiet Environment',
   'Marina Terrace maintains a quiet environment for focused work. No loud events, parties, or noise disturbances allowed. We are a workspace-first property.',
   'quiet,noise,workspace,focus', true, 41),

  ('operations', 'Weather',
   'San Vicente has two seasons: dry season from November to May and wet season from June to October. The best months for travel are December to April with calm seas and sunny days. July to October brings occasional rain but still many clear days.',
   'weather,season,dry,wet,november,october', true, 42),

  ('operations', 'Friendly Locals',
   'San Vicente is a quiet, authentic fishing town. Locals are warm and friendly. A gentle po or Taglish phrase is always appreciated but English is widely spoken in tourist areas.',
   'locals,friendly,fishing,town,filipino', true, 43),

  ('operations', 'Drinking Water',
   'Clean, safe drinking water is provided on the rooftop for all guests.',
   'water,drinking,safe', true, 44)
ON CONFLICT DO NOTHING;
