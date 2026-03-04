'use client';

import { useState, useEffect } from 'react';
import {
    getVenuePromoCodes,
    createPromoCode,
    PromoCode
} from '@/app/actions/promo-actions';
import {
    Tag,
    Plus,
    Search,
    Calendar,
    Users,
    Trash2,
    Loader2,
    CheckCircle2,
    XCircle,
    AlertCircle,
    Info,
    ShieldCheck
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"

interface PromoManagementProps {
    venueId: string;
}

export function PromoManagement({ venueId }: PromoManagementProps) {
    const [promos, setPromos] = useState<PromoCode[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        code: '',
        description: '',
        discount_type: 'percent' as 'percent' | 'fixed',
        discount_value: 0,
        min_spend: 0,
        max_discount_amount: null as number | null,
        usage_limit: null as number | null,
        is_exclusive: false,
        valid_from: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        valid_until: '',
    });

    useEffect(() => {
        loadPromos();
    }, [venueId]);

    const loadPromos = async () => {
        setIsLoading(true);
        const result = await getVenuePromoCodes(venueId);
        if (result.success && result.data) {
            setPromos(result.data);
        } else {
            toast.error('Failed to load promo codes');
        }
        setIsLoading(false);
    };

    const handleCreatePromo = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const result = await createPromoCode({
                venue_id: venueId as any,
                code: formData.code.toUpperCase(),
                description: formData.description || null,
                discount_type: formData.discount_type,
                discount_value: Number(formData.discount_value),
                min_spend: Number(formData.min_spend),
                max_discount_amount: formData.max_discount_amount ? Number(formData.max_discount_amount) : null,
                usage_limit: formData.usage_limit ? Number(formData.usage_limit) : null,
                is_exclusive: formData.is_exclusive,
                is_active: true,
                valid_from: new Date(formData.valid_from).toISOString(),
                valid_until: formData.valid_until ? new Date(formData.valid_until).toISOString() : null,
            } as any);

            if (result.success) {
                toast.success(`Promo code ${formData.code} created!`);
                setShowAddForm(false);
                setFormData({
                    code: '',
                    description: '',
                    discount_type: 'percent',
                    discount_value: 0,
                    min_spend: 0,
                    max_discount_amount: null,
                    usage_limit: null,
                    is_exclusive: false,
                    valid_from: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
                    valid_until: '',
                });
                loadPromos();
            } else {
                toast.error(result.error || 'Failed to create promo code');
            }
        } catch (error) {
            toast.error('An error occurred');
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredPromos = promos.filter(p =>
        p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Promo Codes & Vouchers</h2>
                    <p className="text-sm text-gray-500">Manage Shopee/Lazada style vouchers and influencer codes</p>
                </div>
                <Button
                    onClick={() => setShowAddForm(true)}
                    className="flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    Create New Promo
                </Button>
            </div>

            <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-xl">Create New Promo</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleCreatePromo} className="space-y-4 py-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2 md:col-span-2">
                                <label className="text-sm font-medium text-gray-700">Promo Code (Uppercase)</label>
                                <Input
                                    placeholder="e.g. SUMMER2024"
                                    value={formData.code}
                                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                    required
                                />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <label className="text-sm font-medium text-gray-700">Description</label>
                                <Input
                                    placeholder="e.g. 20% off for first 50 users"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Discount Type</label>
                                <select
                                    className="w-full h-10 px-3 py-2 bg-white border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    value={formData.discount_type}
                                    onChange={(e) => setFormData({ ...formData, discount_type: e.target.value as any })}
                                >
                                    <option value="percent">Percentage (%)</option>
                                    <option value="fixed">Fixed Amount (₱)</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Discount Value</label>
                                <Input
                                    type="number"
                                    placeholder={formData.discount_type === 'percent' ? '20' : '200'}
                                    value={formData.discount_value}
                                    onChange={(e) => setFormData({ ...formData, discount_value: Number(e.target.value) })}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Minimum Spend (₱)</label>
                                <Input
                                    type="number"
                                    value={formData.min_spend}
                                    onChange={(e) => setFormData({ ...formData, min_spend: Number(e.target.value) })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Max Discount (₱) - for % types</label>
                                <Input
                                    type="number"
                                    placeholder="No cap"
                                    value={formData.max_discount_amount || ''}
                                    onChange={(e) => setFormData({ ...formData, max_discount_amount: e.target.value ? Number(e.target.value) : null })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Usage Limit (Global)</label>
                                <Input
                                    type="number"
                                    placeholder="e.g. 50"
                                    value={formData.usage_limit || ''}
                                    onChange={(e) => setFormData({ ...formData, usage_limit: e.target.value ? Number(e.target.value) : null })}
                                />
                            </div>
                            <div className="space-y-4 pt-8">
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="checkbox"
                                        id="is_exclusive"
                                        className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                                        checked={formData.is_exclusive}
                                        onChange={(e) => setFormData({ ...formData, is_exclusive: e.target.checked })}
                                    />
                                    <label
                                        htmlFor="is_exclusive"
                                        className="text-sm font-medium leading-none flex items-center gap-1.5"
                                    >
                                        <ShieldCheck className="w-4 h-4 text-amber-500" />
                                        Exclusive Voucher
                                    </label>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Valid From</label>
                                <Input
                                    type="datetime-local"
                                    value={formData.valid_from}
                                    onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Valid Until (Expiry)</label>
                                <Input
                                    type="datetime-local"
                                    value={formData.valid_until}
                                    onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                                />
                            </div>
                        </div>
                        <DialogFooter className="flex justify-end pt-4">
                            <Button type="submit" disabled={isSubmitting} className="w-full md:w-auto min-w-[200px] h-11 text-base">
                                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Tag className="w-4 h-4 mr-2" />}
                                Publish Voucher
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* List view */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                            placeholder="Search by code or description..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 bg-white border-gray-200"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    {isLoading ? (
                        <div className="py-20 flex flex-col items-center justify-center text-gray-500">
                            <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
                            <p>Loading vouchers...</p>
                        </div>
                    ) : filteredPromos.length === 0 ? (
                        <div className="py-20 flex flex-col items-center justify-center text-gray-500 text-center px-6">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                <Tag className="w-8 h-8 text-gray-300" />
                            </div>
                            <h4 className="text-lg font-semibold text-gray-900 mb-1">No Promo Codes Found</h4>
                            <p className="max-w-md">
                                {searchTerm ? 'Try a different search term.' : 'Start by creating your first Shopee-style voucher to boost bookings.'}
                            </p>
                        </div>
                    ) : (
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-gray-100 bg-gray-50/30">
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Code & Description</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Discount</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Usage</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredPromos.map((promo) => {
                                    const isActive = promo.is_active;
                                    const isExpired = promo.valid_until && new Date(promo.valid_until) < new Date();
                                    const isStarted = new Date(promo.valid_from) <= new Date();
                                    const isExclusive = promo.is_exclusive;

                                    return (
                                        <tr key={promo.id} className="hover:bg-gray-50/50 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-bold text-gray-900 text-base">{promo.code}</span>
                                                        {isExclusive && <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />}
                                                    </div>
                                                    <span className="text-xs text-gray-500 truncate max-w-[200px] mt-1">{promo.description || 'No description'}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded w-fit">
                                                        {promo.discount_type === 'percent' ? `${promo.discount_value}%` : `₱${promo.discount_value}`}
                                                    </span>
                                                    <span className="text-[10px] text-gray-500 mt-1 uppercase tracking-tight">
                                                        Min Spend: ₱{promo.min_spend}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${isExclusive ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-blue-100 text-blue-700 border border-blue-200'}`}>
                                                    {isExclusive ? 'Exclusive' : 'Stackable'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-sm font-semibold text-gray-900">{promo.usage_count}</span>
                                                        <span className="text-xs text-gray-400">redemptions</span>
                                                    </div>
                                                    {promo.usage_limit && (
                                                        <div className="w-24 bg-gray-100 h-1.5 rounded-full mt-1.5 overflow-hidden">
                                                            <div
                                                                className="bg-primary h-full transition-all duration-500"
                                                                style={{ width: `${Math.min(100, ((promo.usage_count || 0) / promo.usage_limit) * 100)}%` }}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {isExpired ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200">
                                                        Expired
                                                    </span>
                                                ) : !isStarted ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200">
                                                        Scheduled
                                                    </span>
                                                ) : isActive ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
                                                        Active
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                                                        Inactive
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}

const Clock = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" > <circle cx="12" cy="12" r="10" /> <polyline points="12 6 12 12 16 14" /> </svg>
);
