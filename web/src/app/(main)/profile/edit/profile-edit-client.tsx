'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { updateProfileAction, updatePlayerProfileAction } from '@/app/actions/settings-actions'
import { AvatarUpload } from '@/components/profile/avatar-upload'

interface ProfileEditClientProps {
  profile: any
  player: any
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

const SKILL_LEVELS_DISPLAY = {
  1: { label: 'Beginner', description: 'ELO 1200 - 1499' },
  4: { label: 'Intermediate', description: 'ELO 1500 - 1799' },
  7: { label: 'Advanced', description: 'ELO 1800 - 2099' },
  10: { label: 'Expert', description: 'ELO 2100+' },
}

export function ProfileEditClient({ profile, player }: ProfileEditClientProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile?.avatar_url || null)

  // Form state
  const [formData, setFormData] = useState({
    displayName: profile?.display_name || '',
    firstName: profile?.first_name || '',
    middleInitial: profile?.middle_initial || '',
    lastName: profile?.last_name || '',
    phone: profile?.phone || '',
    bio: player?.bio || '',
    birthDate: player?.birth_date || '',
    gender: player?.gender || '',
    skillLevel: player?.skill_level || 5,
    playStyles: player?.play_style?.split(',').map((s: string) => s.trim()).filter(Boolean) || [],
    avatarFile: null as File | null,
  })

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handlePlayStyleToggle = (style: string) => {
    setFormData(prev => ({
      ...prev,
      playStyles: prev.playStyles.includes(style)
        ? prev.playStyles.filter((s: string) => s !== style)
        : [...prev.playStyles, style]
    }))
  }

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setFormData(prev => ({ ...prev, avatarFile: file }))
      const reader = new FileReader()
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setMessage(null)

    try {
      let avatarUrl = profile?.avatar_url

      // Upload avatar if changed
      if (formData.avatarFile) {
        const supabase = createClient()
        const fileExt = formData.avatarFile.name.split('.').pop()
        const fileName = `${profile.id}-${Date.now()}.${fileExt}`
        const filePath = `avatars/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, formData.avatarFile, { upsert: true })

        if (uploadError) {
          throw new Error('Failed to upload avatar')
        }

        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath)

        avatarUrl = publicUrl
      }

      // Update profile
      const profileResult = await updateProfileAction({
        displayName: formData.displayName,
        firstName: formData.firstName,
        middleInitial: formData.middleInitial,
        lastName: formData.lastName,
        phone: formData.phone,
        avatarUrl,
      })

      if (!profileResult.success) {
        throw new Error(profileResult.error || 'Failed to update profile')
      }

      // Update player profile
      const playerResult = await updatePlayerProfileAction({
        bio: formData.bio,
        birthDate: formData.birthDate ? new Date(formData.birthDate) : undefined,
        gender: formData.gender || undefined,
        skillLevel: formData.skillLevel,
        playStyle: formData.playStyles.join(', '),
      })

      if (!playerResult.success) {
        throw new Error(playerResult.error || 'Failed to update player profile')
      }

      setMessage({ type: 'success', text: 'Profile updated successfully!' })
      setTimeout(() => {
        router.push('/profile')
        router.refresh()
      }, 1500)
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to update profile' })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3">
            <Link href="/profile" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Edit Profile</h1>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto p-6">
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
          {message && (
            <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
              }`}>
              {message.text}
            </div>
          )}

          {/* Avatar */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Profile Picture</label>
            <AvatarUpload
              userId={profile.id}
              currentAvatarUrl={profile?.avatar_url}
              size="lg"
              onUploadComplete={(url) => {
                setAvatarPreview(url || null)
              }}
            />
          </div>

          <hr />

          {/* Personal Information */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
                <input
                  type="text"
                  value={formData.displayName}
                  onChange={(e) => handleInputChange('displayName', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">M.I.</label>
                  <input
                    type="text"
                    maxLength={5}
                    value={formData.middleInitial}
                    onChange={(e) => handleInputChange('middleInitial', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange('lastName', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  placeholder="+63 XXX XXX XXXX"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
            </div>
          </div>

          <hr />

          {/* Player Information */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Player Information</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
                <textarea
                  value={formData.bio}
                  onChange={(e) => handleInputChange('bio', e.target.value)}
                  rows={4}
                  placeholder="Tell others about your badminton journey..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Birth Date</label>
                  <input
                    type="date"
                    value={formData.birthDate}
                    onChange={(e) => handleInputChange('birthDate', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => handleInputChange('gender', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="">Select Gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Skill Level (Read-Only)
                  </label>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-semibold text-gray-900">
                          {SKILL_LEVELS_DISPLAY[formData.skillLevel as keyof typeof SKILL_LEVELS_DISPLAY]?.label || 'Unranked'}
                        </h4>
                        <p className="text-sm text-gray-500">
                          {SKILL_LEVELS_DISPLAY[formData.skillLevel as keyof typeof SKILL_LEVELS_DISPLAY]?.description || `${player?.rating || 0} ELO`}
                        </p>
                      </div>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${formData.skillLevel <= 3 ? 'bg-green-100 text-green-800' :
                        formData.skillLevel <= 6 ? 'bg-blue-100 text-blue-800' :
                          formData.skillLevel <= 8 ? 'bg-amber-100 text-amber-800' :
                            'bg-purple-100 text-purple-800'
                        }`}>
                        Level {formData.skillLevel}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 pt-3 border-t border-gray-200">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      <span className="text-xs text-gray-500 italic">
                        Determined by match performance
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Play Styles</label>
                  <div className="grid grid-cols-2 gap-2">
                    {PLAY_STYLES.map((style) => (
                      <button
                        key={style}
                        type="button"
                        onClick={() => handlePlayStyleToggle(style)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${formData.playStyles.includes(style)
                          ? 'bg-primary text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                      >
                        {style}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <hr />

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
            <Link
              href="/profile"
              className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-center"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
