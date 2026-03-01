'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

const STORAGE_KEY = 'rallio_home_tour_seen'

interface TutorialStep {
  target: string
  title: string
  description: string
  position: 'bottom' | 'top' | 'left' | 'right' | 'center'
}

const STEPS: TutorialStep[] = [
  { 
    target: 'center', // Special keyword for unanchored step
    title: 'Hello! Welcome to Rallio 🏸', 
    description: "Let us take you on a quick tour to show you how to find courts, jump into queues, and manage your games.",
    position: 'center'
  },
  { 
    target: '#tour-nav-home', 
    title: 'Home Dashboard', 
    description: 'This is your central hub for active bookings, suggested courts, and nearby venues.',
    position: 'right'
  },
  { 
    target: '#tour-nav-find-court', 
    title: 'Find Courts', 
    description: 'Browse and discover all available badminton courts in your area with real-time availability.',
    position: 'right'
  },
  { 
    target: '#tour-nav-queue', 
    title: 'Join a Queue', 
    description: 'Jump into an active queue session at your favorite venue to play open play games.',
    position: 'right'
  },
  { 
    target: '#tour-nav-bookings', 
    title: 'Your Bookings', 
    description: 'Manage your upcoming and past court reservations right here.',
    position: 'right'
  },
  { 
    target: '#tour-nav-matches', 
    title: 'Matches', 
    description: 'Find teammates and opponents to organize games, and view your past match history.',
    position: 'right'
  },
  { 
    target: '#tour-nav-profile', 
    title: 'Your Profile', 
    description: 'Update your skill level and personal details to find better matchups.',
    position: 'right'
  }
]

export function HomeTutorial() {
  const [currentStep, setCurrentStep] = useState(0)
  const [showTutorial, setShowTutorial] = useState(false)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  // Determine actual target dynamically for desktop vs mobile
  const getActualTarget = (stepTarget: string) => {
    if (stepTarget === 'center') return 'center'
    const isMobile = window.innerWidth < 768
    if (isMobile && stepTarget.startsWith('#tour-nav-')) {
      return `#mobile-${stepTarget.replace('#', '')}`
    }
    return stepTarget
  }

  // Check localStorage on mount
  useEffect(() => {
    const done = localStorage.getItem(STORAGE_KEY)
    if (!done) {
      // Delay slightly so layout can settle (especially sidebar sizing)
      const timer = setTimeout(() => setShowTutorial(true), 800)
      return () => clearTimeout(timer)
    }
  }, [])

  // Measure target element position
  const measureTarget = useCallback(() => {
    if (!showTutorial) return
    const step = STEPS[currentStep]
    const activeTarget = getActualTarget(step.target)
    
    if (activeTarget === 'center') {
      // Center of screen
      setTargetRect({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
        width: 0,
        height: 0,
        top: window.innerHeight / 2,
        right: window.innerWidth / 2,
        bottom: window.innerHeight / 2,
        left: window.innerWidth / 2,
        toJSON: () => {}
      })
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    const el = document.querySelector(activeTarget)
    if (el) {
      const rect = el.getBoundingClientRect()
      setTargetRect(rect)
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [currentStep, showTutorial])

  useEffect(() => {
    measureTarget()
    
    // In case dom size shifts
    window.addEventListener('resize', measureTarget)
    window.addEventListener('scroll', measureTarget, true)
    
    // Safety check - if on mobile, and the user flips orient, recalibrate
    return () => {
      window.removeEventListener('resize', measureTarget)
      window.removeEventListener('scroll', measureTarget, true)
    }
  }, [measureTarget])

  const completeTutorial = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'true')
    setShowTutorial(false)
    setCurrentStep(0)
  }, [])

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1)
    } else {
      completeTutorial()
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1)
    }
  }

  if (!showTutorial || !targetRect) return null

  const step = STEPS[currentStep]
  const padding = 8
  
  // We want the position logic to adapt smoothly when targeting bottom mobile tabs
  const isMobile = window.innerWidth < 768
  const dynamicPosition = step.position === 'center' ? 'center' : (isMobile ? 'top' : step.position)

  // Spotlight cutout dimensions
  const spotlight = {
    x: targetRect.x - padding,
    y: targetRect.y - padding,
    width: targetRect.width + padding * 2,
    height: targetRect.height + padding * 2,
    rx: 12,
  }

  // Tooltip position calculation
  const getTooltipStyle = (): React.CSSProperties => {
    const tooltipWidth = 320
    const gap = 16

    switch (dynamicPosition) {
      case 'center':
        return {
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          maxWidth: tooltipWidth,
        }
      case 'right':
        return {
          left: Math.min(spotlight.x + spotlight.width + gap, window.innerWidth - tooltipWidth - 16),
          top: spotlight.y,
          maxWidth: tooltipWidth,
        }
      case 'left':
        return {
          left: Math.max(spotlight.x - tooltipWidth - gap, 16),
          top: spotlight.y,
          maxWidth: tooltipWidth,
        }
      case 'top':
        return {
          left: Math.max(16, Math.min(spotlight.x - (tooltipWidth/2) + (spotlight.width/2), window.innerWidth - tooltipWidth - 16)),
          top: Math.max(spotlight.y - gap - 180, 16),
          maxWidth: tooltipWidth,
        }
      case 'bottom':
      default:
        return {
          left: Math.max(spotlight.x, 16),
          top: spotlight.y + spotlight.height + gap,
          maxWidth: tooltipWidth,
        }
    }
  }

  return (
    <div ref={overlayRef} className="fixed inset-0 z-[100]" style={{ pointerEvents: 'auto' }}>
      {/* SVG overlay with spotlight cutout */}
      <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
        <defs>
          <mask id="home-tutorial-mask">
            <rect width="100%" height="100%" fill="white" />
            <rect
              x={spotlight.x}
              y={spotlight.y}
              width={spotlight.width}
              height={spotlight.height}
              rx={spotlight.rx}
              fill="black"
            />
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.6)"
          mask="url(#home-tutorial-mask)"
        />
      </svg>

      {/* Spotlight border ring */}
      <div
        className="absolute border-2 border-white/80 rounded-xl pointer-events-none transition-all duration-500 ease-out"
        style={{
          left: spotlight.x,
          top: spotlight.y,
          width: spotlight.width,
          height: spotlight.height,
          boxShadow: '0 0 0 4px rgba(255,255,255,0.2), 0 0 20px rgba(255,255,255,0.1)',
        }}
      />

      {/* Pulsing ring animation */}
      <div
        className="absolute rounded-xl pointer-events-none animate-ping"
        style={{
          left: spotlight.x - 2,
          top: spotlight.y - 2,
          width: spotlight.width + 4,
          height: spotlight.height + 4,
          border: '2px solid rgba(255,255,255,0.3)',
          animationDuration: '2s',
        }}
      />

      {/* Tooltip card */}
      <div
        className="absolute bg-white rounded-xl shadow-2xl p-5 transition-all duration-500 ease-out"
        style={{
          ...getTooltipStyle(),
          pointerEvents: 'auto',
        }}
      >
        {/* Step indicator */}
        <div className="flex items-center gap-1.5 mb-3">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === currentStep
                  ? 'w-6 bg-primary'
                  : i < currentStep
                  ? 'w-3 bg-primary/40'
                  : 'w-3 bg-gray-200'
              }`}
            />
          ))}
          <span className="text-[10px] text-gray-400 ml-auto font-medium">
            {currentStep + 1}/{STEPS.length}
          </span>
        </div>

        {/* Content */}
        <h4 className="font-bold text-gray-900 text-base mb-1.5">{step.title}</h4>
        <p className="text-sm text-gray-600 leading-relaxed">{step.description}</p>

        {/* Actions */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
          <button
            onClick={completeTutorial}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors font-medium"
          >
            Skip tour
          </button>
          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <button
                onClick={handleBack}
                className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors rounded-lg hover:bg-gray-50"
              >
                Back
              </button>
            )}
            <button
              onClick={handleNext}
              className="px-4 py-1.5 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
            >
              {currentStep === STEPS.length - 1 ? 'Got it!' : 'Next'}
            </button>
          </div>
        </div>
      </div>

      {/* Click blocker for everything except tooltip */}
      <div
        className="absolute inset-0"
        style={{ pointerEvents: 'auto', zIndex: -1 }}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  )
}
