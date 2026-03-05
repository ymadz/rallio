'use client'

import { useState, useEffect } from 'react'
import { Plus, Tag, Edit, Trash2, Calendar as CalendarIcon, Loader2, AlertCircle, X, CheckCircle } from 'lucide-react'
import { format } from 'date-fns'
import {
    PromoCode,
    getVenuePromoCodes,
    createPromoCode,
    updatePromoCode,
    deletePromoCode,
    togglePromoCode
} from '@/app/actions/promo-code-actions'

interface PromoCodeManagementProps {
    venueId: string
}

export function PromoCodeManagement({ venueId }: PromoCodeManagementProps) {
    const [promoCodes, setPromoCodes] = useState<PromoCode[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [editingCode, setEditingCode] = useState<PromoCode | null>(null)

    // Form state
    const [formData, setFormData] = useState({
        code: '',
        description: '',
        discount_type: 'percent' as 'percent' | 'fixed',
        discount_value: '',
        max_discount_amount: '',
        max_uses: '',
        max_uses_per_user: '',
        valid_from: '',
        valid_until: '',
        is_active: true
    })

    useEffect(() => {
        if (venueId) {
            loadPromoCodes()
        }
    }, [venueId])

    const loadPromoCodes = async () => {
        setIsLoading(true)
        setError(null)
        try {
            const result = await getVenuePromoCodes(venueId)
            if (!result.success) throw new Error(result.error)
            setPromoCodes(result.data || [])
        } catch (err: any) {
            setError(err.message || 'Failed to load promo codes')
        } finally {
            setIsLoading(false)
        }
    }

    const handleOpenModal = (code?: PromoCode) => {
        if (code) {
            setEditingCode(code)
            setFormData({
                code: code.code,
                description: code.description || '',
                discount_type: code.discount_type,
                discount_value: code.discount_value.toString(),
                max_discount_amount: code.max_discount_amount ? code.max_discount_amount.toString() : '',
                max_uses: code.max_uses ? code.max_uses.toString() : '',
                max_uses_per_user: code.max_uses_per_user ? code.max_uses_per_user.toString() : '',
                valid_from: new Date(code.valid_from).toISOString().slice(0, 16),
                valid_until: new Date(code.valid_until).toISOString().slice(0, 16),
                is_active: code.is_active
            })
        } else {
            setEditingCode(null)
            // Provide default dates: valid from now, until 1 month from now
            const now = new Date()
            const nextMonth = new Date(now)
            nextMonth.setMonth(now.getMonth() + 1)

            setFormData({
                code: '',
                description: '',
                discount_type: 'percent',
                discount_value: '',
                max_discount_amount: '',
                max_uses: '',
                max_uses_per_user: '',
                valid_from: now.toISOString().slice(0, 16),
                valid_until: nextMonth.toISOString().slice(0, 16),
                is_active: true
            })
        }
        setError(null)
        setIsModalOpen(true)
    }

    const handleCloseModal = () => {
        setIsModalOpen(false)
        setError(null)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSubmitting(true)
        setError(null)

        try {
            const dbData = {
                code: formData.code,
                description: formData.description || null,
                discount_type: formData.discount_type,
                discount_value: Number(formData.discount_value),
                max_discount_amount: formData.max_discount_amount ? Number(formData.max_discount_amount) : null,
                max_uses: formData.max_uses ? Number(formData.max_uses) : null,
                max_uses_per_user: formData.max_uses_per_user ? Number(formData.max_uses_per_user) : null,
                valid_from: new Date(formData.valid_from).toISOString(),
                valid_until: new Date(formData.valid_until).toISOString(),
                is_active: formData.is_active
            }

            let result
            if (editingCode) {
                result = await updatePromoCode(editingCode.id, dbData)
            } else {
                result = await createPromoCode(venueId, dbData)
            }

            if (!result.success) throw new Error(result.error)

            await loadPromoCodes()
            handleCloseModal()
        } catch (err: any) {
            setError(err.message || 'Failed to save promo code')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this promo code? This cannot be undone.')) return

        try {
            const result = await deletePromoCode(id)
            if (!result.success) throw new Error(result.error)
            await loadPromoCodes()
        } catch (err: any) {
            alert(err.message || 'Failed to delete promo code')
        }
    }

    const handleToggleActive = async (id: string, currentStatus: boolean) => {
        try {
            const result = await togglePromoCode(id, !currentStatus)
            if (!result.success) throw new Error(result.error)
            await loadPromoCodes()
        } catch (err: any) {
            alert(err.message || 'Failed to update promo code status')
        }
    }

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-12">
                <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
                <p className="text-gray-500">Loading promo codes...</p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Promo Codes</h2>
                    <p className="text-sm text-gray-500 mt-1">
                        Create and manage promotional discounts
                    </p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    <span>Add Promo Code</span>
                </button>
            </div>

            {error && !isModalOpen && (
                <div className="p-4 bg-red-50 text-red-600 rounded-lg flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <p>{error}</p>
                </div>
            )}

            {/* Promo Codes List */}
            <div className="bg-white border text-sm border-gray-200 rounded-xl overflow-hidden shadow-sm">
                {promoCodes.length === 0 ? (
                    <div className="p-12 text-center">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Tag className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-1">No promo codes yet</h3>
                        <p className="text-gray-500 mb-6">Create promotional codes to offer discounts to your customers.</p>
                        <button
                            onClick={() => handleOpenModal()}
                            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                        >
                            Create First Code
                        </button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    <th className="px-6 py-4">Code</th>
                                    <th className="px-6 py-4">Type</th>
                                    <th className="px-6 py-4">Value</th>
                                    <th className="px-6 py-4">Usage</th>
                                    <th className="px-6 py-4 hidden sm:table-cell">Valid Until</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {promoCodes.map((promo) => {
                                    const isExpired = new Date(promo.valid_until) < new Date()
                                    const isExhausted = promo.max_uses !== null && promo.current_uses >= promo.max_uses
                                    const isActuallyActive = promo.is_active && !isExpired && !isExhausted

                                    return (
                                        <tr key={promo.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-gray-900 font-mono text-sm tracking-wide bg-gray-100 px-2 py-1 rounded inline-block">
                                                    {promo.code}
                                                </div>
                                                {promo.description && (
                                                    <div className="text-xs text-gray-500 mt-1 truncate max-w-[150px]" title={promo.description}>
                                                        {promo.description}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 capitalize text-gray-600">
                                                {promo.discount_type === 'percent' ? 'Percentage' : 'Fixed'}
                                            </td>
                                            <td className="px-6 py-4 font-medium text-gray-900">
                                                {promo.discount_type === 'percent' ? `${promo.discount_value}%` : `₱${promo.discount_value.toFixed(2)}`}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm text-gray-900">
                                                    {promo.current_uses} {promo.max_uses ? `/ ${promo.max_uses}` : '(Unlimited)'}
                                                </div>
                                                {promo.max_uses_per_user && (
                                                    <div className="text-xs text-gray-500 mt-0.5">
                                                        Max {promo.max_uses_per_user}/user
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 hidden sm:table-cell">
                                                <div className="flex items-center gap-1.5 text-gray-600">
                                                    <CalendarIcon className="w-3.5 h-3.5" />
                                                    <span>{format(new Date(promo.valid_until), 'MMM d, yyyy')}</span>
                                                </div>
                                                <div className="text-xs text-gray-500 ml-5 mt-0.5">
                                                    From: {format(new Date(promo.valid_from), 'MMM d')}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {isExpired ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
                                                        Expired
                                                    </span>
                                                ) : isExhausted ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                                                        Limit Reached
                                                    </span>
                                                ) : (
                                                    <button
                                                        onClick={() => handleToggleActive(promo.id, promo.is_active)}
                                                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors ${promo.is_active
                                                            ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                                                            : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
                                                            }`}
                                                    >
                                                        <span className={`w-1.5 h-1.5 rounded-full ${promo.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
                                                        {promo.is_active ? 'Active' : 'Inactive'}
                                                    </button>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => handleOpenModal(promo)}
                                                        className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                                                        title="Edit"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(promo.id)}
                                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Create/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100">
                            <h3 className="text-lg font-semibold text-gray-900">
                                {editingCode ? 'Edit Promo Code' : 'Create New Promo Code'}
                            </h3>
                            <button
                                onClick={handleCloseModal}
                                className="text-gray-400 hover:text-gray-600 p-1"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto">
                            {error && (
                                <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-start gap-2">
                                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                                    <p>{error}</p>
                                </div>
                            )}

                            <form id="promo-form" onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Promo Code <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.code}
                                        onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase().replace(/\s/g, '') })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono uppercase"
                                        placeholder="e.g. SUMMER25"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Customers will enter this code at checkout.</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Description
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                        placeholder="e.g. Summer holiday discount"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Discount Type <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            value={formData.discount_type}
                                            onChange={(e) => setFormData({ ...formData, discount_type: e.target.value as 'percent' | 'fixed' })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                                        >
                                            <option value="percent">Percentage (%)</option>
                                            <option value="fixed">Fixed Amount (₱)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Discount Value <span className="text-red-500">*</span>
                                        </label>
                                        <div className="relative">
                                            {formData.discount_type === 'fixed' && (
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <span className="text-gray-500">₱</span>
                                                </div>
                                            )}
                                            <input
                                                type="number"
                                                required
                                                min="0"
                                                step={formData.discount_type === 'percent' ? '1' : '0.01'}
                                                max={formData.discount_type === 'percent' ? '100' : undefined}
                                                value={formData.discount_value}
                                                onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
                                                className={`w-full py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary ${formData.discount_type === 'fixed' ? 'pl-7 pr-3' : 'px-3'}`}
                                                placeholder={formData.discount_type === 'percent' ? '25' : '100'}
                                            />
                                            {formData.discount_type === 'percent' && (
                                                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                                    <span className="text-gray-500">%</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {formData.discount_type === 'percent' && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Max Discount Amount (₱) - Optional
                                        </label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <span className="text-gray-500">₱</span>
                                            </div>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={formData.max_discount_amount}
                                                onChange={(e) => setFormData({ ...formData, max_discount_amount: e.target.value })}
                                                className="w-full py-2 pl-7 pr-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                                placeholder="e.g. 100"
                                            />
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">Limits the maximum discount given. Leave empty for no limit.</p>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Max Uses (Global)
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={formData.max_uses}
                                            onChange={(e) => setFormData({ ...formData, max_uses: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                            placeholder="Unlimited if empty"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Max Uses Per User
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={formData.max_uses_per_user}
                                            onChange={(e) => setFormData({ ...formData, max_uses_per_user: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                            placeholder="Unlimited if empty"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Valid From <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="datetime-local"
                                            required
                                            value={formData.valid_from}
                                            onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Valid Until <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="datetime-local"
                                            required
                                            value={formData.valid_until}
                                            onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                                        />
                                    </div>
                                </div>

                                <div className="pt-2">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.is_active}
                                            onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                            className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
                                        />
                                        <span className="text-sm font-medium text-gray-900">Active status</span>
                                    </label>
                                    <p className="text-xs text-gray-500 mt-1 ml-6">If unchecked, this promo code cannot be used.</p>
                                </div>
                            </form>
                        </div>

                        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 mt-auto">
                            <button
                                type="button"
                                onClick={handleCloseModal}
                                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                                disabled={isSubmitting}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                form="promo-form"
                                disabled={isSubmitting}
                                className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                                {editingCode ? 'Save Changes' : 'Create Code'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
