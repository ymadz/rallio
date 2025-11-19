'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type SetupStep = 'welcome' | 'intro' | 'details' | 'player-info' | 'play-styles' | 'skill-intro' | 'skill-level'

interface ProfileData {
  firstName: string
  middleInitial: string
  lastName: string
  email: string
  phone: string
  avatarUrl: string
  avatarFile: File | null
  birthDate: string
  gender: string
  skillLevel: number
  playStyles: string[]
  bio: string
}

const PLAY_STYLES = [
  'Singles',
  'Doubles',
  'Attacking / Speed',
  'Defensive',
  'All-Round',
  'Deceptive',
  'Control',
  'Net-Play Specialist',
]

const SKILL_LEVELS = [
  { value: 1, label: 'Beginner', description: 'Just starting out' },
  { value: 4, label: 'Intermediate', description: 'Comfortable with basics' },
  { value: 7, label: 'Advanced', description: 'Strong competitive player' },
  { value: 10, label: 'Elite', description: 'Tournament level' },
]

export default function SetupProfilePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Check if coming from reminder card
  const fromReminder = searchParams.get('from') === 'reminder'

  const [step, setStep] = useState<SetupStep>(fromReminder ? 'details' : 'welcome')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(true)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)

  const [profileData, setProfileData] = useState<ProfileData>({
    firstName: '',
    middleInitial: '',
    lastName: '',
    email: '',
    phone: '',
    avatarUrl: '',
    avatarFile: null,
    birthDate: '',
    gender: '',
    skillLevel: 5,
    playStyles: [],
    bio: '',
  })

  useEffect(() => {
    const fetchUserData = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        setProfileData(prev => ({
          ...prev,
          firstName: user.user_metadata?.first_name || user.user_metadata?.full_name?.split(' ')[0] || '',
          middleInitial: user.user_metadata?.middle_initial || '',
          lastName: user.user_metadata?.last_name || user.user_metadata?.full_name?.split(' ').slice(1).join(' ') || '',
          email: user.email || '',
          phone: user.user_metadata?.phone_number || '',
        }))
      }
      setIsFetching(false)
    }

    fetchUserData()
  }, [])

  const updateProfile = (field: keyof ProfileData, value: string | number | string[] | File | null) => {
    setProfileData(prev => ({ ...prev, [field]: value }))
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file')
        return
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('Image must be less than 5MB')
        return
      }

      updateProfile('avatarFile', file)

      // Create preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const togglePlayStyle = (style: string) => {
    setProfileData(prev => ({
      ...prev,
      playStyles: prev.playStyles.includes(style)
        ? prev.playStyles.filter(s => s !== style)
        : [...prev.playStyles, style],
    }))
  }

  const handleSkillLevelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value

    // Allow empty input for editing
    if (value === '') {
      updateProfile('skillLevel', 0)
      return
    }

    const numValue = parseInt(value, 10)

    // Only update if it's a valid number between 1-10
    if (!isNaN(numValue)) {
      if (numValue >= 1 && numValue <= 10) {
        updateProfile('skillLevel', numValue)
      } else if (numValue > 10) {
        updateProfile('skillLevel', 10)
      } else if (numValue < 1 && numValue > 0) {
        updateProfile('skillLevel', 1)
      }
    }
  }

  const handleComplete = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setError('Not authenticated')
        return
      }

      let avatarUrl = profileData.avatarUrl

      // Upload avatar if a new file was selected
      if (profileData.avatarFile) {
        const fileExt = profileData.avatarFile.name.split('.').pop()
        const fileName = `${user.id}-${Date.now()}.${fileExt}`
        const filePath = `avatars/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, profileData.avatarFile)

        if (uploadError) {
          console.error('Avatar upload error:', uploadError)
          // Continue without avatar if upload fails
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath)
          avatarUrl = publicUrl
        }
      }

      // Update profile
      const { error: userError } = await supabase
        .from('profiles')
        .update({
          display_name: `${formData.firstName} ${formData.lastName}`,
          first_name: formData.firstName,
          last_name: formData.lastName,
          avatar_url: avatarUrl,
          profile_completed: true,
        })
        .eq('id', user?.id)

      if (userError) throw userError

      // Update player profile
      const { error: playerError } = await supabase
        .from('players')
        .update({
          birth_date: profileData.birthDate || null,
          gender: profileData.gender || null,
          skill_level: profileData.skillLevel || 5,
          play_style: profileData.playStyles.join(','),
          bio: profileData.bio || null,
        })
        .eq('user_id', user.id)

      if (playerError) throw playerError

      router.push('/home')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSkip = () => {
    router.push('/home')
  }

  if (isFetching) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  // Step indicator - removed skill-intro and preferences
  const steps = ['details', 'player-info', 'play-styles', 'skill-level']
  const currentStepIndex = steps.indexOf(step)

  // Welcome step - only shown after signup, not from reminder
  if (step === 'welcome') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="max-w-lg w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          {/* Logo */}
          <img
            src="/logo.svg"
            alt="Rallio"
            className="mx-auto w-20 h-20 mb-6"
          />

          <h1 className="text-3xl font-bold text-gray-900 mb-2">You're all set!</h1>
          <p className="text-gray-500 mb-8">
            Welcome to Rallio — Set up your profile to start!
          </p>

          <button
            onClick={() => setStep('intro')}
            className="w-full bg-primary text-white py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            Continue
          </button>

          <button
            onClick={handleSkip}
            className="mt-4 text-gray-500 text-sm hover:text-gray-700"
          >
            Skip for now
          </button>
        </div>
      </div>
    )
  }

  // Intro step
  if (step === 'intro') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="max-w-4xl w-full bg-white rounded-2xl shadow-lg overflow-hidden flex flex-col md:flex-row">
          {/* Image side */}
          <div className="md:w-1/2 h-64 md:h-auto bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            <div className="text-center p-8">
              <svg className="w-24 h-24 mx-auto text-primary mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <div className="w-16 h-16 mx-auto bg-primary/20 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Content side */}
          <div className="md:w-1/2 p-8 flex flex-col justify-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Set up your Profile in just a few minutes
            </h1>
            <p className="text-gray-500 mb-8">
              Tell us about your game so we can match you with the right courts and players.
            </p>

            <button
              onClick={() => setStep('details')}
              className="w-full bg-primary text-white py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Details step
  if (step === 'details') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="max-w-lg w-full bg-white rounded-2xl shadow-lg p-8">
          {/* Progress */}
          <div className="flex gap-1 mb-6">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`flex-1 h-1 rounded ${i <= currentStepIndex ? 'bg-primary' : 'bg-gray-200'}`}
              />
            ))}
          </div>

          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Add Your Details</h1>
          </div>

          {/* Avatar with upload */}
          <div className="flex flex-col items-center gap-3 mb-6">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center text-2xl font-semibold text-gray-400 overflow-hidden">
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar preview" className="w-full h-full object-cover" />
              ) : (
                profileData.firstName?.charAt(0) || '?'
              )}
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleAvatarChange}
              accept="image/*"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary/90"
            >
              Change Picture
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Fields */}
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
              <input
                value={profileData.firstName}
                onChange={(e) => updateProfile('firstName', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Middle Initial</label>
              <input
                value={profileData.middleInitial}
                onChange={(e) => updateProfile('middleInitial', e.target.value)}
                maxLength={1}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
              <input
                value={profileData.lastName}
                onChange={(e) => updateProfile('lastName', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <input
                value={profileData.email}
                disabled
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              <input
                value={profileData.phone}
                onChange={(e) => updateProfile('phone', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>

          <button
            onClick={() => setStep('player-info')}
            className="w-full bg-primary text-white py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            Next
          </button>
        </div>
      </div>
    )
  }

  // Player info step
  if (step === 'player-info') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="max-w-lg w-full bg-white rounded-2xl shadow-lg p-8">
          {/* Progress */}
          <div className="flex gap-1 mb-6">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`flex-1 h-1 rounded ${i <= currentStepIndex ? 'bg-primary' : 'bg-gray-200'}`}
              />
            ))}
          </div>

          <button
            onClick={() => setStep('details')}
            className="flex items-center gap-2 text-gray-600 mb-4 hover:text-gray-900"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>

          <h1 className="text-2xl font-bold text-gray-900 mb-6">Add Your Details</h1>

          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Birth Date</label>
              <input
                type="date"
                value={profileData.birthDate}
                onChange={(e) => updateProfile('birthDate', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
              <select
                value={profileData.gender}
                onChange={(e) => updateProfile('gender', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="">Select Gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Skill Level (1-10)</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={profileData.skillLevel === 0 ? '' : profileData.skillLevel}
                onChange={handleSkillLevelChange}
                onBlur={() => {
                  // Set to minimum value if empty on blur
                  if (profileData.skillLevel === 0) {
                    updateProfile('skillLevel', 1)
                  }
                }}
                placeholder="Enter 1-10"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
              <p className="text-xs text-gray-500 mt-1">1 = Beginner, 10 = Elite</p>
            </div>
          </div>

          <button
            onClick={() => setStep('play-styles')}
            className="w-full bg-primary text-white py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            Select Preferred Play Style
          </button>
        </div>
      </div>
    )
  }

  // Play styles step
  if (step === 'play-styles') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="max-w-lg w-full bg-white rounded-2xl shadow-lg p-8">
          {/* Progress */}
          <div className="flex gap-1 mb-6">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`flex-1 h-1 rounded ${i <= currentStepIndex ? 'bg-primary' : 'bg-gray-200'}`}
              />
            ))}
          </div>

          <button
            onClick={() => setStep('player-info')}
            className="flex items-center gap-2 text-gray-600 mb-4 hover:text-gray-900"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">Select Your Play Styles</h1>
          <p className="text-gray-500 text-sm mb-6">
            Select one or more styles that describe how you play.
          </p>

          <div className="space-y-3 mb-6">
            {PLAY_STYLES.map((style) => (
              <button
                key={style}
                onClick={() => togglePlayStyle(style)}
                className={`w-full p-4 rounded-lg border text-left flex items-center justify-between transition-colors ${
                  profileData.playStyles.includes(style)
                    ? 'border-primary bg-primary/5'
                    : 'border-gray-200 hover:border-primary/50'
                }`}
              >
                <span className="text-gray-900">{style}</span>
                {profileData.playStyles.includes(style) && (
                  <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>

          <button
            onClick={() => setStep('skill-level')}
            className="w-full bg-primary text-white py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            Continue
          </button>
        </div>
      </div>
    )
  }

  // Skill level step (final step)
  if (step === 'skill-level') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="max-w-lg w-full bg-white rounded-2xl shadow-lg p-8">
          {/* Progress */}
          <div className="flex gap-1 mb-6">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`flex-1 h-1 rounded ${i <= currentStepIndex ? 'bg-primary' : 'bg-gray-200'}`}
              />
            ))}
          </div>

          <button
            onClick={() => setStep('play-styles')}
            className="flex items-center gap-2 text-gray-600 mb-4 hover:text-gray-900"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Confirm Your Skill Level
          </h1>
          <p className="text-gray-500 text-sm mb-6">
            Select a skill tier to help us find the right opponents and courts for you.
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="space-y-3 mb-6">
            {SKILL_LEVELS.map((level) => (
              <button
                key={level.value}
                onClick={() => updateProfile('skillLevel', level.value)}
                className={`w-full p-4 rounded-lg border text-left transition-colors ${
                  profileData.skillLevel === level.value
                    ? 'border-primary bg-primary text-white'
                    : 'border-gray-200 hover:border-primary/50'
                }`}
              >
                <div className="font-medium">{level.label}</div>
                <div className={`text-sm ${profileData.skillLevel === level.value ? 'text-white/80' : 'text-gray-500'}`}>
                  {level.description}
                </div>
              </button>
            ))}
          </div>

          <button
            onClick={handleComplete}
            disabled={isLoading}
            className="w-full bg-primary text-white py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Saving...' : 'Complete Setup'}
          </button>
        </div>
      </div>
    )
  }

  return null
}
