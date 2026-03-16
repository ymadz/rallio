import { createClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  ArrowRight,
  MapPin,
  Calendar,
  Zap,
  Download,
} from 'lucide-react'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Rallio | Find Courts. Book. Queue. Play.',
  description:
    'Rallio is the fastest way to find badminton courts, book slots, join queues, and play in Zamboanga City.',
}

export default async function RootPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('profile_completed')
      .eq('id', user.id)
      .single()

    if (profile?.profile_completed) {
      redirect('/home')
    }

    redirect('/setup-profile')
  }

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <style>{`
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes bounce-shuttlecock {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          50% { transform: translateY(-40px) rotate(180deg); }
          100% { transform: translateY(0) rotate(360deg); opacity: 1; }
        }
        @keyframes pulse-glow {
          0%, 100% { 
            box-shadow: 0 0 30px rgba(13, 148, 136, 0.4), 
                        inset 0 0 20px rgba(6, 182, 212, 0.1);
          }
          50% { 
            box-shadow: 0 0 50px rgba(13, 148, 136, 0.7), 
                        inset 0 0 30px rgba(6, 182, 212, 0.2);
          }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
        }
        .shuttlecock {
          animation: bounce-shuttlecock 3s ease-in-out infinite;
        }
        .glow-pulse {
          animation: pulse-glow 3s ease-in-out infinite;
        }
        .float-item {
          animation: float 4s ease-in-out infinite;
        }
        .hero-bg {
          background: linear-gradient(135deg, #ffffff 0%, #f0fdfa 25%, #e0f7f4 50%, #f0fdfa 75%, #ffffff 100%);
          position: relative;
          overflow: hidden;
        }
        .hero-bg::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 20% 30%, rgba(13, 148, 136, 0.12), transparent 40%),
                      radial-gradient(circle at 80% 70%, rgba(6, 182, 212, 0.12), transparent 45%);
          pointer-events: none;
        }
        .badge {
          animation: slideInLeft 0.6s ease-out;
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(13, 148, 136, 0.2);
        }
        .hero-title {
          animation: fadeInUp 0.8s ease-out 0.1s both;
        }
        .hero-subtitle {
          animation: fadeInUp 0.8s ease-out 0.2s both;
        }
        .cta-buttons {
          animation: fadeInUp 0.8s ease-out 0.3s both;
        }
        .flow-step {
          animation: fadeInUp 0.8s ease-out;
        }
        .glass-card {
          background: rgba(255, 255, 255, 0.15);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(13, 148, 136, 0.25);
          box-shadow: 0 8px 32px rgba(13, 148, 136, 0.1), inset 0 1px 2px rgba(255, 255, 255, 0.3);
          transition: all 0.3s ease;
        }
        .glass-card:hover {
          background: rgba(255, 255, 255, 0.25);
          border: 1px solid rgba(13, 148, 136, 0.35);
          box-shadow: 0 16px 48px rgba(13, 148, 136, 0.2), inset 0 1px 2px rgba(255, 255, 255, 0.4);
          transform: translateY(-8px);
        }
        .feature-card {
          transition: all 0.3s ease;
        }
        .feature-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 24px 48px rgba(13, 148, 136, 0.15);
        }
      `}</style>

      <header className="sticky top-0 z-30 border-b border-gray-200/70 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="Rallio home">
            <Image src="/logo.png" alt="Rallio logo" width={30} height={30} className="h-8 w-8" />
            <span className="text-sm font-bold tracking-wider text-gray-900">RALLIO</span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm text-gray-600 md:flex">
            <a href="#how" className="font-medium transition hover:text-teal-700">How it works</a>
            <a href="#why" className="font-medium transition hover:text-teal-700">Why Rallio</a>
            <a href="#download" className="font-medium transition hover:text-teal-700">Get app</a>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 transition hover:border-teal-200 hover:bg-teal-50"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-teal-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-teal-800"
            >
              Play now
            </Link>
          </div>
        </div>
      </header>

      <section className="hero-bg relative">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-28">
          <div>
            <div className="badge inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider text-teal-700">
              🏸 Built for players
            </div>

            <h1 className="hero-title mt-6 max-w-2xl text-5xl font-black tracking-tight text-gray-950 sm:text-6xl lg:text-7xl">
              Find courts.
              <span className="block text-teal-700">Queue faster.</span>
              <span className="block text-teal-700">Play more.</span>
            </h1>

            <p className="hero-subtitle mt-6 max-w-xl text-lg text-gray-700 sm:text-xl">
              Rallio gets you on court in minutes—not hours. Find nearby courts, book your slot, join the queue, and get playing. All from your phone.
            </p>

            <div className="cta-buttons mt-8 flex flex-col gap-3 sm:flex-row sm:gap-4">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-teal-700 px-8 py-4 text-base font-bold text-white transition hover:bg-teal-800 hover:shadow-lg"
              >
                Get on court
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                href="/courts"
                className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-teal-700 bg-white px-8 py-4 text-base font-bold text-teal-700 transition hover:bg-teal-50"
              >
                Browse courts
              </Link>
            </div>

            {/* Quick stats */}
            <div className="mt-12 grid grid-cols-3 gap-6 border-t border-gray-200 pt-8">
              <div>
                <p className="text-3xl font-black text-teal-700">100+</p>
                <p className="mt-1 text-sm font-medium text-gray-600">Courts</p>
              </div>
              <div>
                <p className="text-3xl font-black text-teal-700">5k+</p>
                <p className="mt-1 text-sm font-medium text-gray-600">Players</p>
              </div>
              <div>
                <p className="text-3xl font-black text-teal-700">Zero</p>
                <p className="mt-1 text-sm font-medium text-gray-600">Wait time</p>
              </div>
            </div>
          </div>

          <div className="relative flex h-96 items-center justify-center lg:h-full">
            {/* Badminton court visual */}
            <div className="float-item relative w-full">
              <div className="rounded-3xl bg-gradient-to-br from-teal-600 to-teal-800 p-8 shadow-2xl">
                {/* Court mockup */}
                <div className="rounded-2xl bg-gradient-to-b from-yellow-300 to-yellow-400 p-8">
                  <div className="space-y-4">
                    {/* Court lines */}
                    <div className="space-y-3">
                      <div className="h-1 w-full rounded-full bg-white/60"></div>
                      <div className="h-1 w-4/5 rounded-full bg-white/60"></div>
                      <div className="h-1 w-3/5 rounded-full bg-white/60"></div>
                    </div>
                    
                    {/* Shuttlecock animation */}
                    <div className="mt-8 flex justify-center">
                      <div className="shuttlecock inline-block">
                        <div className="text-4xl">🏸</div>
                      </div>
                    </div>

                    {/* Text */}
                    <div className="mt-6 text-center">
                      <p className="text-xs font-bold uppercase tracking-wider text-gray-800">Badminton</p>
                      <p className="mt-2 text-xl font-black text-gray-900">Court C-4 Available</p>
                      <p className="mt-1 text-sm font-semibold text-gray-700">₱250/hour · 2 km away</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="text-4xl font-black tracking-tight text-gray-950 sm:text-5xl">
              Three steps to court
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Find your court. Book your slot. Queue and play.
            </p>
          </div>

          <div className="relative grid grid-cols-1 gap-8 md:grid-cols-3">
            {/* Step 1 */}
            <div className="flow-step text-center">
              <div className="glow-pulse mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-teal-700">
                <MapPin className="h-10 w-10 text-white" />
              </div>
              <h3 className="mt-6 text-2xl font-bold text-gray-900">Find</h3>
              <p className="mt-3 text-gray-600">
                Discover courts near you with real-time availability and pricing
              </p>
            </div>

            {/* Step 2 */}
            <div className="flow-step animation-delay text-center">
              <div className="glow-pulse mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-cyan-700">
                <Calendar className="h-10 w-10 text-white" />
              </div>
              <h3 className="mt-6 text-2xl font-bold text-gray-900">Book</h3>
              <p className="mt-3 text-gray-600">
                Grab your preferred time slot in seconds with guaranteed confirmation
              </p>
            </div>

            {/* Step 3 */}
            <div className="flow-step animation-delay text-center">
              <div className="glow-pulse mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-cyan-600">
                <Zap className="h-10 w-10 text-white" />
              </div>
              <h3 className="mt-6 text-2xl font-bold text-gray-900">Play</h3>
              <p className="mt-3 text-gray-600">
                Join the queue, get matched with players, and get on court instantly
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="why" className="border-b border-gray-200 bg-gray-50/80">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="text-4xl font-black tracking-tight text-gray-950 sm:text-5xl">
              Why badminton players choose Rallio
            </h2>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {/* Card 1: No waiting */}
            <div className="feature-card rounded-2xl bg-white p-8 shadow-lg">
              <div className="text-4xl">⚡</div>
              <h3 className="mt-4 text-xl font-bold text-gray-900">No more waiting</h3>
              <p className="mt-3 text-gray-600">
                See real-time court availability and book instantly. No phone calls, no guessing.
              </p>
            </div>

            {/* Card 2: Fair queues */}
            <div className="feature-card rounded-2xl bg-white p-8 shadow-lg">
              <div className="text-4xl">🎯</div>
              <h3 className="mt-4 text-xl font-bold text-gray-900">Fair queues</h3>
              <p className="mt-3 text-gray-600">
                Skill-based matching and transparent rotation. Everyone gets a fair shot to play.
              </p>
            </div>

            {/* Card 3: One app, everything */}
            <div className="feature-card rounded-2xl bg-white p-8 shadow-lg">
              <div className="text-4xl">�</div>
              <h3 className="mt-4 text-xl font-bold text-gray-900">One app. Everything.</h3>
              <p className="mt-3 text-gray-600">
                Find courts, book slots, join queues, pay online, and track your wins—all in one place.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="download" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-teal-900 via-teal-800 to-cyan-800 p-10 text-white shadow-2xl sm:p-14">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-widest text-teal-200">Download the app</p>
            <h2 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">Get Rallio on your phone</h2>
            <p className="mt-6 text-lg text-teal-100">
              We're launching the mobile app soon. Get ready to find courts and play faster than ever.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-4">
              <button
                type="button"
                disabled
                className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-6 py-3 font-semibold text-white/80 opacity-60"
              >
                <Download className="h-5 w-5" />
                App Store (Coming Soon)
              </button>
              <button
                type="button"
                disabled
                className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-6 py-3 font-semibold text-white/80 opacity-60"
              >
                <Download className="h-5 w-5" />
                Google Play (Coming Soon)
              </button>
              <Link
                href="/signup"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 font-bold text-teal-900 transition hover:bg-teal-50"
              >
                Play on web now
                <ArrowRight className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-12 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Rallio" width={24} height={24} className="h-6 w-6" />
            <span className="font-bold text-gray-900">Rallio</span>
            <p className="text-sm text-gray-600">Get more court time.</p>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-sm text-gray-600">
            <Link href="/privacy" className="transition hover:text-teal-700 hover:font-semibold">Privacy</Link>
            <Link href="/terms" className="transition hover:text-teal-700 hover:font-semibold">Terms</Link>
            <Link href="/refund-policy" className="transition hover:text-teal-700 hover:font-semibold">Refund Policy</Link>
          </div>
        </div>
      </footer>
    </main>
  )
}
