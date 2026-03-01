'use client'

interface DiscountIndicatorProps {
    discounts: {
        rules: any[]
        holidays: any[]
    }
}

export function DiscountIndicator({ discounts }: DiscountIndicatorProps) {
    const hasDiscounts = discounts.rules.length > 0 || discounts.holidays.length > 0

    if (!hasDiscounts) return null

    return (
        <div className="flex flex-wrap gap-2 mt-3">
            {discounts.rules.map((rule) => (
                <div key={rule.id} className="inline-flex items-start gap-2 bg-primary/5 border border-primary/15 rounded-lg px-3.5 py-2">
                    <svg className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    <div>
                        <div className="flex items-center gap-1">
                            <span className="text-sm font-bold text-primary">
                                {rule.discount_unit === 'percent'
                                    ? `${rule.discount_value}% OFF`
                                    : `₱${rule.discount_value} OFF`}
                            </span>
                            <span className="text-sm text-gray-600">— {rule.name}</span>
                        </div>
                        {rule.description && (
                            <p className="text-xs text-gray-400 mt-0.5">{rule.description}</p>
                        )}
                    </div>
                </div>
            ))}

            {discounts.holidays.map((holiday) => {
                const isDiscount = holiday.price_multiplier < 1
                return (
                    <div key={holiday.id} className={`inline-flex items-start gap-2 rounded-lg px-3.5 py-2 ${
                        isDiscount
                            ? 'bg-green-50 border border-green-100'
                            : 'bg-orange-50 border border-orange-100'
                    }`}>
                        <svg className={`w-4 h-4 flex-shrink-0 mt-0.5 ${isDiscount ? 'text-green-600' : 'text-orange-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className={`text-sm font-bold ${isDiscount ? 'text-green-700' : 'text-orange-700'}`}>
                            {isDiscount
                                ? `${Math.round((1 - holiday.price_multiplier) * 100)}% OFF`
                                : `+${Math.round((holiday.price_multiplier - 1) * 100)}%`}
                        </span>
                        <span className="text-sm text-gray-600">— {holiday.name}</span>
                    </div>
                )
            })}
        </div>
    )
}
