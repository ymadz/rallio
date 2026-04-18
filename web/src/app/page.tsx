import { createClient } from '@/lib/supabase/server';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, Download } from 'lucide-react';
import { AnimatedLogo } from '@/components/animated-logo';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Rallio | Find Courts. Book. Queue. Play.',
  description:
    'Rallio is the fastest way to find badminton courts, book slots, join queues, and play in Zamboanga City.',
};

export default async function RootPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('profile_completed')
      .eq('id', user.id)
      .single();

    if (profile?.profile_completed) {
      redirect('/home');
    }

    redirect('/setup-profile');
  }

  // Fetch stats
  const { count: venueCount } = await supabase
    .from('venues')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true);

  const { count: playerCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true });

  // Format numbers with "+" suffix
  const formatStatNumber = (count: number | null) => {
    if (!count) return '0';
    if (count >= 1000) {
      return `${(count / 1000).toFixed(0)}k+`;
    }
    if (count >= 100) {
      return `${Math.ceil(count / 10) * 10}+`;
    }
    return count.toString();
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-white via-teal-50 to-cyan-50 text-gray-900">
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
        .glow-pulse {
          animation: pulse-glow 3s ease-in-out infinite;
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
        .glass-header {
          background: rgba(255, 255, 255, 0.8);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(13, 148, 136, 0.15);
        }
        .shuttle {
          animation: shuttle-serve 3s ease-in-out infinite;
        }
        .racket-left {
          animation: racket-left-serve 3s ease-in-out infinite;
        }
        .racket-right {
          animation: racket-right-serve 3s ease-in-out infinite;
        }
        .logo-container {
          animation: fadeInUp 1s ease-out 0.5s both;
        }
      `}</style>

      <header className="sticky top-0 z-30 glass-header border-b">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-3 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2 sm:gap-3" aria-label="Rallio home">
            <Image
              src="/logo.png"
              alt="Rallio logo"
              width={30}
              height={30}
              className="h-7 w-7 sm:h-8 sm:w-8"
              style={{
                filter:
                  'brightness(0) saturate(100%) invert(42%) sepia(93%) saturate(352%) hue-rotate(131deg) brightness(92%) contrast(92%)',
              }}
            />
            <span className="text-xs font-bold tracking-wider text-teal-700 sm:text-sm">
              RALLIO
            </span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm text-gray-600 md:flex">
            <a href="#how" className="font-medium transition hover:text-teal-700">
              How it works
            </a>
            <a href="#why" className="font-medium transition hover:text-teal-700">
              Why Rallio
            </a>
            <a href="#download" className="font-medium transition hover:text-teal-700">
              Get app
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-full border border-teal-200/50 px-3 py-2 text-xs font-semibold text-gray-800 transition hover:border-teal-300 hover:bg-teal-50/50 whitespace-nowrap sm:px-4 sm:text-sm"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-gradient-to-r from-teal-700 to-teal-600 px-3 py-2 text-xs font-bold text-white transition hover:from-teal-800 hover:to-teal-700 hover:shadow-lg whitespace-nowrap sm:px-4 sm:text-sm"
            >
              Play now
            </Link>
          </div>
        </div>
      </header>

      <section className="relative">
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-6 sm:gap-12 sm:px-6 sm:py-8 lg:grid-cols-2 lg:px-8">
          <div>
            <div className="badge inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider text-teal-700">
              🏸 Built for players
            </div>

            <h1 className="hero-title mt-5 max-w-2xl text-4xl font-black tracking-tight text-gray-950 sm:mt-6 sm:text-6xl lg:text-7xl">
              Find courts.
              <span className="block bg-gradient-to-r from-teal-700 to-cyan-600 bg-clip-text text-transparent">
                Queue faster.
              </span>
              <span className="block bg-gradient-to-r from-teal-600 to-teal-700 bg-clip-text text-transparent">
                Play more.
              </span>
            </h1>

            <p className="hero-subtitle mt-5 max-w-xl text-base text-gray-700 sm:mt-6 sm:text-xl">
              Rallio gets you on court in minutes—not hours. Find nearby courts, book your slot,
              join the queue, and get playing.
            </p>

            <div className="cta-buttons mt-7 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:gap-4">
              <Link
                href="/signup"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-teal-700 to-teal-600 px-6 py-4 text-sm font-bold text-white transition hover:from-teal-800 hover:to-teal-700 hover:shadow-xl whitespace-nowrap sm:w-auto sm:px-8 sm:text-base"
              >
                Get on court
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                href="/courts"
                className="glass-card inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-4 text-sm font-bold text-teal-700 transition whitespace-nowrap sm:w-auto sm:px-8 sm:text-base"
              >
                Browse courts
              </Link>
            </div>

            {/* Quick stats */}
            <div className="mt-10 grid grid-cols-3 gap-2 border-t border-teal-200/30 pt-8 sm:gap-6">
              <div className="min-w-0 text-center">
                <p className="bg-gradient-to-r from-teal-700 to-teal-600 bg-clip-text text-[clamp(1.35rem,5.6vw,1.875rem)] font-black leading-none text-transparent sm:text-3xl">
                  {formatStatNumber(venueCount)}
                </p>
                <p className="mt-1 whitespace-nowrap text-[11px] font-medium leading-tight text-gray-600 sm:text-sm">
                  Courts
                </p>
              </div>
              <div className="min-w-0 text-center">
                <p className="bg-gradient-to-r from-cyan-600 to-teal-600 bg-clip-text text-[clamp(1.35rem,5.6vw,1.875rem)] font-black leading-none text-transparent sm:text-3xl">
                  {formatStatNumber(playerCount)}
                </p>
                <p className="mt-1 whitespace-nowrap text-[11px] font-medium leading-tight text-gray-600 sm:text-sm">
                  Players
                </p>
              </div>
              <div className="min-w-0 text-center">
                <p className="bg-gradient-to-r from-teal-700 to-cyan-700 bg-clip-text text-[clamp(1.35rem,5.6vw,1.875rem)] font-black leading-none text-transparent sm:text-3xl">
                  Zero
                </p>
                <p className="mt-1 whitespace-nowrap text-[11px] font-medium leading-tight text-gray-600 sm:text-sm">
                  Wait time
                </p>
              </div>
            </div>
          </div>

          <div className="relative mt-6 hidden lg:flex items-center justify-center lg:mt-0 lg:h-full">
            <div className="logo-container relative flex w-full items-center justify-center -mt-2 sm:-mt-4 lg:-mt-16">
              <AnimatedLogo />
            </div>
          </div>
        </div>
      </section>

      {/* Full-width marquee banner divider */}
      <section className="w-screen relative left-1/2 right-1/2 -mx-[50vw] bg-gradient-to-r from-teal-700 via-cyan-600 to-teal-700 overflow-hidden py-6 mt-8">
        <style>{`
          @keyframes marquee {
            0% {
              transform: translateX(0);
            }
            100% {
              transform: translateX(-33.33%);
            }
          }
          .marquee-content {
            animation: marquee 30s linear infinite;
            will-change: transform;
          }
        `}</style>

        {/* Container for scrolling text */}
        <div className="relative flex overflow-hidden">
          <div className="marquee-content flex whitespace-nowrap">
            {/* Duplicated content for seamless infinite loop */}
            <span className="flex-shrink-0 px-6 text-base font-black uppercase tracking-tight text-white sm:px-8 sm:text-2xl">
              Find courts — Book slots — Queue faster — Play more
            </span>
            <span className="flex-shrink-0 px-6 text-base font-black uppercase tracking-tight text-white sm:px-8 sm:text-2xl">
              Find courts — Book slots — Queue faster — Play more
            </span>
            <span className="flex-shrink-0 px-6 text-base font-black uppercase tracking-tight text-white sm:px-8 sm:text-2xl">
              Find courts — Book slots — Queue faster — Play more
            </span>
          </div>
        </div>
      </section>

      <section id="how" className="border-b border-teal-200/20">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-32 lg:px-8">
          <div className="mb-14 text-center sm:mb-24">
            <h2 className="text-3xl font-black tracking-tight text-gray-950 sm:text-6xl">
              Three steps to court
            </h2>
            <p className="mt-4 text-base text-gray-600 sm:mt-6 sm:text-xl">
              From finding a court to playing your match—streamlined and simple.
            </p>
          </div>

          <div className="space-y-20 sm:space-y-32">
            {/* Step 1: Find - Text Left, Image Right */}
            <div className="grid grid-cols-1 items-center gap-6 sm:gap-12 lg:grid-cols-2">
              {/* Text Content */}
              <div className="flex flex-col justify-center">
                <span className="mb-4 text-sm font-bold uppercase tracking-widest text-teal-700">
                  Step 1
                </span>
                <h3 className="text-3xl font-black leading-tight text-gray-950 sm:text-4xl">
                  Find
                </h3>
                <p className="mt-4 text-base leading-relaxed text-gray-700 sm:mt-6 sm:text-lg">
                  Discover available courts near you with real-time information. Browse detailed
                  court profiles, amenities, ratings, and current pricing—all visualized on an
                  intuitive map.
                </p>
              </div>

              {/* Image Card - Rotated Clockwise */}
              <div className="relative h-64 sm:h-96">
                <div className="glass-card absolute inset-0 overflow-hidden rounded-3xl p-0 lg:[transform:rotate(3deg)]">
                  <div className="w-full h-full flex items-center justify-center">
                    <Image
                      src="/find.png"
                      alt="Screenshot of court display"
                      width={400}
                      height={300}
                      className="object-cover h-full w-full"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2: Book - Image Left, Text Right */}
            <div className="grid grid-cols-1 items-center gap-6 sm:gap-12 lg:grid-cols-2">
              {/* Image Card - Rotated Counter-Clockwise */}
              <div className="relative order-2 h-64 sm:h-96 lg:order-1">
                <div className="glass-card absolute inset-0 overflow-hidden rounded-3xl p-0 lg:[transform:rotate(-3deg)]">
                  <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                    <Image
                      src="/book.png"
                      alt="Screenshot of booking process"
                      width={400}
                      height={300}
                      className="object-cover h-full w-full"
                    />
                  </div>
                </div>
              </div>

              {/* Text Content */}
              <div className="order-1 flex flex-col justify-center lg:order-2">
                <span className="mb-4 text-sm font-bold uppercase tracking-widest text-cyan-700">
                  Step 2
                </span>
                <h3 className="text-3xl font-black leading-tight text-gray-950 sm:text-4xl">
                  Book
                </h3>
                <p className="mt-4 text-base leading-relaxed text-gray-700 sm:mt-6 sm:text-lg">
                  Secure your preferred time slot in seconds with guaranteed confirmation. Select
                  your date, time, and court preferences—checkout is fast, secure, and transparent.
                </p>
              </div>
            </div>

            {/* Step 3: Play - Text Left, Image Right */}
            <div className="grid grid-cols-1 items-center gap-6 sm:gap-12 lg:grid-cols-2">
              {/* Text Content */}
              <div className="flex flex-col justify-center">
                <span className="mb-4 text-sm font-bold uppercase tracking-widest text-teal-700">
                  Step 3
                </span>
                <h3 className="text-3xl font-black leading-tight text-gray-950 sm:text-4xl">
                  Play
                </h3>
                <p className="mt-4 text-base leading-relaxed text-gray-700 sm:mt-6 sm:text-lg">
                  Join the queue and get matched with players of similar skill level. Play your
                  match, rate your opponents, earn ratings, and start climbing the community
                  rankings.
                </p>
              </div>

              {/* Image Card - Rotated Clockwise */}
              <div className="relative h-64 sm:h-96">
                <div className="glass-card absolute inset-0 overflow-hidden rounded-3xl p-0 lg:[transform:rotate(3deg)]">
                  <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                    <Image
                      src="/play.png"
                      alt="Screenshot of playing experience"
                      width={400}
                      height={300}
                      className="object-cover h-full w-full"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="why" className="border-b border-teal-200/20">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="mb-10 text-center sm:mb-12">
            <h2 className="text-3xl font-black tracking-tight text-gray-950 sm:text-5xl">
              Why badminton players choose Rallio
            </h2>
          </div>

          <div className="grid gap-4 sm:gap-8 md:grid-cols-3">
            {/* Card 1: No waiting */}
            <div className="glass-card rounded-2xl p-6 sm:p-8">
              <div className="text-3xl sm:text-4xl">⚡</div>
              <h3 className="mt-4 text-lg font-bold text-gray-900 sm:text-xl">No more waiting</h3>
              <p className="mt-3 text-sm text-gray-700 sm:text-base">
                See real-time court availability and book instantly. No phone calls, no guessing.
              </p>
            </div>

            {/* Card 2: Fair queues */}
            <div className="glass-card rounded-2xl p-6 sm:p-8">
              <div className="text-3xl sm:text-4xl">🎯</div>
              <h3 className="mt-4 text-lg font-bold text-gray-900 sm:text-xl">Fair queues</h3>
              <p className="mt-3 text-sm text-gray-700 sm:text-base">
                Skill-based matching and transparent rotation. Everyone gets a fair shot to play.
              </p>
            </div>

            {/* Card 3: One app, everything */}
            <div className="glass-card rounded-2xl p-6 sm:p-8">
              <div className="text-3xl sm:text-4xl">📱</div>
              <h3 className="mt-4 text-lg font-bold text-gray-900 sm:text-xl">
                One app. Everything.
              </h3>
              <p className="mt-3 text-sm text-gray-700 sm:text-base">
                Find courts, book slots, join queues, pay online, and track your wins—all in one
                place.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="download" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="glass-card overflow-hidden rounded-3xl p-6 text-gray-900 sm:p-10 sm:pb-14 sm:pt-14 sm:px-14">
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-teal-500/20 via-transparent to-cyan-500/20 rounded-3xl"></div>
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-widest bg-gradient-to-r from-teal-700 to-cyan-600 bg-clip-text text-transparent">
              Download the app
            </p>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-gray-950 sm:text-5xl">
              Get Rallio on your phone
            </h2>
            <p className="mt-5 text-base text-gray-700 sm:mt-6 sm:text-lg">
              We're launching the mobile app soon. Get ready to find courts and play faster than
              ever.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-4">
              <button
                disabled
                className="inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-full border border-gray-300 bg-gray-100 px-6 py-3 text-sm font-bold text-gray-500 transition sm:w-auto"
              >
                <Download className="h-5 w-5" />
                Mobile App (Coming Soon)
              </button>
              <Link
                href="/signup"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-teal-700 to-teal-600 px-6 py-3 font-bold text-white transition hover:from-teal-800 hover:to-teal-700 hover:shadow-lg whitespace-nowrap sm:w-auto"
              >
                Play on web now
                <ArrowRight className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-teal-200/20 bg-white/40 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-3">
            <Image
              src="/logo.png"
              alt="Rallio"
              width={24}
              height={24}
              className="h-6 w-6"
              style={{
                filter:
                  'brightness(0) saturate(100%) invert(42%) sepia(93%) saturate(352%) hue-rotate(131deg) brightness(92%) contrast(92%)',
              }}
            />
            <span className="font-bold text-teal-700">Rallio</span>
            <p className="text-sm text-gray-600">Get more court time.</p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 sm:gap-6">
            <Link href="/privacy" className="transition hover:text-teal-700 hover:font-semibold">
              Privacy
            </Link>
            <Link href="/terms" className="transition hover:text-teal-700 hover:font-semibold">
              Terms
            </Link>
            <Link
              href="/refund-policy"
              className="transition hover:text-teal-700 hover:font-semibold"
            >
              Refund Policy
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
