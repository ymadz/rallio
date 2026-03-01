'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'

interface UserNavProps {
    user: {
        id: string
        email: string
        avatarUrl?: string
        displayName?: string
        firstName?: string
        lastName?: string
        phone?: string
        bio?: string
        birthDate?: string
        gender?: string
    }
}

export function UserNav({ user }: UserNavProps) {
    const router = useRouter()
    const [isOpen, setIsOpen] = useState(false) // Dropdown state (simulated)
    const dropdownRef = useRef<HTMLDivElement>(null)

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [])

    const toggleDropdown = () => setIsOpen(!isOpen)

    // Let's refine the component code.
    return (
        <div className="relative" ref={dropdownRef}>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full" onClick={toggleDropdown}>
                <Avatar className="h-8 w-8">
                    <AvatarImage src={user.avatarUrl} alt={user.displayName || user.email} />
                    <AvatarFallback>{(user.displayName?.slice(0, 2) || user.email.slice(0, 2)).toUpperCase()}</AvatarFallback>
                </Avatar>
            </Button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50">
                    <div className="px-4 py-2 border-b border-gray-100">
                        <p className="text-sm font-medium text-gray-900 truncate">{user.displayName || 'User'}</p>
                        <p className="text-xs text-gray-500 truncate">{user.email}</p>
                    </div>
                    <button
                        onClick={() => {
                            setIsOpen(false)
                            router.push('/profile')
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                        View Profile
                    </button>
                    {/* Logout is handled in sidebar commonly, but if needed here: */}
                    {/* <button className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 transition-colors">Logout</button> */}
                </div>
            )}
        </div>
    )
}


