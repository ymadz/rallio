'use client'

import { CheckoutStep } from '@/stores/checkout-store'

interface Step {
  id: CheckoutStep
  label: string
  order: number
}

const steps: Step[] = [
  { id: 'details', label: 'Details', order: 1 },
  { id: 'payment', label: 'Payment', order: 2 },
  { id: 'policy', label: 'Policy', order: 3 },
  { id: 'processing', label: 'Confirm', order: 4 },
]

interface CheckoutStepperProps {
  currentStep: CheckoutStep
}

export function CheckoutStepper({ currentStep }: CheckoutStepperProps) {
  const currentOrder = steps.find((s) => s.id === currentStep)?.order || 1

  return (
    <div className="w-full py-6">
      <div className="max-w-3xl mx-auto">
        <div className="relative">
          {/* Progress bar background */}
          <div className="absolute left-0 top-5 h-1 w-full bg-gray-200 rounded-full" />

          {/* Progress bar fill */}
          <div
            className="absolute left-0 top-5 h-1 bg-primary rounded-full transition-all duration-500"
            style={{
              width: `${((currentOrder - 1) / (steps.length - 1)) * 100}%`,
            }}
          />

          {/* Steps */}
          <div className="relative flex justify-between">
            {steps.map((step, index) => {
              const isCompleted = step.order < currentOrder
              const isCurrent = step.order === currentOrder
              const isPending = step.order > currentOrder

              return (
                <div key={step.id} className="flex flex-col items-center">
                  {/* Step circle */}
                  <div
                    className={`
                      relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2
                      transition-all duration-300
                      ${
                        isCompleted
                          ? 'border-primary bg-primary'
                          : isCurrent
                          ? 'border-primary bg-white'
                          : 'border-gray-300 bg-white'
                      }
                    `}
                  >
                    {isCompleted ? (
                      <svg
                        className="h-5 w-5 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2.5}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    ) : (
                      <span
                        className={`text-sm font-semibold ${
                          isCurrent ? 'text-primary' : 'text-gray-400'
                        }`}
                      >
                        {step.order}
                      </span>
                    )}
                  </div>

                  {/* Step label */}
                  <span
                    className={`
                      mt-2 text-xs font-medium
                      ${isCurrent ? 'text-primary' : isCompleted ? 'text-gray-700' : 'text-gray-400'}
                    `}
                  >
                    {step.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
