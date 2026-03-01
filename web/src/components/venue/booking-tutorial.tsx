'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

const STORAGE_KEY = 'rallio_booking_tutorial_done'

interface TutorialStep {
  target: string
  title: string
  description: string
  position: 'bottom' | 'top' | 'left' | 'right'
}

const STEPS: TutorialStep[] = [
  {
    target: '[data-tutorial-step="1"]',
    title: 'Choose a Date',
    description: 'Pick the day you want to play. Past dates are disabled. Today is selected by default.',
    position: 'right',
  },
  {
    target: '[data-tutorial-step="2"]',
    title: 'Select Time Range',
    description: 'Tap a start time, then tap an end time to select your playing hours. Reserved slots are greyed out.',
    position: 'left',
  },
  {
    target: '[data-tutorial-step="3"]',
    title: 'Repeat Booking (Optional)',
    description: 'Want to play weekly? Set how many weeks to repeat your booking.',
    position: 'right',
  },
  {
    target: '[data-tutorial-step="4"]',
    title: 'Include Days (Optional)',
    description: 'Select additional days of the week to book at the same time slot.',
    position: 'right',
  },
  {
    target: '[data-tutorial-step="5"]',
    title: 'Confirm & Book',
    description: 'Review your selection, price, and tap Book to proceed to checkout.',
    position: 'top',
  },
]

interface BookingTutorialProps {
  isOpen: boolean
}

export function BookingTutorial({ isOpen }: BookingTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [showTutorial, setShowTutorial] = useState(false)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  // Check localStorage on mount
  useEffect(() => {
    if (isOpen) {
      const done = localStorage.getItem(STORAGE_KEY)
      if (!done) {
        // Small delay to let the modal render and layout settle
        const timer = setTimeout(() => setShowTutorial(true), 600)
        return () => clearTimeout(timer)
      }
    } else {
      setShowTutorial(false)
      setCurrentStep(0)
    }
  }, [isOpen])

  // Measure target element position
  const measureTarget = useCallback(() => {
    if (!showTutorial) return
    const step = STEPS[currentStep]
    const el = document.querySelector(step.target)
    if (el) {
      const rect = el.getBoundingClientRect()
      setTargetRect(rect)

      // Scroll the element into view within the modal
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [currentStep, showTutorial])

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

    switch (step.position) {
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
          left: Math.max(spotlight.x, 16),
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
          <mask id="tutorial-mask">
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
          mask="url(#tutorial-mask)"
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
