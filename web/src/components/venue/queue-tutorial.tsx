'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

const STORAGE_KEY_SCHEDULE = 'rallio_qm_tour_schedule_seen'
const STORAGE_KEY_SETTINGS = 'rallio_qm_tour_settings_seen'

interface TutorialStep {
  target: string
  title: string
  description: string
  position: 'bottom' | 'top' | 'left' | 'right' | 'center'
}

const SCHEDULE_STEPS: TutorialStep[] = [
  { 
    target: 'center', 
    title: 'Queue Master Booking 👑', 
    description: "Welcome to the dedicated booking flow for public queue sessions! Let's quickly go over how to schedule a queue event.",
    position: 'center'
  },
  { 
    target: '#qm-tour-calendar', 
    title: 'Choose Date', 
    description: 'Select the starting date for your queue session.',
    position: 'right'
  },
  { 
    target: '#qm-tour-repeat', 
    title: 'Repeat Booking', 
    description: 'Choose whether this queue repeats automatically for multiple consecutive weeks.',
    position: 'right'
  },
  { 
    target: '#qm-tour-days', 
    title: 'Include Days', 
    description: 'If you want to run this queue on multiple days per week, select them here. (Optional)',
    position: 'right'
  },
  { 
    target: '#qm-tour-time', 
    title: 'Set Duration', 
    description: 'Tap on a start time, then tap on an end time to block out your queue session. Multiple hours can be booked at once.',
    position: 'left'
  },
  { 
    target: '#qm-tour-next', 
    title: 'Configure Rules', 
    description: 'When your schedule is set, click this to define whether your queue is casual or competitive, the max player count, and the cost per head.',
    position: 'top'
  }
]

const SETTINGS_STEPS: TutorialStep[] = [
  { 
    target: '#qm-tour-mode', 
    title: 'Session Mode', 
    description: 'Choose whether this queue affects player ELO rankings (Competitive) or is just for fun (Casual).',
    position: 'bottom'
  },
  { 
    target: '#qm-tour-format', 
    title: 'Game Format', 
    description: 'Select if games will be 1v1 Singles, or 2v2 Doubles/Mixed.',
    position: 'bottom'
  },
  { 
    target: '#qm-tour-players', 
    title: 'Player Capacity', 
    description: 'Set the maximum number of people who can join this queue session to avoid overcrowding.',
    position: 'bottom'
  },
  { 
    target: '#qm-tour-cost', 
    title: 'Cost Per Head', 
    description: 'Set the entry fee that players will pay to join your queue session.',
    position: 'top'
  },
  { 
    target: '#qm-tour-public', 
    title: 'Public Session', 
    description: 'Turn this on to allow anyone to discover and join your queue. If turned off, the queue will be private.',
    position: 'top'
  },
  { 
    target: '#qm-tour-book', 
    title: 'Finalize Booking', 
    description: 'Once you are happy with the settings, tap here to finalize the schedule and create your queue session!',
    position: 'top'
  }
]

interface QueueTutorialProps {
  isOpen: boolean
  view: 'schedule' | 'settings'
}

export function QueueTutorial({ isOpen, view }: QueueTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [showTutorial, setShowTutorial] = useState(false)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  const STPES = view === 'schedule' ? SCHEDULE_STEPS : SETTINGS_STEPS
  const STORAGE_KEY = view === 'schedule' ? STORAGE_KEY_SCHEDULE : STORAGE_KEY_SETTINGS

  // Check localStorage whenever view or isOpen changes
  useEffect(() => {
    if (isOpen) {
      const done = localStorage.getItem(STORAGE_KEY)
      if (!done) {
        // Reset step if view changed
        setCurrentStep(0)
        // Delay to allow DOM layout to settle, especially on the settings view toggle
        const timer = setTimeout(() => setShowTutorial(true), 600)
        return () => clearTimeout(timer)
      } else {
        setShowTutorial(false)
      }
    } else {
      setShowTutorial(false)
      setCurrentStep(0)
    }
  }, [isOpen, view, STORAGE_KEY])

  // Automatically scroll to the target only when the step changes
  useEffect(() => {
    if (!showTutorial) return
    const step = STPES[currentStep]
    if (!step) return
    
    if (step.target === 'center') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    // Small delay to allow react to mount new items, particularly on transition
    const timer = setTimeout(() => {
      const el = document.querySelector(step.target)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 100)

    return () => clearTimeout(timer)
  }, [currentStep, showTutorial, STPES])

  // Measure target element position
  const measureTarget = useCallback(() => {
    if (!showTutorial) return
    const step = STPES[currentStep]
    if (!step) return
    
    const activeTarget = step.target
    
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
      return
    }

    const el = document.querySelector(activeTarget)
    if (el) {
      const rect = el.getBoundingClientRect()
      setTargetRect(rect)
    }
  }, [currentStep, showTutorial, STPES])

  useEffect(() => {
    measureTarget()
    
    window.addEventListener('resize', measureTarget)
    window.addEventListener('scroll', measureTarget, true)
    
    return () => {
      window.removeEventListener('resize', measureTarget)
      window.removeEventListener('scroll', measureTarget, true)
    }
  }, [measureTarget])

  const completeTutorial = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'true')
    setShowTutorial(false)
    setCurrentStep(0)
  }, [STORAGE_KEY])

  const handleNext = () => {
    if (currentStep < STPES.length - 1) {
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

  const handleSkip = () => {
     // If they skip, aggressively mark both seen so they aren't bugged again
     localStorage.setItem(STORAGE_KEY_SCHEDULE, 'true')
     localStorage.setItem(STORAGE_KEY_SETTINGS, 'true')
     setShowTutorial(false)
     setCurrentStep(0)
  }

  if (!showTutorial || !targetRect || !STPES[currentStep]) return null

  const step = STPES[currentStep]
  const padding = 8
  
  const isMobile = window.innerWidth < 768
  const dynamicPosition = step.position === 'center' ? 'center' : (isMobile && step.position !== 'top' ? 'bottom' : step.position)

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
          top: Math.max(spotlight.y, 16),
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
          left: Math.max(16, Math.min(spotlight.x - (tooltipWidth/2) + (spotlight.width/2), window.innerWidth - tooltipWidth - 16)),
          top: spotlight.y + spotlight.height + gap,
          maxWidth: tooltipWidth,
        }
    }
  }

  return (
    <div ref={overlayRef} className="fixed inset-0 z-[110]" style={{ pointerEvents: 'auto' }}>
      {/* SVG overlay with spotlight cutout */}
      <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
        <defs>
          <mask id="qm-tutorial-mask">
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
          mask="url(#qm-tutorial-mask)"
        />
      </svg>

      {/* Spotlight border ring */}
      {step.position !== 'center' && (
        <>
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
        </>
      )}

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
          {STPES.map((_, i) => (
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
            {currentStep + 1}/{STPES.length}
          </span>
        </div>

        {/* Content */}
        <h4 className="font-bold text-gray-900 text-base mb-1.5">{step.title}</h4>
        <p className="text-sm text-gray-600 leading-relaxed">{step.description}</p>

        {/* Actions */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
          <button
            onClick={handleSkip}
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
              {currentStep === STPES.length - 1 ? 'Got it!' : 'Next'}
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
