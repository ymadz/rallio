'use client'

import { useState } from 'react'

interface DiscountIndicatorProps {
    discounts: {
        rules: any[]
        holidays: any[]
    }
}

export function DiscountIndicator({ discounts }: DiscountIndicatorProps) {
    const [isOpen, setIsOpen] = useState(false)

    const hasDiscounts = discounts.rules.length > 0 || discounts.holidays.length > 0

    if (!hasDiscounts) return null

    return (
        <>
            <div className="flex items-center gap-2">
                <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    PROMO AVAILABLE
                </span>
                <button
                    onClick={() => setIsOpen(true)}
                    className="w-5 h-5 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 flex items-center justify-center transition-colors"
                    title="View discount details"
                >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </button>
            </div>

            {isOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="font-semibold text-gray-900">Available Discounts</h3>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1 hover:bg-gray-100 rounded-lg text-gray-500"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="p-4 space-y-4">
                            {/* Active Rules */}
                            {discounts.rules.map((rule) => (
                                <div key={rule.id} className="bg-green-50 border border-green-100 rounded-lg p-3">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-green-700 font-bold">
                                            {rule.discount_unit === 'percent'
                                                ? `${rule.discount_value}% OFF`
                                                : `₱${rule.discount_value} OFF`}
                                        </span>
                                        <span className="text-xs bg-white border border-green-200 text-green-700 px-1.5 py-0.5 rounded capitalize">
                                            {rule.discount_type.replace('_', ' ')}
                                        </span>
                                    </div>
                                    <h4 className="font-medium text-gray-900 text-sm">{rule.name}</h4>
                                    {rule.description && (
                                        <p className="text-xs text-gray-600 mt-0.5">{rule.description}</p>
                                    )}
                                    {/* Conditions */}
                                    <div className="mt-2 text-xs text-gray-500 space-y-0.5">
                                        {rule.min_weeks && <p>• Min. {rule.min_weeks} weeks booking</p>}
                                        {rule.advance_days && <p>• Book {rule.advance_days} days in advance</p>}
                                    </div>
                                </div>
                            ))}

                            {/* Holiday Pricing */}
                            {discounts.holidays.map((holiday) => (
                                <div key={holiday.id} className={`border rounded-lg p-3 ${holiday.price_multiplier < 1
                                    ? 'bg-green-50 border-green-100'
                                    : 'bg-orange-50 border-orange-100'
                                    }`}>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`font-bold ${holiday.price_multiplier < 1 ? 'text-green-700' : 'text-orange-700'
                                            }`}>
                                            {holiday.price_multiplier < 1
                                                ? `${Math.round((1 - holiday.price_multiplier) * 100)}% OFF`
                                                : `${Math.round((holiday.price_multiplier - 1) * 100)}% Extra`}
                                        </span>
                                        <span className={`text-xs bg-white border px-1.5 py-0.5 rounded capitalize ${holiday.price_multiplier < 1
                                            ? 'border-green-200 text-green-700'
                                            : 'border-orange-200 text-orange-700'
                                            }`}>
                                            {holiday.price_multiplier < 1 ? 'Seasonal Offer' : 'Holiday Rate'}
                                        </span>
                                    </div>
                                    <h4 className="font-medium text-gray-900 text-sm">{holiday.name}</h4>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Valid: {new Date(holiday.start_date).toLocaleDateString()} - {new Date(holiday.end_date).toLocaleDateString()}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
