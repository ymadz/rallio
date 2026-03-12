'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

// ── Types ──────────────────────────────────────────────────────────────

interface QueueCard {
  id: string;
  venue: string;
  address: string;
  court: string;
  courtType: string;
  status: string;
  mode: string;
  gameFormat: string;
  currentPlayers: number;
  maxPlayers: number;
  costPerGame: number;
  startTime: string;
  endTime: string;
}

interface BookingCard {
  id: string;
  venue: string;
  court: string;
  status: string;
  startTime: string;
  endTime: string;
  totalAmount: number;
  amountPaid: number;
  players: number;
}

interface CourtCard {
  venueId: string;
  venue: string;
  address: string;
  courts: { name: string; type: string; rate: number }[];
}

interface CardItem {
  type: 'queue' | 'booking' | 'court';
  data: QueueCard | BookingCard | CourtCard;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  cards?: CardItem[];
  suggestions?: string[];
}

// ── Helpers ────────────────────────────────────────────────────────────

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Manila',
  });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Manila',
  });
}

function statusLabel(s: string) {
  const map: Record<string, string> = {
    open: 'Open',
    active: 'Active',
    confirmed: 'Confirmed',
    pending_payment: 'Pending Payment',
    partially_paid: 'Partially Paid',
    ongoing: 'Ongoing',
  };
  return map[s] || s;
}

function modeLabel(m: string) {
  if (!m) return '';
  return m === 'casual' ? 'All Levels' : 'Competitive';
}

// ── Rich Card Component ────────────────────────────────────────────────

function RichCard({ card }: { card: CardItem }) {
  if (card.type === 'queue') {
    const q = card.data as QueueCard;
    return (
      <a
        href={`/queue`}
        className="block rounded-xl border border-gray-200 bg-white p-3 shadow-sm hover:shadow-md transition-shadow"
      >
        <div className="flex items-start justify-between mb-2">
          <span className="text-xs font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full">
            {statusLabel(q.status)}
          </span>
          {q.mode && (
            <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
              {modeLabel(q.mode)}
            </span>
          )}
        </div>
        <p className="text-sm font-semibold text-gray-900">{q.venue}</p>
        <p className="text-xs text-gray-500 mt-0.5">{q.address}</p>
        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-600">
          <span>📅 {fmtDate(q.startTime)}</span>
          <span>
            ⏰ {fmtTime(q.startTime)} – {fmtTime(q.endTime)}
          </span>
          <span>
            👥 {q.currentPlayers}/{q.maxPlayers} players
          </span>
          <span>🏸 {q.court}</span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-sm font-bold text-teal-700">₱{q.costPerGame}</span>
          <span className="text-xs text-teal-600 font-medium">View Details →</span>
        </div>
      </a>
    );
  }

  if (card.type === 'booking') {
    const b = card.data as BookingCard;
    return (
      <a
        href={`/bookings`}
        className="block rounded-xl border border-gray-200 bg-white p-3 shadow-sm hover:shadow-md transition-shadow"
      >
        <div className="flex items-center justify-between mb-2">
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              b.status === 'confirmed'
                ? 'text-green-700 bg-green-50'
                : b.status === 'pending_payment'
                  ? 'text-amber-700 bg-amber-50'
                  : 'text-gray-700 bg-gray-100'
            }`}
          >
            {statusLabel(b.status)}
          </span>
        </div>
        <p className="text-sm font-semibold text-gray-900">{b.venue}</p>
        <p className="text-xs text-gray-500 mt-0.5">{b.court}</p>
        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-600">
          <span>📅 {fmtDate(b.startTime)}</span>
          <span>
            ⏰ {fmtTime(b.startTime)} – {fmtTime(b.endTime)}
          </span>
          <span>👥 {b.players} player(s)</span>
          <span>💰 ₱{b.totalAmount}</span>
        </div>
        <div className="mt-2 text-right">
          <span className="text-xs text-teal-600 font-medium">View Booking →</span>
        </div>
      </a>
    );
  }

  if (card.type === 'court') {
    const c = card.data as CourtCard;
    return (
      <a
        href={`/courts/${c.venueId}`}
        className="block rounded-xl border border-gray-200 bg-white p-3 shadow-sm hover:shadow-md transition-shadow"
      >
        <p className="text-sm font-semibold text-gray-900">{c.venue}</p>
        <p className="text-xs text-gray-500 mt-0.5">{c.address}</p>
        <div className="mt-2 space-y-1">
          {c.courts.map((ct, idx) => (
            <div key={idx} className="flex items-center justify-between text-xs text-gray-600">
              <span>
                🏸 {ct.name} • {ct.type}
              </span>
              <span className="font-semibold text-teal-700">₱{ct.rate}/hr</span>
            </div>
          ))}
        </div>
        <div className="mt-2 text-right">
          <span className="text-xs text-teal-600 font-medium">See Court →</span>
        </div>
      </a>
    );
  }

  return null;
}

const GREETING =
  "Hey! I'm IO 🏓 Ready to serve! Hit me with your questions about courts, bookings, open plays, or literally anything badminton. Let's rally!";

export function IOChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: GREETING,
      suggestions: [
        'Any active queues?',
        'Show available courts',
        'My bookings',
        'How do I book a court?',
        'How do I join a queue?',
      ],
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Listen for the card click to open chat
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('open-io-chat', handler);
    return () => window.removeEventListener('open-io-chat', handler);
  }, []);

  // auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // focus input when panel opens
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: 'user', content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) throw new Error('Request failed');

      const contentType = res.headers.get('content-type') || '';

      if (contentType.includes('text/event-stream')) {
        // ── Streamed response — show tokens live ──
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let accumulated = '';

        setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter((l) => l.startsWith('data: '));

          for (const line of lines) {
            const payload = line.slice(6).trim();
            if (payload === '[DONE]') continue;
            try {
              const parsed = JSON.parse(payload);
              if (parsed.token) {
                accumulated += parsed.token;
                const text = accumulated;
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: 'assistant', content: text };
                  return updated;
                });
              }
            } catch {
              // skip malformed
            }
          }
        }

        if (!accumulated) {
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: 'assistant',
              content: "Hmm, I couldn't get a response. Try again!",
            };
            return updated;
          });
        }
      } else {
        // ── JSON response (local intent or tool calls) ──
        const data = await res.json();
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: data.content || "Hmm, I couldn't get a response. Try again!",
            cards: data.cards,
            suggestions: data.suggestions,
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Oops — net fault! 🏸 Something went wrong on my end. Please try again.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const handleSuggestionClick = useCallback(
    (text: string) => {
      setInput(text);
      // Trigger send on next tick so input state updates
      setTimeout(() => {
        const userMsg: Message = { role: 'user', content: text };
        const next = [...messages, userMsg];
        setMessages(next);
        setInput('');
        setLoading(true);
        fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: next.map((m) => ({ role: m.role, content: m.content })),
          }),
        })
          .then(async (res) => {
            if (!res.ok) throw new Error('Request failed');
            const contentType = res.headers.get('content-type') || '';
            if (contentType.includes('text/event-stream')) {
              const reader = res.body!.getReader();
              const decoder = new TextDecoder();
              let accumulated = '';
              setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n').filter((l) => l.startsWith('data: '));
                for (const line of lines) {
                  const payload = line.slice(6).trim();
                  if (payload === '[DONE]') continue;
                  try {
                    const parsed = JSON.parse(payload);
                    if (parsed.token) {
                      accumulated += parsed.token;
                      const t = accumulated;
                      setMessages((prev) => {
                        const updated = [...prev];
                        updated[updated.length - 1] = { role: 'assistant', content: t };
                        return updated;
                      });
                    }
                  } catch {}
                }
              }
              if (!accumulated) {
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: 'assistant',
                    content: "Hmm, I couldn't get a response. Try again!",
                  };
                  return updated;
                });
              }
            } else {
              const data = await res.json();
              setMessages((prev) => [
                ...prev,
                {
                  role: 'assistant',
                  content: data.content || "Hmm, I couldn't get a response. Try again!",
                  cards: data.cards,
                  suggestions: data.suggestions,
                },
              ]);
            }
          })
          .catch(() => {
            setMessages((prev) => [
              ...prev,
              {
                role: 'assistant',
                content: 'Oops — net fault! 🏸 Something went wrong. Please try again.',
              },
            ]);
          })
          .finally(() => setLoading(false));
      }, 0);
    },
    [messages]
  );

  // ── Floating trigger button ──────────────────────────────────────────
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Open IO assistant"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full px-5 py-3 text-white shadow-lg shadow-[#3B6A7F]/30 transition-all hover:shadow-xl hover:shadow-[#3B6A7F]/40 hover:scale-105 active:scale-95"
        style={{
          background: [
            'radial-gradient(ellipse 90% 70% at 5% 15%, rgba(163,196,167,0.70) 0%, transparent 50%)',
            'radial-gradient(ellipse 60% 50% at 95% 5%, rgba(242,232,213,0.55) 0%, transparent 45%)',
            'radial-gradient(ellipse 80% 60% at 55% 35%, rgba(94,170,168,0.45) 0%, transparent 55%)',
            'radial-gradient(ellipse 70% 50% at 70% 50%, rgba(225,211,194,0.30) 0%, transparent 50%)',
            'radial-gradient(ellipse 120% 90% at 0% 100%, rgba(20,40,50,0.95) 0%, transparent 65%)',
            'radial-gradient(ellipse 100% 70% at 30% 95%, rgba(25,45,55,0.90) 0%, transparent 55%)',
            'linear-gradient(160deg, #A3C4A7 0%, #5EAAA8 25%, #3B6A7F 50%, #1a2e38 75%, #111f28 100%)',
          ].join(', '),
        }}
      >
        {/* Badminton shuttlecock icon */}
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="17" r="4" />
          <path d="M12 13V3" />
          <path d="M8 6l4-3 4 3" />
          <path d="M7 9l5-2 5 2" />
        </svg>
        <span className="text-sm font-semibold">Ask IO</span>
      </button>
    );
  }

  // ── Chat panel ───────────────────────────────────────────────────────
  return (
    <div className="fixed bottom-0 right-0 z-50 flex flex-col sm:bottom-6 sm:right-6 w-full sm:w-[400px] h-[100dvh] sm:h-[560px] sm:rounded-2xl rounded-none bg-white shadow-2xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 text-white shrink-0"
        style={{
          background: [
            'radial-gradient(ellipse 90% 70% at 5% 15%, rgba(163,196,167,0.70) 0%, transparent 50%)',
            'radial-gradient(ellipse 60% 50% at 95% 5%, rgba(242,232,213,0.55) 0%, transparent 45%)',
            'radial-gradient(ellipse 80% 60% at 55% 35%, rgba(94,170,168,0.45) 0%, transparent 55%)',
            'radial-gradient(ellipse 70% 50% at 70% 50%, rgba(225,211,194,0.30) 0%, transparent 50%)',
            'radial-gradient(ellipse 120% 90% at 0% 100%, rgba(20,40,50,0.95) 0%, transparent 65%)',
            'radial-gradient(ellipse 100% 70% at 30% 95%, rgba(25,45,55,0.90) 0%, transparent 55%)',
            'linear-gradient(160deg, #A3C4A7 0%, #5EAAA8 25%, #3B6A7F 50%, #1a2e38 75%, #111f28 100%)',
          ].join(', '),
        }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="17" r="4" />
              <path d="M12 13V3" />
              <path d="M8 6l4-3 4 3" />
              <path d="M7 9l5-2 5 2" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-bold leading-tight">IO</h3>
            <p className="text-[10px] text-teal-100 leading-tight">Rallio Assistant</p>
          </div>
        </div>
        <button
          onClick={() => setOpen(false)}
          aria-label="Close chat"
          className="rounded-full p-1.5 hover:bg-white/20 transition-colors"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6L6 18" />
            <path d="M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-gray-50/60">
        {messages.map((msg, i) => (
          <div key={i}>
            <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' ? (
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap bg-white text-gray-800 border border-gray-200 rounded-bl-md shadow-sm`}
                  dangerouslySetInnerHTML={{ __html: msg.content }}
                />
              ) : (
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap bg-teal-600 text-white rounded-br-md`}
                >
                  {msg.content}
                </div>
              )}
            </div>

            {/* Rich cards */}
            {msg.cards && msg.cards.length > 0 && (
              <div className="mt-2 space-y-2">
                {msg.cards.map((card, ci) => (
                  <RichCard key={ci} card={card} />
                ))}
              </div>
            )}

            {/* Quick-reply suggestion buttons */}
            {msg.suggestions && msg.suggestions.length > 0 && i === messages.length - 1 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {msg.suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSuggestionClick(s)}
                    disabled={loading}
                    className="inline-flex items-center gap-1 rounded-full border border-teal-200 bg-white px-3 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-50 hover:border-teal-300 transition-colors disabled:opacity-50"
                  >
                    <span className="text-[10px]">→</span> {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 bg-teal-400 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-2 h-2 bg-teal-400 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 bg-teal-400 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-gray-200 bg-white px-3 py-2.5">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask IO"
            disabled={loading}
            className="flex-1 rounded-xl border border-gray-300 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:opacity-50 transition-shadow"
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            aria-label="Send message"
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Quick-action card for the home page grid ───────────────────────────
export function IOChatCard() {
  return (
    <button
      onClick={() => window.dispatchEvent(new Event('open-io-chat'))}
      className="quick-card text-left"
      style={{
        background: [
          'radial-gradient(ellipse 90% 70% at 5% 15%, rgba(163,196,167,0.70) 0%, transparent 50%)',
          'radial-gradient(ellipse 60% 50% at 95% 5%, rgba(242,232,213,0.55) 0%, transparent 45%)',
          'radial-gradient(ellipse 80% 60% at 55% 35%, rgba(94,170,168,0.45) 0%, transparent 55%)',
          'radial-gradient(ellipse 70% 50% at 70% 50%, rgba(225,211,194,0.30) 0%, transparent 50%)',
          'radial-gradient(ellipse 120% 90% at 0% 100%, rgba(20,40,50,0.95) 0%, transparent 65%)',
          'radial-gradient(ellipse 100% 70% at 30% 95%, rgba(25,45,55,0.90) 0%, transparent 55%)',
          'linear-gradient(160deg, #A3C4A7 0%, #5EAAA8 25%, #3B6A7F 50%, #1a2e38 75%, #111f28 100%)',
        ].join(', '),
      }}
    >
      <div
        className="card-content"
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          height: '100%',
          gap: '2rem',
        }}
      >
        <div className="card-icon-wrap">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        </div>
        <span className="card-label">Ask IO</span>
      </div>
    </button>
  );
}
