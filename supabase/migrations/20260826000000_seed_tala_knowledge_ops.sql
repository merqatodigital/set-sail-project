-- ============================================================================
-- SEED: Resort operational knowledge into tala_knowledge
-- The tala_knowledge table currently has 12 AMUMA investment rows.
-- This migration adds the actual resort operational knowledge TALA needs
-- to answer guest questions: breakfast, WiFi, check-in/out, pets, transport,
-- payment, cancellation, amenities, location, staff, contact, dietary, medical.
--
-- Topics used by search_tala_knowledge(): operations, transport, location,
-- staff, contact, payment, dietary, medical, pets, amenities
-- ============================================================================

INSERT INTO public.tala_knowledge (topic, label, body, tags, enabled, sort_order)
VALUES
  -- BREAKFAST
  ('operations', 'Breakfast Hours',
   'Breakfast is included for all guests. Served 7:00 AM – 10:00 AM. Filipino and Continental options available. If you have dietary requirements, let the kitchen know when you arrive.',
   'breakfast,meals,food,guest', true, 1),

  ('operations', 'Breakfast Included',
   'Breakfast is complimentary for every guest staying at Marina Terrace Resort. No extra charge. You can eat as much as you like between 7:00 AM and 10:00 AM.',
   'breakfast,free,included,meals', true, 2),

  -- WIFI
  ('operations', 'WiFi Network',
   'WiFi network: MarinaTerrace_Guest. Password: Palawan2025!. Speed is around 30 Mbps via fiber with Starlink backup for outages. WiFi is available throughout the property.',
   'wifi,internet,network,password,connectivity', true, 3),

  ('operations', 'WiFi Speed',
   'We have approximately 30 Mbps fiber internet with Starlink as a backup. It is fast enough for video calls and streaming. If you experience any issues, let us know and we will check it.',
   'wifi,internet,speed,fiber,starlink', true, 4),

  -- CHECK-IN / CHECK-OUT
  ('operations', 'Check-in Time',
   'Check-in is at 2:00 PM. If you arrive earlier, let us know and we will do our best to accommodate you — rooms may still be occupied by previous guests. Early check-in is subject to availability.',
   'check-in,arrival,early,2pm', true, 5),

  ('operations', 'Check-out Time',
   'Check-out is at 12:00 NN (noon). If you need a late check-out, ask us in advance — we can often accommodate requests depending on the next guest arrival.',
   'check-out,departure,noon,late', true, 6),

  -- PETS
  ('operations', 'Pet Policy',
   'Marina Terrace Resort is pet-friendly with prior notice. Please let us know when you book if you are bringing a pet so we can prepare. There may be a small additional cleaning fee depending on the pet.',
   'pets,dogs,animals,friendly,pet-friendly', true, 7),

  -- TRANSPORT
  ('transport', 'Airport Transfer — Private Van',
   'Private van from Puerto Princesa Airport to Marina Terrace Resort: ₱1,500. Approximate travel time is 45 minutes. You can book this when you reserve your room or ask us to arrange it.',
   'airport,transfer,van,private,ppza,puerto princesa', true, 8),

  ('transport', 'Airport Transfer — Shared Van',
   'Shared van from Puerto Princesa Airport: ₱500 per person. Runs on scheduled times. Less expensive but you may wait for other passengers. Ask us for the schedule when booking.',
   'airport,transfer,shared,van,ppza', true, 9),

  ('transport', 'Airport Transfer — Tricycle',
   'Tricycle from Puerto Princesa Airport to nearby areas: around ₱200. This is a budget option for short distances. For the full 45-minute ride to the resort, we recommend a van instead.',
   'airport,transfer,tricycle,budget,transport', true, 10),

  ('transport', 'Getting Here — From El Nido Town',
   'Marina Terrace Resort is about 10 minutes by tricycle from El Nido town proper. Tricycles are available at the town center. The fare is approximately ₱150–₱200 depending on negotiation.',
   'el nido,town,tricycle,distance,10 minutes', true, 11),

  ('transport', 'Getting Here — From Puerto Princesa City',
   'From Puerto Princesa city to Marina Terrace Resort: 4–5 hours by van. You can book a private van (₱1,500) or a shared van (₱500 per person) from the airport or city proper.',
   'puerto princesa,van,car,4 hours,5 hours,drive', true, 12),

  ('transport', 'Getting Here — From Lio Airport (ENI)',
   'From Lio Airport (El Nido/ENI): approximately 15 minutes by van. Let us know your flight details and we can arrange pickup.',
   'liao airport,ENI,el nido airport,15 minutes,van', true, 13),

  -- PAYMENT
  ('payment', 'Payment Methods',
   'We accept: GCash, Maya, cash (PHP or USD), bank transfer (BDO or BPI), and credit cards (Visa/Mastercard — 3% processing fee applies). GCash and Maya are the most convenient for most guests.',
   'payment,gcash,maya,cash,bank,transfer,credit card,php,usd', true, 14),

  ('payment', 'Deposit Policy',
   'A 50% deposit is required to confirm a booking. The remaining balance is due on check-in. You can pay the deposit via GCash, Maya, bank transfer, or credit card.',
   'deposit,50%,confirmation,balance,check-in', true, 15),

  ('payment', 'Cancellation Policy',
   'Free cancellation: 7 or more days before check-in — full refund. 3–6 days before check-in — 50% refund. 0–2 days before check-in — no refund. Contact us as soon as possible if you need to cancel or change your dates.',
   'cancellation,refund,7 days,3 days,no refund,policy', true, 16),

  -- AMENITIES / FACILITIES
  ('amenities', 'Resort Facilities',
   'Marina Terrace Resort features: garden terrace, shared kitchen (available for guests who want to cook), on-site tour desk (book tours directly), WiFi throughout the property, and complimentary breakfast. There is no pool and no gym on-site.',
   'facilities,pool,gym,kitchen,tour desk,garden,no pool,no gym', true, 17),

  ('amenities', 'Room Amenities',
   'All rooms at Marina Terrace Resort include: daily breakfast, WiFi, hot shower, and daily housekeeping. Rooms have 220V electricity with standard Philippines outlets (Type A/B — flat parallel pins). A backup generator is available.',
   'amenities,hot shower,housekeeping,220V,outlets,type a,type b,generator', true, 18),

  ('amenities', 'Shared Kitchen',
   'We have a shared kitchen available for guests who want to cook their own meals. It has basic equipment and cooking facilities. Let us know if you need anything specific and we will do our best to help.',
   'kitchen,cook,shared,cooking,facilities', true, 19),

  ('amenities', 'Tour Desk',
   'Our on-site tour desk can book tours for you directly. Available tours include Island Hopping Tour A and B, Underground River Tour, and Sunset Beach Tour. You can book at any time during your stay — no need to book in advance online.',
   'tour desk,tours,booking,island hopping,underground river,sunset', true, 20),

  -- LOCATION
  ('location', 'Where Is Marina Terrace',
   'Marina Terrace Resort is located in the El Nido area of Palawan, Philippines — about 10 minutes by tricycle from El Nido town proper. It is not in El Nido town itself. The nearest major airport is Puerto Princesa (PPZA), about 45 minutes away by van.',
   'location,where,el nido,palawan,map,distance,10 minutes', true, 21),

  ('location', 'Nearest Town Facilities',
   'El Nido town is 10 minutes away by tricycle and has: ATMs, shops, restaurants, bars, pharmacies, and massage services. Most guests visit town for dinner or supplies. Tricycles are available at any time.',
   'el nido,town,facilities,ATMs,shops,restaurants,pharmacies,massage', true, 22),

  -- STAFF / CONTACT
  ('staff', 'Who Runs the Resort',
   'Marina Terrace Resort is owned and operated by Giacomo Gervasutti (Founder), with Irina Feleo as Cofounder and Creative Director, and Joaquin Esquivias as Chief Legal and Strategy Officer. The on-site team is ready to help you during your stay.',
   'staff,owner,team,manager,contact,who', true, 23),

  ('contact', 'Resort Contact',
   'You can reach Marina Terrace Resort through this chat, by email, or by phone. If you need immediate assistance during your stay, ask any team member on the property. For booking inquiries, use the chat or the booking form on our website.',
   'contact,phone,email,chat,how to reach,get in touch', true, 24),

  -- DIETARY
  ('dietary', 'Dietary Requirements',
   'We can accommodate vegetarian, vegan, and halal meals. Let the kitchen know in advance when you arrive or include it in your booking notes. We also handle common allergies — just tell us what you need to avoid.',
   'dietary,vegetarian,vegan,halal,allergy,gluten-free,special meals,menu', true, 25),

  -- MEDICAL
  ('medical', 'Medical / Emergency',
   'The nearest clinic is El Nido Municipal Hospital, approximately 10 minutes away by tricycle. The nearest pharmacy is in El Nido town proper. For any medical emergency, contact our staff immediately and we will help arrange transport.',
   'medical,emergency,clinic,hospital,pharmacy,doctor,nurse,health', true, 26),

  -- CHILDREN
  ('operations', 'Children and Infants',
   'Children are welcome at Marina Terrace Resort. Please let us know the ages of any children when booking so we can prepare appropriately. Infants and young children can stay in the room with parents. There is no dedicated kids club or childcare — parents are responsible for their children at all times.',
   'children,kids,infant,baby,childcare,family,young', true, 27),

  -- ROOMS
  ('operations', 'Room Types and Rates',
   'Garden View Room — ₱2,500/night (sleeps 2). Sea Breeze Room — ₱3,500/night (sleeps 2). Deluxe Terrace Suite — ₱5,000/night (sleeps 3). Full Villa — ₱7,500/night (sleeps 4). All rates are per night, subject to availability. Always check availability before quoting a price to a guest. All rooms include daily breakfast, WiFi, hot shower, and daily housekeeping.',
   'rooms,types,rates,price,per night,garden,sea breeze,suite,villa,sleeps', true, 28);

