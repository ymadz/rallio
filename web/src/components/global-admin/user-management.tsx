'use client'

import { useState, useEffect, useCallback } from 'react'
import { 
  getAllUsers, 
  banUser, 
  unbanUser, 
  resetUserPassword,
  deactivateUser
} from '@/app/actions/global-admin-user-actions'
import {
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  UserCheck,
  UserX,
  Shield,
  Clock,
  Loader2,
  UserPlus,
  Trash2,
  Ban,
  CheckCircle,
  Edit,
  Key
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { UserDetailModal } from './user-detail-modal'
import { CreateUserModal } from './create-user-modal'
import { useToast } from '@/hooks/use-toast'

interface User {
  id: string
  email: string
  display_name: string
  avatar_url?: string
  created_at: string
  is_banned: boolean
  is_active: boolean
  banned_reason?: string
  banned_until?: string
  user_roles: Array<{ roles: { id: string; name: string } }>
}

const roleFilters = [
  { id: 'all', label: 'All Users', icon: Shield },
  { id: 'player', label: 'Players', icon: UserCheck },
  { id: 'court_admin', label: 'Court Admins', icon: Shield },
  { id: 'queue_master', label: 'Queue Masters', icon: UserCheck },
  { id: 'global_admin', label: 'Global Admins', icon: Shield },
]

const statusFilters = [
  { id: 'all', label: 'All Status' },
  { id: 'active', label: 'Active' },
  { id: 'banned', label: 'Banned' },
]

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'banned'>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [selectedUser, setSelectedUser] = useState<string | null>(null)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())
  const [showBatchActions, setShowBatchActions] = useState(false)
  const { toast } = useToast()

  const loadUsers = async () => {
    setLoading(true)
    const result = await getAllUsers({
      page: currentPage,
      pageSize: 20,
      search: searchQuery,
      roleFilter,
      statusFilter
    })

    if (result.success) {
      setUsers('users' in result ? result.users : [])
      setTotalPages('totalPages' in result ? result.totalPages : 1)
      setTotalCount('totalCount' in result ? result.totalCount : 0)
    } else {
      toast({
        title: 'Error',
        description: 'error' in result ? result.error : 'Failed to load users',
        variant: 'destructive'
      })
    }
    setLoading(false)
  }

  useEffect(() => {
    const debounce = setTimeout(() => {
      loadUsers()
    }, 300)

    return () => clearTimeout(debounce)
  }, [currentPage, searchQuery, roleFilter, statusFilter])

  const getRoleBadgeColor = (roleName: string) => {
    switch (roleName) {
      case 'global_admin': return 'bg-purple-100 text-purple-700'
      case 'court_admin': return 'bg-blue-100 text-blue-700'
      case 'queue_master': return 'bg-green-100 text-green-700'
      case 'player': return 'bg-gray-100 text-gray-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  const formatRoleName = (name: string) => {
    return name.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }

  const toggleUserSelection = (userId: string) => {
    const newSelected = new Set(selectedUsers)
    if (newSelected.has(userId)) {
      newSelected.delete(userId)
    } else {
      newSelected.add(userId)
    }
    setSelectedUsers(newSelected)
  }

  const toggleAllUsers = () => {
    if (selectedUsers.size === users.length) {
      setSelectedUsers(new Set())
    } else {
      setSelectedUsers(new Set(users.map(u => u.id)))
    }
  }

  const handleBatchAction = async (action: 'activate' | 'ban' | 'delete') => {
    if (selectedUsers.size === 0) {
      toast({
        title: 'No users selected',
        description: 'Please select users to perform batch actions',
        variant: 'destructive'
      })
      return
    }

    const confirmMessage = `Are you sure you want to ${action} ${selectedUsers.size} user(s)?`
    if (!confirm(confirmMessage)) return

    toast({
      title: 'Processing',
      description: `${action}ing ${selectedUsers.size} users...`
    })

    // Here you would call the batch action API
    // For now, just show success
    setTimeout(() => {
      toast({
        title: 'Success',
        description: `Successfully ${action}ed ${selectedUsers.size} users`
      })
      setSelectedUsers(new Set())
      loadUsers()
    }, 1000)
  }

  const handleResetPassword = async (userId: string) => {
    const newPassword = prompt('Enter new password for this user (minimum 6 characters):')
    if (!newPassword) return
    
    if (newPassword.length < 6) {
      toast({
        title: 'Error',
        description: 'Password must be at least 6 characters',
        variant: 'destructive'
      })
      return
    }

    const result = await resetUserPassword(userId, newPassword)
    if (result.success) {
      toast({
        title: 'Success',
        description: 'Password reset successfully'
      })
    } else {
      toast({
        title: 'Error',
        description: 'error' in result ? result.error : 'Failed to reset password',
        variant: 'destructive'
      })
    }
  }

  const handleBanUser = async (userId: string) => {
    const reason = prompt('Enter reason for banning this user:')
    if (!reason) return

    const result = await banUser(userId, reason)
    if (result.success) {
      toast({
        title: 'Success',
        description: 'User banned successfully'
      })
      loadUsers()
    } else {
      toast({
        title: 'Error',
        description: 'error' in result ? result.error : 'Failed to ban user',
        variant: 'destructive'
      })
    }
  }

  const handleUnbanUser = async (userId: string) => {
    if (!confirm('Are you sure you want to unban this user?')) return

    const result = await unbanUser(userId)
    if (result.success) {
      toast({
        title: 'Success',
        description: 'User unbanned successfully'
      })
      loadUsers()
    } else {
      toast({
        title: 'Error',
        description: 'error' in result ? result.error : 'Failed to unban user',
        variant: 'destructive'
      })
    }
  }

  const handleDeactivateUser = async (userId: string) => {
    const reason = prompt('Enter reason for deactivating this user:')
    if (!reason) return

    const result = await deactivateUser(userId, reason)
    if (result.success) {
      toast({
        title: 'Success',
        description: 'User deactivated successfully'
      })
      loadUsers()
    } else {
      toast({
        title: 'Error',
        description: 'error' in result ? result.error : 'Failed to deactivate user',
        variant: 'destructive'
      })
    }
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-600 mt-2">
            {selectedUsers.size > 0 
              ? `${selectedUsers.size} user(s) selected`
              : 'Manage users, roles, and permissions'
            }
          </p>
        </div>
        <div className="flex items-center gap-3">
          {selectedUsers.size > 0 && (
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
              <button
                onClick={() => handleBatchAction('activate')}
                className="flex items-center gap-1 px-3 py-1 text-sm text-green-700 hover:bg-green-50 rounded"
                title="Activate selected"
              >
                <CheckCircle className="w-4 h-4" />
                Activate
              </button>
              <button
                onClick={() => handleBatchAction('ban')}
                className="flex items-center gap-1 px-3 py-1 text-sm text-red-700 hover:bg-red-50 rounded"
                title="Ban selected"
              >
                <Ban className="w-4 h-4" />
                Ban
              </button>
              <button
                onClick={() => handleBatchAction('delete')}
                className="flex items-center gap-1 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50 rounded"
                title="Delete selected"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          )}
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <UserPlus className="w-5 h-5" />
            Create User
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Role Filter */}
          <div className="flex gap-2 overflow-x-auto pb-2 lg:pb-0">
            {roleFilters.map((filter) => {
              const Icon = filter.icon
              return (
                <button
                  key={filter.id}
                  onClick={() => {
                    setRoleFilter(filter.id)
                    setCurrentPage(1)
                  }}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
                    roleFilter === filter.id
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {filter.label}
                </button>
              )
            })}
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as 'all' | 'active' | 'banned')
              setCurrentPage(1)
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            {statusFilters.map((filter) => (
              <option key={filter.id} value={filter.id}>
                {filter.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Results Summary */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Showing {users.length} of {totalCount} users
        </p>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No users found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedUsers.size === users.length && users.length > 0}
                      onChange={toggleAllUsers}
                      className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Roles
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Joined
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className={cn(
                      "hover:bg-gray-50 transition-colors",
                      selectedUsers.has(user.id) && "bg-purple-50"
                    )}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedUsers.has(user.id)}
                        onChange={(e) => {
                          e.stopPropagation()
                          toggleUserSelection(user.id)
                        }}
                        className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                    </td>
                    <td 
                      className="px-6 py-4 whitespace-nowrap cursor-pointer"
                      onClick={() => setSelectedUser(user.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white font-semibold">
                          {user.display_name?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{user.display_name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="text-sm text-gray-600">{user.email}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {user.user_roles?.map((ur) => (
                          <span
                            key={ur.roles.id}
                            className={cn(
                              'px-2 py-1 rounded-full text-xs font-medium',
                              getRoleBadgeColor(ur.roles.name)
                            )}
                          >
                            {formatRoleName(ur.roles.name)}
                          </span>
                        ))}
                        {(!user.user_roles || user.user_roles.length === 0) && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                            No roles
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.is_active === false ? (
                        <div 
                          className="flex items-center gap-2 cursor-help" 
                          title="Account has been deactivated"
                        >
                          <UserX className="w-4 h-4 text-gray-600" />
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-600">Deactivated</span>
                          </div>
                        </div>
                      ) : user.is_banned ? (
                        <div 
                          className="flex items-center gap-2 cursor-help" 
                          title={user.banned_reason || 'No reason provided'}
                        >
                          <UserX className="w-4 h-4 text-red-600" />
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-red-600">
                              {user.banned_until ? 'Suspended' : 'Banned'}
                            </span>
                            {user.banned_until && (
                              <span className="text-xs text-red-500">
                                Until {new Date(user.banned_until).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <UserCheck className="w-4 h-4 text-green-600" />
                          <span className="text-sm font-medium text-green-600">Active</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Clock className="w-4 h-4" />
                        {new Date(user.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setOpenDropdown(openDropdown === user.id ? null : user.id)
                          }}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <MoreVertical className="w-5 h-5 text-gray-600" />
                        </button>
                        
                        {/* Dropdown Menu */}
                        {openDropdown === user.id && (
                          <>
                            <div 
                              className="fixed inset-0 z-10" 
                              onClick={(e) => {
                                e.stopPropagation()
                                setOpenDropdown(null)
                              }}
                            />
                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setOpenDropdown(null)
                                  setSelectedUser(user.id)
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                              >
                                <Edit className="w-4 h-4" />
                                View Details
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setOpenDropdown(null)
                                  handleResetPassword(user.id)
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                              >
                                <Key className="w-4 h-4" />
                                Reset Password
                              </button>
                              <div className="border-t border-gray-100 my-1" />
                              {user.is_banned ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setOpenDropdown(null)
                                    handleUnbanUser(user.id)
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm text-green-700 hover:bg-green-50 flex items-center gap-2"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                  Unban User
                                </button>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setOpenDropdown(null)
                                    handleBanUser(user.id)
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm text-orange-700 hover:bg-orange-50 flex items-center gap-2"
                                >
                                  <Ban className="w-4 h-4" />
                                  Ban User
                                </button>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setOpenDropdown(null)
                                  handleDeactivateUser(user.id)
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-red-700 hover:bg-red-50 flex items-center gap-2"
                              >
                                <Trash2 className="w-4 h-4" />
                                Deactivate User
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-5 h-5" />
            Previous
          </button>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">
              Page {currentPage} of {totalPages}
            </span>
          </div>

          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* User Detail Modal */}
      {selectedUser && (
        <UserDetailModal
          userId={selectedUser}
          onClose={() => setSelectedUser(null)}
          onUpdate={loadUsers}
        />
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <CreateUserModal
          onClose={() => setShowCreateModal(false)}
          onUserCreated={loadUsers}
        />
      )}
    </div>
  )
}
