'use client'

import { useState, useEffect } from 'react'
import {
  getUserDetails,
  assignUserRole,
  removeUserRole,
  banUser,
  unbanUser,
  suspendUser,
  updateUserProfile,
  updatePlayerProfile,
  verifyPlayer,
  unverifyPlayer,
  deactivateUser,
  resetUserPassword
} from '@/app/actions/global-admin-user-actions'
import {
  X,
  Shield,
  AlertTriangle,
  CheckCircle,
  Clock,
  UserX,
  Loader2,
  History,
  Edit,
  Key,
  Trash2,
  BadgeCheck,
  XCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

interface UserDetailModalProps {
  userId: string
  onClose: () => void
  onUpdate: () => void
}

const availableRoles = [
  { id: 'player', name: 'Player', description: 'Regular player who can book courts and join queues' },
  { id: 'queue_master', name: 'Queue Master', description: 'Can create and manage queue sessions' },
  { id: 'court_admin', name: 'Court Admin', description: 'Manages court facilities' },
  { id: 'global_admin', name: 'Global Admin', description: 'Full platform access' },
]

export function UserDetailModal({ userId, onClose, onUpdate }: UserDetailModalProps) {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [showBanModal, setShowBanModal] = useState(false)
  const [showSuspendModal, setShowSuspendModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showEditPlayerModal, setShowEditPlayerModal] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [showDeactivateModal, setShowDeactivateModal] = useState(false)
  const [banReason, setBanReason] = useState('')
  const [suspendReason, setSuspendReason] = useState('')
  const [suspendDays, setSuspendDays] = useState('7')
  const [deactivateReason, setDeactivateReason] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [editForm, setEditForm] = useState({ displayName: '', phone: '' })
  const [editPlayerForm, setEditPlayerForm] = useState({
    birthDate: '',
    gender: '',
    skillLevel: '',
    playStyle: '',
    bio: ''
  })
  const { toast } = useToast()

  useEffect(() => {
    loadUserDetails()
  }, [userId])

  useEffect(() => {
    if (user) {
      setEditForm({
        displayName: user.display_name || '',
        phone: user.phone || ''
      })
      if (user.playerStats) {
        setEditPlayerForm({
          birthDate: user.playerStats.birth_date || '',
          gender: user.playerStats.gender || '',
          skillLevel: user.playerStats.skill_level?.toString() || '',
          playStyle: user.playerStats.play_style || '',
          bio: user.playerStats.bio || ''
        })
      }
    }
  }, [user])

  const loadUserDetails = async () => {
    setLoading(true)
    const result = await getUserDetails(userId)
    
    if (result.success) {
      setUser(result.user)
    } else {
      toast({
        title: 'Error',
        description: 'error' in result ? result.error : 'Failed to load user details',
        variant: 'destructive'
      })
      onClose()
    }
    setLoading(false)
  }

  const handleRoleToggle = async (roleName: string, hasRole: boolean) => {
    setActionLoading(true)
    
    const result = hasRole
      ? await removeUserRole(userId, roleName)
      : await assignUserRole(userId, roleName)

    if (result.success) {
      toast({
        title: 'Success',
        description: 'message' in result ? result.message : 'Action completed'
      })
      await loadUserDetails()
      onUpdate()
    } else {
      toast({
        title: 'Error',
        description: 'error' in result ? result.error : 'Action failed',
        variant: 'destructive'
      })
    }
    setActionLoading(false)
  }

  const handleBan = async () => {
    if (!banReason.trim()) {
      toast({ title: 'Error', description: 'Please provide a reason', variant: 'destructive' })
      return
    }

    setActionLoading(true)
    const result = await banUser(userId, banReason)

    if (result.success) {
      toast({ title: 'Success', description: 'message' in result ? result.message : 'User banned' })
      setShowBanModal(false)
      setBanReason('')
      await loadUserDetails()
      onUpdate()
    } else {
      toast({ title: 'Error', description: 'error' in result ? result.error : 'Failed to ban user', variant: 'destructive' })
    }
    setActionLoading(false)
  }

  const handleSuspend = async () => {
    if (!suspendReason.trim()) {
      toast({ title: 'Error', description: 'Please provide a reason', variant: 'destructive' })
      return
    }

    const days = parseInt(suspendDays)
    if (isNaN(days) || days < 1) {
      toast({ title: 'Error', description: 'Invalid duration', variant: 'destructive' })
      return
    }

    setActionLoading(true)
    const result = await suspendUser(userId, suspendReason, days)

    if (result.success) {
      toast({ title: 'Success', description: 'message' in result ? result.message : 'Action completed' })
      setShowSuspendModal(false)
      setSuspendReason('')
      await loadUserDetails()
      onUpdate()
    } else {
      toast({ title: 'Error', description: 'error' in result ? result.error : 'Action failed', variant: 'destructive' })
    }
    setActionLoading(false)
  }

  const handleUnban = async () => {
    setActionLoading(true)
    const result = await unbanUser(userId)

    if (result.success) {
      toast({ title: 'Success', description: 'message' in result ? result.message : 'Action completed' })
      await loadUserDetails()
      onUpdate()
    } else {
      toast({ title: 'Error', description: 'error' in result ? result.error : 'Action failed', variant: 'destructive' })
    }
    setActionLoading(false)
  }

  const handleUpdateProfile = async () => {
    setActionLoading(true)
    const result = await updateUserProfile(userId, {
      displayName: editForm.displayName,
      phone: editForm.phone
    })

    if (result.success) {
      toast({ title: 'Success', description: 'message' in result ? result.message : 'Action completed' })
      setShowEditModal(false)
      await loadUserDetails()
      onUpdate()
    } else {
      toast({ title: 'Error', description: 'error' in result ? result.error : 'Action failed', variant: 'destructive' })
    }
    setActionLoading(false)
  }

  const handleUpdatePlayerProfile = async () => {
    setActionLoading(true)
    const result = await updatePlayerProfile(userId, {
      birthDate: editPlayerForm.birthDate || undefined,
      gender: editPlayerForm.gender || undefined,
      skillLevel: editPlayerForm.skillLevel ? parseInt(editPlayerForm.skillLevel) : undefined,
      playStyle: editPlayerForm.playStyle || undefined,
      bio: editPlayerForm.bio || undefined
    })

    if (result.success) {
      toast({ title: 'Success', description: 'message' in result ? result.message : 'Action completed' })
      setShowEditPlayerModal(false)
      await loadUserDetails()
      onUpdate()
    } else {
      toast({ title: 'Error', description: 'error' in result ? result.error : 'Action failed', variant: 'destructive' })
    }
    setActionLoading(false)
  }

  const handleVerifyPlayer = async () => {
    setActionLoading(true)
    const result = user?.playerStats?.verified_player 
      ? await unverifyPlayer(userId)
      : await verifyPlayer(userId)

    if (result.success) {
      toast({ title: 'Success', description: 'message' in result ? result.message : 'Action completed' })
      await loadUserDetails()
      onUpdate()
    } else {
      toast({ title: 'Error', description: 'error' in result ? result.error : 'Action failed', variant: 'destructive' })
    }
    setActionLoading(false)
  }

  const handleResetPassword = async () => {
    if (newPassword.length < 6) {
      toast({ title: 'Error', description: 'Password must be at least 6 characters', variant: 'destructive' })
      return
    }

    setActionLoading(true)
    const result = await resetUserPassword(userId, newPassword)

    if (result.success) {
      toast({ title: 'Success', description: 'message' in result ? result.message : 'Action completed' })
      setShowPasswordModal(false)
      setNewPassword('')
    } else {
      toast({ title: 'Error', description: 'error' in result ? result.error : 'Action failed', variant: 'destructive' })
    }
    setActionLoading(false)
  }

  const handleDeactivate = async () => {
    if (!deactivateReason.trim()) {
      toast({ title: 'Error', description: 'Please provide a reason', variant: 'destructive' })
      return
    }

    setActionLoading(true)
    const result = await deactivateUser(userId, deactivateReason)

    if (result.success) {
      toast({ title: 'Success', description: 'message' in result ? result.message : 'Action completed' })
      setShowDeactivateModal(false)
      setDeactivateReason('')
      await loadUserDetails()
      onUpdate()
    } else {
      toast({ title: 'Error', description: 'error' in result ? result.error : 'Action failed', variant: 'destructive' })
    }
    setActionLoading(false)
  }

  const userRoles = user?.user_roles?.map((ur: any) => ur.roles.name) || []

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div 
          className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white text-2xl font-semibold">
                    {user.display_name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{user.display_name}</h2>
                    <p className="text-sm text-gray-600">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setEditForm({
                        displayName: user.display_name || '',
                        phone: user.phone || ''
                      })
                      setShowEditModal(true)
                    }}
                    className="p-2 hover:bg-purple-50 rounded-lg transition-colors text-purple-600"
                    title="Edit Profile"
                  >
                    <Edit className="w-5 h-5" />
                  </button>
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Edit Profile Modal */}
              {showEditModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60]" onClick={() => setShowEditModal(false)}>
                  <div className="bg-white rounded-xl w-full max-w-md p-6 m-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-semibold">Edit Profile</h3>
                      <button onClick={() => setShowEditModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Display Name</label>
                        <input
                          type="text"
                          value={editForm.displayName}
                          onChange={(e) => setEditForm({...editForm, displayName: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                        <input
                          type="tel"
                          value={editForm.phone}
                          onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          placeholder="Optional"
                        />
                      </div>
                      <div className="flex gap-3 pt-4">
                        <button
                          onClick={handleUpdateProfile}
                          disabled={actionLoading || !editForm.displayName}
                          className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {actionLoading ? 'Saving...' : 'Save Changes'}
                        </button>
                        <button
                          onClick={() => setShowEditModal(false)}
                          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Edit Player Profile Modal */}
              {showEditPlayerModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60]" onClick={() => setShowEditPlayerModal(false)}>
                  <div className="bg-white rounded-xl w-full max-w-md p-6 m-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-semibold">Edit Player Profile</h3>
                      <button onClick={() => setShowEditPlayerModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Birth Date</label>
                        <input
                          type="date"
                          value={editPlayerForm.birthDate}
                          onChange={(e) => setEditPlayerForm({...editPlayerForm, birthDate: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Gender</label>
                        <select
                          value={editPlayerForm.gender}
                          onChange={(e) => setEditPlayerForm({...editPlayerForm, gender: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        >
                          <option value="">Select Gender</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="other">Other</option>
                          <option value="prefer_not_to_say">Prefer not to say</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Skill Level (1-10): {editPlayerForm.skillLevel}</label>
                        <input
                          type="range"
                          min="1"
                          max="10"
                          value={editPlayerForm.skillLevel}
                          onChange={(e) => setEditPlayerForm({...editPlayerForm, skillLevel: e.target.value})}
                          className="w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Play Style</label>
                        <select
                          value={editPlayerForm.playStyle}
                          onChange={(e) => setEditPlayerForm({...editPlayerForm, playStyle: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        >
                          <option value="">Select Play Style</option>
                          <option value="casual">Casual</option>
                          <option value="competitive">Competitive</option>
                          <option value="singles">Singles</option>
                          <option value="doubles">Doubles</option>
                          <option value="mixed">Mixed</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Bio</label>
                        <textarea
                          value={editPlayerForm.bio}
                          onChange={(e) => setEditPlayerForm({...editPlayerForm, bio: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          rows={3}
                          placeholder="Tell us about yourself..."
                        />
                      </div>
                      <div className="flex gap-3 pt-4">
                        <button
                          onClick={handleUpdatePlayerProfile}
                          disabled={actionLoading}
                          className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {actionLoading ? 'Saving...' : 'Save Changes'}
                        </button>
                        <button
                          onClick={() => setShowEditPlayerModal(false)}
                          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Reset Password Modal */}
              {showPasswordModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60]" onClick={() => setShowPasswordModal(false)}>
                  <div className="bg-white rounded-xl w-full max-w-md p-6 m-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-semibold">Reset Password</h3>
                      <button onClick={() => setShowPasswordModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          placeholder="Minimum 6 characters"
                        />
                      </div>
                      <div className="flex gap-3 pt-4">
                        <button
                          onClick={handleResetPassword}
                          disabled={actionLoading || newPassword.length < 6}
                          className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {actionLoading ? 'Resetting...' : 'Reset Password'}
                        </button>
                        <button
                          onClick={() => setShowPasswordModal(false)}
                          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Deactivate User Modal */}
              {showDeactivateModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60]" onClick={() => setShowDeactivateModal(false)}>
                  <div className="bg-white rounded-xl w-full max-w-md p-6 m-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-semibold text-red-600">Deactivate User</h3>
                      <button onClick={() => setShowDeactivateModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="space-y-4">
                      <p className="text-gray-600">This will deactivate the user's account. They won't be able to log in.</p>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Reason (required)</label>
                        <textarea
                          value={deactivateReason}
                          onChange={(e) => setDeactivateReason(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                          rows={3}
                          placeholder="Explain why this user is being deactivated..."
                        />
                      </div>
                      <div className="flex gap-3 pt-4">
                        <button
                          onClick={handleDeactivate}
                          disabled={actionLoading || !deactivateReason.trim()}
                          className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {actionLoading ? 'Deactivating...' : 'Deactivate User'}
                        </button>
                        <button
                          onClick={() => setShowDeactivateModal(false)}
                          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}


              {/* Content */}
              <div className="p-6 space-y-6">
                {/* Status Banner */}
                {user.is_banned && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="font-semibold text-red-900">
                        {user.banned_until ? 'User Suspended' : 'User Banned'}
                      </h3>
                      <p className="text-sm text-red-700 mt-1">
                        Reason: {user.banned_reason || 'No reason provided'}
                      </p>
                      {user.banned_until && (
                        <p className="text-sm text-red-700">
                          Until: {new Date(user.banned_until).toLocaleString()}
                        </p>
                      )}
                      <button
                        onClick={handleUnban}
                        disabled={actionLoading}
                        className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm font-medium"
                      >
                        Unban User
                      </button>
                    </div>
                  </div>
                )}

                {/* Role Management */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Role Management
                  </h3>
                  <div className="space-y-3">
                    {availableRoles.map((role) => {
                      const hasRole = userRoles.includes(role.id)
                      return (
                        <div
                          key={role.id}
                          className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-purple-300 transition-colors"
                        >
                          <div>
                            <h4 className="font-medium text-gray-900">{role.name}</h4>
                            <p className="text-sm text-gray-600">{role.description}</p>
                          </div>
                          <button
                            onClick={() => handleRoleToggle(role.id, hasRole)}
                            disabled={actionLoading}
                            className={cn(
                              'px-4 py-2 rounded-lg font-medium text-sm transition-colors disabled:opacity-50',
                              hasRole
                                ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            )}
                          >
                            {hasRole ? 'Remove' : 'Assign'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Player Stats (if available) */}
                {user.playerStats && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">Player Stats</h3>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleVerifyPlayer}
                          disabled={actionLoading}
                          className={cn(
                            'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50',
                            user.playerStats.verified_player
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          )}
                        >
                          {user.playerStats.verified_player ? (
                            <>
                              <CheckCircle className="w-4 h-4 inline mr-1" />
                              Verified
                            </>
                          ) : (
                            <>
                              <XCircle className="w-4 h-4 inline mr-1" />
                              Verify Player
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => {
                            setEditPlayerForm({
                              birthDate: user.playerStats?.birth_date || '',
                              gender: user.playerStats?.gender || '',
                              skillLevel: user.playerStats?.skill_level?.toString() || '5',
                              playStyle: user.playerStats?.play_style || '',
                              bio: user.playerStats?.bio || ''
                            })
                            setShowEditPlayerModal(true)
                          }}
                          className="p-1.5 hover:bg-purple-50 rounded-lg transition-colors text-purple-600"
                          title="Edit Player Profile"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-sm text-gray-600">Skill Level</p>
                        <p className="text-2xl font-bold text-gray-900">{user.playerStats.skill_level || 'N/A'}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-sm text-gray-600">Rating</p>
                        <p className="text-2xl font-bold text-gray-900">{user.playerStats.rating || 0}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-sm text-gray-600">Games Played</p>
                        <p className="text-2xl font-bold text-gray-900">{user.playerStats.total_games_played || 0}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-sm text-gray-600">Wins</p>
                        <p className="text-2xl font-bold text-gray-900">{user.playerStats.total_wins || 0}</p>
                      </div>
                    </div>
                    {user.playerStats.bio && (
                      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                        <p className="text-sm font-medium text-gray-700 mb-1">Bio</p>
                        <p className="text-gray-600">{user.playerStats.bio}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Danger Zone */}
                {!user.is_banned && (
                  <div>
                    <h3 className="text-lg font-semibold text-red-900 mb-4 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5" />
                      Danger Zone
                    </h3>
                    <div className="space-y-3">
                      <button
                        onClick={() => setShowPasswordModal(true)}
                        disabled={actionLoading}
                        className="w-full flex items-center justify-between p-4 border-2 border-blue-200 rounded-lg hover:border-blue-300 transition-colors disabled:opacity-50"
                      >
                        <div className="text-left">
                          <h4 className="font-medium text-blue-900">Reset Password</h4>
                          <p className="text-sm text-blue-700">Set a new password for this user</p>
                        </div>
                        <Key className="w-5 h-5 text-blue-600" />
                      </button>

                      <button
                        onClick={() => setShowSuspendModal(true)}
                        disabled={actionLoading}
                        className="w-full flex items-center justify-between p-4 border-2 border-orange-200 rounded-lg hover:border-orange-300 transition-colors disabled:opacity-50"
                      >
                        <div className="text-left">
                          <h4 className="font-medium text-orange-900">Suspend User</h4>
                          <p className="text-sm text-orange-700">Temporarily restrict access</p>
                        </div>
                        <Clock className="w-5 h-5 text-orange-600" />
                      </button>

                      <button
                        onClick={() => setShowBanModal(true)}
                        disabled={actionLoading}
                        className="w-full flex items-center justify-between p-4 border-2 border-red-200 rounded-lg hover:border-red-300 transition-colors disabled:opacity-50"
                      >
                        <div className="text-left">
                          <h4 className="font-medium text-red-900">Ban User</h4>
                          <p className="text-sm text-red-700">Permanently restrict access</p>
                        </div>
                        <UserX className="w-5 h-5 text-red-600" />
                      </button>

                      <button
                        onClick={() => setShowDeactivateModal(true)}
                        disabled={actionLoading}
                        className="w-full flex items-center justify-between p-4 border-2 border-gray-300 rounded-lg hover:border-gray-400 transition-colors disabled:opacity-50"
                      >
                        <div className="text-left">
                          <h4 className="font-medium text-gray-900">Deactivate Account</h4>
                          <p className="text-sm text-gray-700">Disable user login (reversible)</p>
                        </div>
                        <Trash2 className="w-5 h-5 text-gray-600" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Recent Activity */}
                {user.recentActivity && user.recentActivity.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <History className="w-5 h-5" />
                      Recent Activity
                    </h3>
                    <div className="space-y-2">
                      {user.recentActivity.map((activity: any, idx: number) => (
                        <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                          <CheckCircle className="w-4 h-4 text-purple-600 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">{activity.action_type}</p>
                            <p className="text-xs text-gray-600">
                              {new Date(activity.created_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Ban Modal */}
      {showBanModal && (
        <>
          <div className="fixed inset-0 bg-black/70 z-[60]" onClick={() => setShowBanModal(false)} />
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full pointer-events-auto" onClick={(e) => e.stopPropagation()}>
              <div className="p-6 space-y-4">
                <h3 className="text-xl font-bold text-red-900">Ban User</h3>
                <p className="text-sm text-gray-600">This will permanently ban the user from the platform.</p>
                <textarea
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  placeholder="Reason for banning (required)"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                  rows={4}
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowBanModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleBan}
                    disabled={actionLoading || !banReason.trim()}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    {actionLoading ? 'Banning...' : 'Ban User'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Suspend Modal */}
      {showSuspendModal && (
        <>
          <div className="fixed inset-0 bg-black/70 z-[60]" onClick={() => setShowSuspendModal(false)} />
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full pointer-events-auto" onClick={(e) => e.stopPropagation()}>
              <div className="p-6 space-y-4">
                <h3 className="text-xl font-bold text-orange-900">Suspend User</h3>
                <p className="text-sm text-gray-600">Temporarily restrict user access.</p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Duration (days)</label>
                  <input
                    type="number"
                    value={suspendDays}
                    onChange={(e) => setSuspendDays(e.target.value)}
                    min="1"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
                <textarea
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  placeholder="Reason for suspension (required)"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                  rows={4}
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowSuspendModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSuspend}
                    disabled={actionLoading || !suspendReason.trim()}
                    className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
                  >
                    {actionLoading ? 'Suspending...' : 'Suspend User'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
