/**
 * Pre-cached emergency resources data for offline access.
 * Seeded into IndexedDB so it is permanently available without network connectivity.
 */

export const INITIAL_EMERGENCY_RESOURCES = [
  // ==========================================
  // 1. EMERGENCY HELPLINES (One-touch dialing)
  // ==========================================
  {
    id: 'helpline_112',
    category: 'helpline',
    title: 'National Emergency Unified Number',
    number: '112',
    description: 'All-in-one emergency response service connecting Police, Fire, and Ambulance.',
    availability: '24/7 Toll-Free',
    priority: 1,
    isSaved: true
  },
  {
    id: 'helpline_1078',
    category: 'helpline',
    title: 'NDRF Disaster Management Helpline',
    number: '1078',
    description: 'National Disaster Response Force control room for floods, cyclones, and landslides.',
    availability: '24/7 Toll-Free',
    priority: 2,
    isSaved: true
  },
  {
    id: 'helpline_108',
    category: 'helpline',
    title: 'Emergency Medical & Ambulance',
    number: '108',
    description: 'Free ambulance dispatch service for urgent medical emergencies and trauma.',
    availability: '24/7 Toll-Free',
    priority: 3,
    isSaved: true
  },
  {
    id: 'helpline_101',
    category: 'helpline',
    title: 'Fire & Rescue Service',
    number: '101',
    description: 'Fire control room and structural collapse search and rescue teams.',
    availability: '24/7 Toll-Free',
    priority: 4,
    isSaved: true
  },
  {
    id: 'helpline_100',
    category: 'helpline',
    title: 'Police Emergency Response',
    number: '100',
    description: 'Law enforcement, public safety alerts, and immediate protection.',
    availability: '24/7 Toll-Free',
    priority: 5,
    isSaved: false
  },
  {
    id: 'helpline_1091',
    category: 'helpline',
    title: 'Women Safety & Crisis Helpline',
    number: '1091',
    description: 'Rapid distress assistance and shelter referral for women.',
    availability: '24/7 Toll-Free',
    priority: 6,
    isSaved: false
  },
  {
    id: 'helpline_1098',
    category: 'helpline',
    title: 'Childline Emergency Assistance',
    number: '1098',
    description: 'Protection and rescue assistance for unaccompanied minors and children.',
    availability: '24/7 Toll-Free',
    priority: 7,
    isSaved: false
  },

  // ==========================================
  // 2. FIRST-AID INSTRUCTIONS
  // ==========================================
  {
    id: 'first_aid_cpr',
    category: 'first_aid',
    title: 'Cardiopulmonary Resuscitation (CPR)',
    summary: 'Hands-only CPR for unresponsive adults with no normal breathing.',
    steps: [
      'Check responsiveness: Tap victim and shout loudly. Check breathing for no more than 10 seconds.',
      'Call 112/108 immediately or ask a bystander to call and get an AED if available.',
      'Place heel of one hand in the center of the chest (lower half of sternum), interlock other hand on top.',
      'Compress hard and fast: Push down 5 to 6 cm (2-2.4 inches) at a rate of 100-120 beats per minute (rhythm of "Stayin Alive").',
      'Allow complete chest recoil between each compression.',
      'Continue uninterrupted compressions until emergency medical personnel take over.'
    ],
    warnings: 'Do NOT stop compressions for more than 10 seconds. Do not pause if victim gasps; agonal gasps are not normal breathing.',
    isSaved: true
  },
  {
    id: 'first_aid_bleeding',
    category: 'first_aid',
    title: 'Severe Bleeding Control',
    summary: 'Rapid intervention for arterial and severe venous hemorrhages.',
    steps: [
      'Ensure safety: Put on protective gloves if accessible.',
      'Expose wound: Quickly remove or tear clothing to locate the exact source of bleeding.',
      'Apply direct firm pressure: Place a sterile gauze or clean cloth directly on the bleeding site with both hands.',
      'Maintain continuous pressure for at least 5-10 minutes without lifting the cloth to check.',
      'Pack deep wounds: If bleeding persists from a deep wound, pack gauze tightly into the cavity and compress.',
      'Apply pressure bandage: Secure the dressing with an elastic wrap.',
      'If bleeding from an arm or leg is life-threatening and direct pressure fails, apply a commercial or improvised tourniquet 5-7 cm above the wound (never over a joint).'
    ],
    warnings: 'Never remove embedded objects (knife, glass, metal). Stabilize object with bulky dressings on both sides.',
    isSaved: true
  },
  {
    id: 'first_aid_burns',
    category: 'first_aid',
    title: 'Burn Treatment & Thermal Injuries',
    summary: 'Immediate care for heat, chemical, or electrical burns.',
    steps: [
      'Stop the burning process: Remove patient from source of heat. Smother flames with blanket if clothing is burning.',
      'Cool immediately: Run cool (not freezing) clean tap water over the burn for 10 to 20 minutes.',
      'Remove constrictive items: Gently take off jewelry, rings, and belts before swelling develops.',
      'Cover loosely: Protect burned skin with sterile non-stick bandage or clean plastic cling film.',
      'Prevent hypothermia: Keep patient warm with dry blanket over unburned areas.'
    ],
    warnings: 'Do NOT use ice or ice water (causes tissue necrosis). Do NOT apply butter, toothpaste, oil, or ointments. Do NOT break blisters.',
    isSaved: false
  },
  {
    id: 'first_aid_choking',
    category: 'first_aid',
    title: 'Choking Relief (Heimlich Maneuver)',
    summary: 'Clearing airway obstruction for conscious choking victims.',
    steps: [
      'Ask "Are you choking?": If victim can cough loudly or speak, encourage continued coughing.',
      'If unable to breathe, cough, or speak: Stand behind victim and wrap arms around their waist.',
      'Make a fist with one hand. Place the thumb side slightly above the navel and well below breastbone.',
      'Grasp your fist with your other hand.',
      'Deliver quick, inward and upward thrusts into abdomen.',
      'Repeat thrusts until the object is expelled or victim becomes unconscious (if unconscious, begin CPR).'
    ],
    warnings: 'For pregnant women or obese victims, perform chest thrusts at the center of the sternum instead of abdominal thrusts.',
    isSaved: false
  },
  {
    id: 'first_aid_fractures',
    category: 'first_aid',
    title: 'Fractures & Musculoskeletal Trauma',
    summary: 'Stabilizing broken bones and suspected sprains/strains.',
    steps: [
      'Immobilize the injured area: Keep the injured limb in the exact position found.',
      'Support joint above and joint below: Apply a splint (rolled cardboard, wooden slat, folded magazine) extending past both adjacent joints.',
      'Pad the splint: Use towels or clothing to cushion bony prominences.',
      'Check circulation: Ensure fingers/toes remain warm, pink, and maintain sensation after splinting.',
      'Apply cold pack: Wrapped ice pack for 15 minutes at a time to reduce swelling (never ice directly on bare skin).'
    ],
    warnings: 'Do NOT attempt to push protruding bone fragments back inside an open fracture. Cover open wounds with sterile dressing.',
    isSaved: false
  },

  // ==========================================
  // 3. EVACUATION GUIDELINES
  // ==========================================
  {
    id: 'evac_earthquake',
    category: 'evacuation',
    title: 'Earthquake Action: Drop, Cover, Hold',
    summary: 'Immediate behavioral protocol during ground shaking and aftershocks.',
    steps: [
      'DROP down onto your hands and knees. This position protects from being knocked down.',
      'COVER your head and neck under a sturdy table or desk. If no shelter nearby, crouch next to an interior wall.',
      'HOLD ON to your shelter until shaking stops. Protect your eyes and vital organs.',
      'If outdoors: Move away from buildings, streetlights, overhead power lines, and billboards. Drop to ground.',
      'If inside a high-rise: Stay inside. Do NOT run outside during shaking (falling masonry is fatal). Do NOT use elevators.',
      'After shaking stops: Check for gas leaks, turn off mains if odor detected, and evacuate using stairs.'
    ],
    warnings: 'Do NOT stand in doorways; modern doorways are no stronger than other parts of a room and offer no falling debris protection.',
    isSaved: true
  },
  {
    id: 'evac_flood',
    category: 'evacuation',
    title: 'Flood & Flash Flood Evacuation',
    summary: 'Protocols for rising waters and storm surge events.',
    steps: [
      'Move to higher ground immediately. Flash floods can develop in minutes without visible rainfall at your location.',
      'Never drive through flooded roadways: Turn Around, Don\'t Drown. Just 30 cm (12 in) of moving water can float a vehicle.',
      'Never walk through moving water: 15 cm (6 in) of swift water will knock an adult off their feet.',
      'Disconnect electrical utilities: Shut off main breaker if safe before water enters building.',
      'If trapped in building: Move to top floor or roof. Do NOT climb into a closed attic without roof exit.'
    ],
    warnings: 'Avoid contact with floodwater; it carries severe biological contaminants, raw sewage, chemical runoff, and downed electrical currents.',
    isSaved: true
  },
  {
    id: 'evac_fire',
    category: 'evacuation',
    title: 'Structure Fire Evacuation',
    summary: 'Escaping smoke and structural fire hazards.',
    steps: [
      'Stay low and crawl: Clean air and visibility are near the floor. Smoke inhalation kills faster than flames.',
      'Test doors before opening: Feel door and handle with back of hand. If hot, do NOT open; find an alternate route.',
      'Close doors behind you: Slows flame and smoke propagation.',
      'Never use elevators: Elevators can malfunction, open onto fire floors, or lose electrical power.',
      'Once outside, stay outside: Meet at pre-designated assembly point. Never re-enter a burning structure.'
    ],
    warnings: 'If clothes catch fire: Stop, Drop to the ground, and Roll back and forth until flames are extinguished.',
    isSaved: false
  },

  // ==========================================
  // 4. SHELTERS & HOSPITALS (Pre-populated)
  // ==========================================
  {
    id: 'shelter_central_hall',
    category: 'shelter',
    title: 'City Disaster Relief Center & Shelter',
    address: 'Municipal Sports Complex, Shivajinagar',
    phone: '+91-20-25501000',
    capacity: '1,500 Persons',
    facilities: ['Drinking Water', 'Generator Power', 'Emergency Rations', 'First Aid Station'],
    coordinates: { lat: 18.5314, lng: 73.8446 },
    isSaved: true
  },
  {
    id: 'shelter_red_cross',
    category: 'shelter',
    title: 'Red Cross Emergency Evacuation Camp',
    address: 'Camp Ground, M.G. Road',
    phone: '+91-20-26123456',
    capacity: '800 Persons',
    facilities: ['Medical Triage', 'Clean Sanitation', 'Child Welfare Tent', 'Food Dispatch'],
    coordinates: { lat: 18.5167, lng: 73.8789 },
    isSaved: false
  },
  {
    id: 'hospital_sassoon',
    category: 'hospital',
    title: 'Sassoon General Hospital & Level-1 Trauma',
    address: 'Station Road, Near Pune Railway Station',
    phone: '+91-20-26128000',
    facilities: ['24/7 Trauma Care', 'Blood Bank', 'Burn Unit', 'ICU', 'Helipad'],
    coordinates: { lat: 18.5262, lng: 73.8744 },
    isSaved: true
  },
  {
    id: 'hospital_deenanath',
    category: 'hospital',
    title: 'Deenanath Mangeshkar Hospital & Emergency',
    address: 'Erandwane, Near Mhatre Bridge',
    phone: '+91-20-40151000',
    facilities: ['24/7 Emergency Wing', 'Advanced Cardiac Care', 'Ambulance Fleet'],
    coordinates: { lat: 18.5028, lng: 73.8344 },
    isSaved: false
  },

  // ==========================================
  // 5. DISASTER PREPAREDNESS INSTRUCTIONS
  // ==========================================
  {
    id: 'prep_72hr_kit',
    category: 'preparedness',
    title: '72-Hour Survival Go-Bag Checklist',
    summary: 'Essential survival kit supplies every household must maintain.',
    items: [
      'Water: At least 3 liters (1 gallon) per person per day for 3 days minimum.',
      'Food: Non-perishable, ready-to-eat canned items, protein bars, high-calorie nuts.',
      'Manual can opener and multi-tool knife.',
      'Battery-powered or hand-crank emergency radio.',
      'High-lumen LED flashlight and extra batteries.',
      'First aid kit with tourniquet, antiseptic, sterile dressings, and 14-day supply of prescription medications.',
      'Whistle to signal search and rescue teams.',
      'Dust masks (N95) to filter contaminated air and smoke.',
      'Moist towelettes, garbage bags, and plastic ties for personal sanitation.',
      'Local paper street maps and waterproof document pouch with ID copies and cash.'
    ],
    isSaved: true
  },
  {
    id: 'prep_water_purify',
    category: 'preparedness',
    title: 'Emergency Water Disinfection Methods',
    summary: 'Making collected water safe to drink when municipal supply is cut.',
    steps: [
      'Pre-filtration: Pour murky water through a clean cloth, coffee filter, or towel to remove sediment.',
      'Boiling (Most Effective): Bring water to a vigorous rolling boil for at least 1 full minute (3 minutes at elevations above 2,000m). Allow to cool.',
      'Chlorine Bleach: If boiling is impossible, add 2 drops of regular, unscented 6% household bleach per liter of clear water (4 drops if cloudy). Stir and wait 30 minutes. Water should have slight chlorine smell.',
      'Water Purification Tablets: Dissolve chlorine dioxide or iodine emergency tablets according to manufacturer instructions and let stand 30 minutes.'
    ],
    warnings: 'Never use scented bleach, color-safe bleach, or pool chemicals for drinking water.',
    isSaved: false
  }
];
