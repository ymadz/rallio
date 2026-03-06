import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const OPENROUTER_API_KEY = process.env.OPENROUTER_API
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const MODEL = 'z-ai/glm-4.5-air:free'

// ── Tool definitions for function calling ──────────────────────────────
const tools = [
  {
    type: 'function' as const,
    function: {
      name: 'get_available_courts',
      description:
        'Fetches courts and venues that are currently active and verified. Returns venue names, court names, types, hourly rates, addresses, and opening hours.',
      parameters: {
        type: 'object',
        properties: {
          court_type: {
            type: 'string',
            enum: ['indoor', 'outdoor'],
            description: 'Filter by court type (optional)',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_active_queues',
      description:
        'Fetches currently active or open queue sessions (open play / walk-in sessions). Returns session details including venue, court, player count, cost, schedule, and game format.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_upcoming_reservations',
      description:
        'Fetches the current authenticated user\'s upcoming reservations/bookings. Returns court name, venue, time, status, and amount.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_court_availability',
      description:
        'Checks available time slots for a specific court on a given date. Provide the court name or venue name and date.',
      parameters: {
        type: 'object',
        properties: {
          venue_name: {
            type: 'string',
            description: 'Name (or partial name) of the venue to look up',
          },
          date: {
            type: 'string',
            description: 'Date to check in YYYY-MM-DD format',
          },
        },
        required: ['venue_name'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_queue_status',
      description:
        'Get detailed status of a particular queue session by venue name. Shows current players, max capacity, cost, game format, etc.',
      parameters: {
        type: 'object',
        properties: {
          venue_name: {
            type: 'string',
            description: 'Name or partial name of the venue with the queue',
          },
        },
        required: ['venue_name'],
      },
    },
  },
]

// ── Tool execution handlers ────────────────────────────────────────────

async function executeGetAvailableCourts(args: { court_type?: string }) {
  const supabase = await createClient()
  let query = supabase
    .from('venues')
    .select(`
      id, name, address, city, latitude, longitude, opening_hours, image_url,
      courts (
        id, name, court_type, surface_type, hourly_rate, capacity, is_active
      )
    `)
    .eq('is_active', true)
    .eq('is_verified', true)

  const { data: venues, error } = await query.limit(20)
  if (error) return { error: error.message }

  const results = (venues || []).map((v: any) => {
    let courts = (v.courts || []).filter((c: any) => c.is_active)
    if (args.court_type) {
      courts = courts.filter((c: any) => c.court_type === args.court_type)
    }
    return {
      venue: v.name,
      address: v.address,
      city: v.city,
      opening_hours: v.opening_hours,
      courts: courts.map((c: any) => ({
        name: c.name,
        type: c.court_type,
        surface: c.surface_type,
        rate_per_hour: c.hourly_rate,
        capacity: c.capacity,
      })),
    }
  }).filter((v: any) => v.courts.length > 0)

  return { venues: results, count: results.length }
}

async function executeGetActiveQueues() {
  const supabase = await createClient()
  const { data: queues, error } = await supabase
    .from('queue_sessions')
    .select(`
      id, start_time, end_time, mode, game_format, max_players,
      current_players_count, cost_per_game, status, is_public,
      courts (
        name,
        venues ( name, address )
      )
    `)
    .in('status', ['open', 'active'])
    .eq('is_public', true)
    .order('start_time', { ascending: true })
    .limit(15)

  if (error) return { error: error.message }

  return {
    queues: (queues || []).map((q: any) => ({
      venue: q.courts?.venues?.name,
      address: q.courts?.venues?.address,
      court: q.courts?.name,
      status: q.status,
      mode: q.mode,
      game_format: q.game_format,
      players: `${q.current_players_count}/${q.max_players}`,
      cost_per_game: q.cost_per_game,
      start_time: q.start_time,
      end_time: q.end_time,
    })),
    count: (queues || []).length,
  }
}

async function executeGetUpcomingReservations() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const { data: reservations, error } = await supabase
    .from('reservations')
    .select(`
      id, start_time, end_time, status, total_amount, amount_paid,
      num_players, notes,
      courts (
        name,
        venues ( name, address )
      )
    `)
    .eq('user_id', user.id)
    .gte('start_time', new Date().toISOString())
    .in('status', ['pending_payment', 'confirmed', 'partially_paid', 'ongoing'])
    .order('start_time', { ascending: true })
    .limit(10)

  if (error) return { error: error.message }

  return {
    bookings: (reservations || []).map((r: any) => ({
      venue: r.courts?.venues?.name,
      court: r.courts?.name,
      status: r.status,
      start_time: r.start_time,
      end_time: r.end_time,
      total_amount: r.total_amount,
      amount_paid: r.amount_paid,
      players: r.num_players,
    })),
    count: (reservations || []).length,
  }
}

async function executeGetCourtAvailability(args: {
  venue_name: string
  date?: string
}) {
  const supabase = await createClient()
  const targetDate = args.date || new Date().toISOString().split('T')[0]

  // Find the venue
  const { data: venues } = await supabase
    .from('venues')
    .select('id, name, courts ( id, name, hourly_rate, court_type )')
    .eq('is_active', true)
    .ilike('name', `%${args.venue_name}%`)
    .limit(3)

  if (!venues || venues.length === 0)
    return { error: `No venue found matching "${args.venue_name}"` }

  const venue = venues[0] as any
  const courtIds = (venue.courts || []).map((c: any) => c.id)

  if (courtIds.length === 0) return { venue: venue.name, courts: [], note: 'No courts found' }

  // Check reservations for this date
  const dayStart = `${targetDate}T00:00:00`
  const dayEnd = `${targetDate}T23:59:59`

  const { data: reservations } = await supabase
    .from('reservations')
    .select('court_id, start_time, end_time, status')
    .in('court_id', courtIds)
    .gte('start_time', dayStart)
    .lte('start_time', dayEnd)
    .in('status', ['confirmed', 'pending_payment', 'ongoing'])

  return {
    venue: venue.name,
    date: targetDate,
    courts: (venue.courts || []).map((c: any) => ({
      name: c.name,
      type: c.court_type,
      rate_per_hour: c.hourly_rate,
      booked_slots: (reservations || [])
        .filter((r: any) => r.court_id === c.id)
        .map((r: any) => ({
          start: r.start_time,
          end: r.end_time,
          status: r.status,
        })),
    })),
  }
}

async function executeGetQueueStatus(args: { venue_name: string }) {
  const supabase = await createClient()

  const { data: queues, error } = await supabase
    .from('queue_sessions')
    .select(`
      id, start_time, end_time, mode, game_format, max_players,
      current_players_count, cost_per_game, status, is_public,
      courts (
        name,
        venues!inner ( name, address )
      )
    `)
    .in('status', ['open', 'active', 'draft'])
    .ilike('courts.venues.name', `%${args.venue_name}%`)
    .limit(5)

  if (error) return { error: error.message }

  const filtered = (queues || []).filter((q: any) => q.courts?.venues?.name)

  return {
    queues: filtered.map((q: any) => ({
      venue: q.courts?.venues?.name,
      court: q.courts?.name,
      status: q.status,
      mode: q.mode,
      game_format: q.game_format,
      current_players: q.current_players_count,
      max_players: q.max_players,
      cost_per_game: q.cost_per_game,
      start_time: q.start_time,
      end_time: q.end_time,
      is_public: q.is_public,
    })),
    count: filtered.length,
  }
}

async function executeTool(name: string, args: any): Promise<any> {
  switch (name) {
    case 'get_available_courts':
      return executeGetAvailableCourts(args)
    case 'get_active_queues':
      return executeGetActiveQueues()
    case 'get_upcoming_reservations':
      return executeGetUpcomingReservations()
    case 'get_court_availability':
      return executeGetCourtAvailability(args)
    case 'get_queue_status':
      return executeGetQueueStatus(args)
    default:
      return { error: `Unknown tool: ${name}` }
  }
}

// ── System prompt grounded in codebase ─────────────────────────────────

const SYSTEM_PROMPT = `You are IO, the friendly AI assistant for Rallio — a badminton court finder and queue management platform in Zamboanga City, Philippines.

Your personality: Enthusiastic, helpful, witty, and badminton-obsessed. Use casual Filipino-English (Taglish is OK) when it feels natural, but default to English. Keep replies concise and scannable.

## What Rallio Does
- **Court Booking:** Users browse verified venues, pick a court, select a date/time slot, and pay via GCash or Maya (QR). Booking statuses: pending_payment → confirmed → ongoing → completed.
- **Queue / Open Play:** Queue Masters create public sessions at a venue. Players join the queue and get auto-matched into games (singles, doubles, or mixed). Cost is per game. Statuses: open → active → closed.
- **Ratings & Reviews:** After playing, users can rate venues (1-5 stars) and rate other players on sportsmanship, skill accuracy, and reliability.
- **Payments:** Handled via PayMongo (GCash, Maya QR codes). Split payments allow a group to divide the booking cost.

## Venues & Courts
- Each venue has a name, address in Zamboanga City, opening hours (per day), and one or more courts.
- Courts have a type (indoor/outdoor), surface type, hourly rate (PHP), and capacity.
- Only venues marked as verified and active appear to users.

## Booking Rules
- Users pick a date, then select available time slots (1-hour blocks).
- Double booking is prevented by a database exclusion constraint.
- Reservations expire if unpaid after 15 minutes.
- Cancellation is allowed; refund rules may apply.
- Recurring bookings (weekly) are supported.

## Queue Rules
- Anyone can join a public queue if there's room (current_players < max_players).
- Game formats: singles (2 players), doubles (4), mixed doubles (4).
- Skill-based matching balances teams automatically.
- Cost is per game. Queue Masters set the price.

## How to Answer
1. If the user asks about courts, availability, bookings, or queues, use the provided tools to fetch live data before responding.
2. Present data in a clear, friendly way — use bullet points or short lists.
3. If no data is found, say so honestly and suggest alternatives (e.g., "No open queues right now, but you can check back later or browse courts to book a private session.").
4. For questions outside badminton or Rallio, you can answer briefly, but gently steer back: "I'm at my best talking badminton! 🏸"
5. If the user asks how to do something in the app, give step-by-step instructions based on the app's pages: /courts (browse), /courts/[id] (venue detail), /courts/[id]/book (book), /queue (queue list), /bookings (my bookings).
6. Currency is Philippine Peso (₱). Format prices like ₱150/hr.
7. Times should be in Philippine Time (UTC+8).
8. Never reveal internal database IDs, migration details, or API keys.
9. Keep answers under ~200 words unless the user asks for detail.`

// ── Helpers ─────────────────────────────────────────────────────────────

function openRouterHeaders() {
  return {
    Authorization: `Bearer ${OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    'X-Title': 'Rallio',
  }
}

function openRouterBody(messages: any[], stream = false) {
  return JSON.stringify({
    model: MODEL,
    messages,
    tools,
    tool_choice: 'auto',
    max_tokens: 1024,
    temperature: 0.7,
    ...(stream ? { stream: true } : {}),
  })
}

// ── Local intent matching (no AI needed) ────────────────────────────────

interface QueueCard {
  id: string
  venue: string
  address: string
  court: string
  courtType: string
  status: string
  mode: string
  gameFormat: string
  currentPlayers: number
  maxPlayers: number
  costPerGame: number
  startTime: string
  endTime: string
}

interface BookingCard {
  id: string
  venue: string
  court: string
  status: string
  startTime: string
  endTime: string
  totalAmount: number
  amountPaid: number
  players: number
}

interface CourtCard {
  venueId: string
  venue: string
  address: string
  courts: { name: string; type: string; rate: number }[]
}

interface LocalResponse {
  content: string
  cards?: { type: 'queue' | 'booking' | 'court'; data: QueueCard | BookingCard | CourtCard }[]
  suggestions?: string[]
}

type Intent =
  | 'open_plays'
  | 'open_plays_tonight'
  | 'my_bookings'
  | 'available_courts'
  | 'how_to_book'
  | 'how_to_queue'
  | 'greeting'
  | null

function detectIntent(text: string): Intent {
  const t = text.toLowerCase().trim()

  // Greetings
  if (/^(hi|hello|hey|yo|sup|kumusta|musta|good\s*(morning|afternoon|evening))[\s!?.]*$/i.test(t))
    return 'greeting'

  // Open plays / queues tonight
  if (
    /(tonight|this evening).*(open\s*play|queue|session|game)/i.test(t) ||
    /(open\s*play|queue|session|game).*(tonight|this evening)/i.test(t)
  )
    return 'open_plays_tonight'

  // Open plays general
  if (
    /open\s*play|active\s*(queue|session)|available\s*(queue|session)|join.*(queue|game|play|session)|any.*(queue|open|session|game)/i.test(t)
  )
    return 'open_plays'

  // My bookings
  if (
    /my\s*(booking|reservation|schedule|upcoming)/i.test(t) ||
    /upcoming\s*(booking|reservation)/i.test(t) ||
    /(do i have|check).*(booking|reservation)/i.test(t)
  )
    return 'my_bookings'

  // Available courts
  if (
    /available\s*court/i.test(t) ||
    /court.*(available|open|free)/i.test(t) ||
    /where.*(play|book|badminton)/i.test(t) ||
    /show.*(court|venue)/i.test(t) ||
    /list.*(court|venue)/i.test(t) ||
    /find.*(court|venue)/i.test(t)
  )
    return 'available_courts'

  // How to book
  if (/how\s*(to|do\s*i|can\s*i)\s*(book|reserve|make.*reservation)/i.test(t))
    return 'how_to_book'

  // How to join queue
  if (/how\s*(to|do\s*i|can\s*i)\s*(join|queue|open\s*play)/i.test(t))
    return 'how_to_queue'

  return null
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Manila',
  })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Manila',
  })
}

async function getUserName(): Promise<string | null> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, first_name')
      .eq('id', user.id)
      .single()
    return profile?.display_name || profile?.first_name || null
  } catch {
    return null
  }
}

function getTimeGreeting(): string {
  const hour = new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Manila' })
  const h = parseInt(hour)
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

async function handleLocalIntent(intent: Intent): Promise<LocalResponse | null> {
  if (!intent) return null

  if (intent === 'greeting') {
    const name = await getUserName()
    const greeting = getTimeGreeting()
    return {
      content: `${greeting}${name ? `, ${name}` : ''}! 🏸 What can I help you with today?`,
      suggestions: ["Tonight's open plays", 'My bookings', 'Available courts', 'How to book'],
    }
  }

  if (intent === 'how_to_book') {
    return {
      content:
        "Here's how to book a court on Rallio:\n\n" +
        '1. Go to **Book a Court** (or tap Browse Courts)\n' +
        '2. Pick a venue you like\n' +
        '3. Tap **Book Now** on the venue page\n' +
        '4. Select your date and preferred time slots\n' +
        '5. Confirm and pay via GCash or Maya\n\n' +
        'Your booking is confirmed instantly once payment goes through! 🎯',
      suggestions: ['Available courts', 'Open plays', 'My bookings'],
    }
  }

  if (intent === 'how_to_queue') {
    return {
      content:
        "Here's how to join an open play session:\n\n" +
        '1. Go to the **Queue** section from the home page\n' +
        '2. Browse active open play sessions near you\n' +
        '3. Tap **Join Queue** on a session\n' +
        "4. You'll be auto-matched into games based on skill level\n" +
        '5. Pay per game at the rate set by the Queue Master\n\n' +
        'Easy as a drop shot! 🏓',
      suggestions: ["Tonight's open plays", 'Available courts', 'My bookings'],
    }
  }

  const supabase = await createClient()

  if (intent === 'open_plays' || intent === 'open_plays_tonight') {
    const now = new Date()
    let query = supabase
      .from('queue_sessions')
      .select(`
        id, start_time, end_time, mode, game_format, max_players,
        current_players_count, cost_per_game, status, is_public,
        courts (
          id, name, court_type,
          venues ( id, name, address, city )
        )
      `)
      .in('status', ['open', 'active'])
      .eq('is_public', true)
      .gte('end_time', now.toISOString())
      .order('start_time', { ascending: true })
      .limit(5)

    // For "tonight", filter to sessions starting today evening
    if (intent === 'open_plays_tonight') {
      const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
      const tonightStart = `${todayStr}T16:00:00+08:00`
      const tonightEnd = `${todayStr}T23:59:59+08:00`
      query = query.gte('start_time', tonightStart).lte('start_time', tonightEnd)
    }

    const { data: queues } = await query
    const name = await getUserName()
    const greeting = getTimeGreeting()

    if (!queues || queues.length === 0) {
      const { data: upcoming } = await supabase
        .from('queue_sessions')
        .select(`
          id, start_time, end_time, mode, game_format, max_players,
          current_players_count, cost_per_game, status, is_public,
          courts (
            id, name, court_type,
            venues ( id, name, address, city )
          )
        `)
        .in('status', ['open', 'active'])
        .eq('is_public', true)
        .gte('start_time', now.toISOString())
        .order('start_time', { ascending: true })
        .limit(3)

      const upcomingCards: LocalResponse['cards'] = (upcoming || []).map((q: any) => ({
        type: 'queue' as const,
        data: {
          id: q.id,
          venue: q.courts?.venues?.name || 'Unknown',
          address: q.courts?.venues?.address || '',
          court: q.courts?.name || '',
          courtType: q.courts?.court_type || '',
          status: q.status,
          mode: q.mode,
          gameFormat: q.game_format,
          currentPlayers: q.current_players_count,
          maxPlayers: q.max_players,
          costPerGame: q.cost_per_game,
          startTime: q.start_time,
          endTime: q.end_time,
        },
      }))

      const timeLabel = intent === 'open_plays_tonight' ? 'tonight' : 'right now'
      let msg = `${greeting}${name ? `, ${name}` : ''}! 🏸\n\nI checked for open plays ${timeLabel}, but it looks like we're all set for the ${intent === 'open_plays_tonight' ? 'evening' : 'moment'}.`
      if (upcomingCards.length > 0) {
        msg += ` However, I did find ${upcomingCards.length === 1 ? 'a session' : 'some sessions'} coming up!`
      }
      msg += '\n\nWould you like me to check for court availability instead? 🏓'

      return {
        content: msg,
        cards: upcomingCards.length > 0 ? upcomingCards : undefined,
        suggestions: ['Available courts', 'My bookings', 'How to book'],
      }
    }

    // Get user bookings count for context
    const { data: { user } } = await supabase.auth.getUser()
    let bookingCount = 0
    if (user) {
      const { count } = await supabase
        .from('reservations')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('start_time', now.toISOString())
        .in('status', ['pending_payment', 'confirmed', 'partially_paid', 'ongoing'])
      bookingCount = count || 0
    }

    const cards: LocalResponse['cards'] = queues.map((q: any) => ({
      type: 'queue' as const,
      data: {
        id: q.id,
        venue: q.courts?.venues?.name || 'Unknown',
        address: q.courts?.venues?.address || '',
        court: q.courts?.name || '',
        courtType: q.courts?.court_type || '',
        status: q.status,
        mode: q.mode,
        gameFormat: q.game_format,
        currentPlayers: q.current_players_count,
        maxPlayers: q.max_players,
        costPerGame: q.cost_per_game,
        startTime: q.start_time,
        endTime: q.end_time,
      },
    }))

    const timeLabel = intent === 'open_plays_tonight' ? 'tonight' : ''
    let msg = `${greeting}${name ? `, ${name}` : ''}! 🏸\n\nI found ${queues.length} open play session${queues.length > 1 ? 's' : ''} ${timeLabel}!`
    msg += `\n\nSince you have ${bookingCount} upcoming booking${bookingCount !== 1 ? 's' : ''}, this could be a great way to get some games in! 🏓`

    return {
      content: msg,
      cards,
      suggestions: ['More open plays', 'My bookings', 'Available courts'],
    }
  }

  if (intent === 'my_bookings') {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return {
        content: "You'll need to be logged in for me to check your bookings. Head to the login page first! 🔐",
        suggestions: ['Available courts', 'Open plays'],
      }
    }

    const { data: reservations } = await supabase
      .from('reservations')
      .select(`
        id, start_time, end_time, status, total_amount, amount_paid,
        num_players,
        courts (
          name,
          venues ( id, name, address )
        )
      `)
      .eq('user_id', user.id)
      .gte('start_time', new Date().toISOString())
      .in('status', ['pending_payment', 'confirmed', 'partially_paid', 'ongoing'])
      .order('start_time', { ascending: true })
      .limit(5)

    const name = await getUserName()

    if (!reservations || reservations.length === 0) {
      return {
        content: `${name ? `Hey ${name}! ` : ''}You don't have any upcoming bookings right now. Ready to book a court or join an open play? 🏸`,
        suggestions: ['Book a court', 'Open plays', 'Available courts'],
      }
    }

    const cards: LocalResponse['cards'] = reservations.map((r: any) => ({
      type: 'booking' as const,
      data: {
        id: r.id,
        venue: r.courts?.venues?.name || 'Unknown',
        court: r.courts?.name || '',
        status: r.status,
        startTime: r.start_time,
        endTime: r.end_time,
        totalAmount: r.total_amount,
        amountPaid: r.amount_paid,
        players: r.num_players,
      },
    }))

    return {
      content: `${name ? `Hey ${name}! ` : ''}You have ${reservations.length} upcoming booking${reservations.length > 1 ? 's' : ''}:`,
      cards,
      suggestions: ['Open plays', 'Book another court', 'Available courts'],
    }
  }

  if (intent === 'available_courts') {
    const { data: venues } = await supabase
      .from('venues')
      .select(`
        id, name, address, city,
        courts (
          id, name, court_type, hourly_rate, is_active
        )
      `)
      .eq('is_active', true)
      .eq('is_verified', true)
      .limit(5)

    if (!venues || venues.length === 0) {
      return {
        content: 'No verified venues found at the moment. Check back soon! 🏗️',
        suggestions: ['Open plays', 'How to book'],
      }
    }

    const cards: LocalResponse['cards'] = venues.map((v: any) => ({
      type: 'court' as const,
      data: {
        venueId: v.id,
        venue: v.name,
        address: v.address || v.city || '',
        courts: (v.courts || [])
          .filter((c: any) => c.is_active)
          .map((c: any) => ({
            name: c.name,
            type: c.court_type,
            rate: c.hourly_rate,
          })),
      },
    }))

    const name = await getUserName()
    return {
      content: `${name ? `Hey ${name}! ` : ''}Here are the available venues. Tap one to see details and book! 🏸`,
      cards,
      suggestions: ['Open plays', 'My bookings', 'How to book'],
    }
  }

  return null
}

// ── POST handler (streaming) ───────────────────────────────────────────

export async function POST(request: NextRequest) {
  if (!OPENROUTER_API_KEY) {
    return NextResponse.json(
      { error: 'OpenRouter API key not configured' },
      { status: 500 }
    )
  }

  try {
    const body = await request.json()
    const { messages } = body

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'messages array is required' },
        { status: 400 }
      )
    }

    const trimmedMessages = messages.slice(-20)

    // ── Try local intent matching first (instant, no AI call) ────────
    const lastUserMsg = [...trimmedMessages].reverse().find((m: any) => m.role === 'user')
    if (lastUserMsg) {
      const intent = detectIntent(lastUserMsg.content)
      const localResult = await handleLocalIntent(intent)
      if (localResult) {
        return NextResponse.json({
          role: 'assistant',
          content: localResult.content,
          cards: localResult.cards,
          suggestions: localResult.suggestions,
        })
      }
    }

    const fullMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...trimmedMessages,
    ]

    // ── Phase 1: non-streaming call to handle tool calls ────────────
    let response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: openRouterHeaders(),
      body: openRouterBody(fullMessages, false),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('❌ [IO Chat] OpenRouter error:', response.status, errText)
      // Return a friendly message instead of an error status so the client doesn't crash
      return NextResponse.json({
        role: 'assistant',
        content: "I'm having trouble connecting to my brain right now 🏸 Try again in a moment!",
      })
    }

    let data = await response.json()
    let assistantMessage = data.choices?.[0]?.message

    // Handle tool calls (up to 3 rounds)
    let rounds = 0
    while (assistantMessage?.tool_calls && rounds < 3) {
      rounds++

      const toolResults = await Promise.all(
        assistantMessage.tool_calls.map(async (tc: any) => {
          const args =
            typeof tc.function.arguments === 'string'
              ? JSON.parse(tc.function.arguments)
              : tc.function.arguments
          const result = await executeTool(tc.function.name, args)
          return {
            role: 'tool' as const,
            tool_call_id: tc.id,
            content: JSON.stringify(result),
          }
        })
      )

      fullMessages.push(assistantMessage)
      fullMessages.push(...toolResults)

      response = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: openRouterHeaders(),
        body: openRouterBody(fullMessages, false),
      })

      if (!response.ok) {
        console.error('❌ [IO Chat] OpenRouter follow-up error:', response.status)
        break
      }

      data = await response.json()
      assistantMessage = data.choices?.[0]?.message
    }

    // If after tool calls the model already gave a final text reply, return it
    // But if no tool calls were made at all, re-call with streaming for speed
    if (rounds > 0 || !assistantMessage?.content) {
      // Had tool calls — return the final answer directly
      const content =
        assistantMessage?.content ||
        "Sorry, I couldn't process that. Try asking again!"
      return NextResponse.json({ role: 'assistant', content })
    }

    // ── Phase 2: pure text answer — stream it for speed ─────────────
    const streamRes = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: openRouterHeaders(),
      body: JSON.stringify({
        model: MODEL,
        messages: fullMessages,
        max_tokens: 1024,
        temperature: 0.7,
        stream: true,
      }),
    })

    if (!streamRes.ok || !streamRes.body) {
      // Fallback to the non-streamed answer we already have
      return NextResponse.json({
        role: 'assistant',
        content: assistantMessage.content,
      })
    }

    // Pipe SSE from OpenRouter → client
    const encoder = new TextEncoder()
    const reader = streamRes.body.getReader()
    const decoder = new TextDecoder()

    const readable = new ReadableStream({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = decoder.decode(value, { stream: true })
            const lines = chunk.split('\n').filter((l) => l.startsWith('data: '))

            for (const line of lines) {
              const payload = line.slice(6).trim()
              if (payload === '[DONE]') {
                controller.enqueue(encoder.encode('data: [DONE]\n\n'))
                continue
              }
              try {
                const parsed = JSON.parse(payload)
                const token = parsed.choices?.[0]?.delta?.content
                if (token) {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ token })}\n\n`)
                  )
                }
              } catch {
                // skip malformed
              }
            }
          }
        } finally {
          controller.close()
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (err: any) {
    console.error('❌ [IO Chat] Server error:', err.message)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
