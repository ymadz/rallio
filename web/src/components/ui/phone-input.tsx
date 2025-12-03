'use client'

import { useState, useEffect, forwardRef } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface PhoneInputProps {
  value?: string
  onChange?: (value: string) => void
  disabled?: boolean
  className?: string
  placeholder?: string
  id?: string
  name?: string
  required?: boolean
}

/**
 * PhoneInput component with +63 prefix for Philippine phone numbers
 * Formats input as: +63 9XX XXX XXXX
 * Stores value with +63 prefix
 */
export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ value = '', onChange, disabled, className, placeholder, id, name, required }, ref) => {
    // Format phone number for display: 9XX XXX XXXX
    const formatPhoneNumber = (digits: string): string => {
      if (!digits) return ''

      // Limit to 10 digits (Philippine mobile without country code)
      const limited = digits.slice(0, 10)

      // Format as: 9XX XXX XXXX
      if (limited.length <= 3) {
        return limited
      } else if (limited.length <= 6) {
        return `${limited.slice(0, 3)} ${limited.slice(3)}`
      } else {
        return `${limited.slice(0, 3)} ${limited.slice(3, 6)} ${limited.slice(6)}`
      }
    }

    // Remove +63 prefix for display
    const getDisplayValue = (val: string) => {
      if (!val) return ''
      // Remove +63 prefix if present
      let clean = val.replace(/^\+63\s?/, '')
      // Remove any non-digit characters
      clean = clean.replace(/\D/g, '')
      return formatPhoneNumber(clean)
    }

    const [displayValue, setDisplayValue] = useState(() => getDisplayValue(value))

    // Update display when value prop changes
    useEffect(() => {
      setDisplayValue(getDisplayValue(value))
    }, [value])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target.value

      // Extract only digits
      const digits = input.replace(/\D/g, '')

      // Limit to 10 digits
      const limited = digits.slice(0, 10)

      // Update display value with formatting
      const formatted = formatPhoneNumber(limited)
      setDisplayValue(formatted)

      // Call onChange with full +63 prefixed value
      if (onChange) {
        if (limited.length === 0) {
          onChange('')
        } else {
          // Always include +63 prefix when storing
          onChange(`+63${limited}`)
        }
      }
    }

    // Handle paste - extract digits only
    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault()
      const pasted = e.clipboardData.getData('text')

      // Remove +63 or 0 prefix if present, then extract digits
      let clean = pasted
        .replace(/^\+63\s?/, '')
        .replace(/^0/, '')
        .replace(/\D/g, '')

      // Limit to 10 digits
      const limited = clean.slice(0, 10)

      // Update display value
      const formatted = formatPhoneNumber(limited)
      setDisplayValue(formatted)

      // Call onChange with full value
      if (onChange && limited.length > 0) {
        onChange(`+63${limited}`)
      }
    }

    return (
      <div className={cn('relative flex items-center', className)}>
        {/* Country Code Prefix */}
        <div className="absolute left-3 flex items-center pointer-events-none">
          <span className="text-gray-500 font-medium text-sm">+63</span>
        </div>

        {/* Input */}
        <Input
          ref={ref}
          type="tel"
          id={id}
          name={name}
          value={displayValue}
          onChange={handleChange}
          onPaste={handlePaste}
          disabled={disabled}
          required={required}
          placeholder={placeholder || '9XX XXX XXXX'}
          className="pl-12"
          inputMode="numeric"
          autoComplete="tel-national"
        />
      </div>
    )
  }
)

PhoneInput.displayName = 'PhoneInput'

/**
 * Utility function to format stored phone number for display
 * Input: +639123456789
 * Output: +63 912 345 6789
 */
export function formatPhoneForDisplay(phone: string | null | undefined): string {
  if (!phone) return ''

  // Remove +63 prefix
  let digits = phone.replace(/^\+63/, '').replace(/\D/g, '')

  if (digits.length === 0) return phone

  // Format as +63 9XX XXX XXXX
  if (digits.length <= 3) {
    return `+63 ${digits}`
  } else if (digits.length <= 6) {
    return `+63 ${digits.slice(0, 3)} ${digits.slice(3)}`
  } else {
    return `+63 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`
  }
}

/**
 * Validate Philippine mobile number
 * Valid: 9XX XXX XXXX (10 digits starting with 9)
 */
export function validatePhilippinePhone(phone: string | null | undefined): boolean {
  if (!phone) return false

  // Extract digits, removing +63 prefix
  const digits = phone.replace(/^\+63/, '').replace(/\D/g, '')

  // Must be 10 digits starting with 9
  return digits.length === 10 && digits.startsWith('9')
}
