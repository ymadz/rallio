'use client';

import { useState, useEffect } from 'react';
import { getVenuePromoCodes, PromoCode } from '@/app/actions/promo-actions';
import { Tag, Ticket, Clock, Check, Copy, ChevronRight, Sparkles, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog"
import { useRouter } from 'next/navigation';

export function FeaturedVouchers() {
    const [vouchers, setVouchers] = useState<PromoCode[]>([]);
    const [allVouchers, setAllVouchers] = useState<PromoCode[]>([]);
    const [claimedIds, setClaimedIds] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedVoucher, setSelectedVoucher] = useState<PromoCode | null>(null);
    const [showClaimModal, setShowClaimModal] = useState(false);
    const [showAllModal, setShowAllModal] = useState(false);
    const router = useRouter();

    useEffect(() => {
        // Load claimed IDs from localStorage
        const saved = localStorage.getItem('rallio_claimed_vouchers');
        if (saved) {
            try {
                setClaimedIds(JSON.parse(saved));
            } catch (e) {
                console.error('Failed to parse claimed vouchers', e);
            }
        }

        const fetchVouchers = async () => {
            const result = await getVenuePromoCodes();
            if (result.success && result.data) {
                setAllVouchers(result.data);

                // For the homepage carousel: Only active and NOT claimed
                const claimable = result.data.filter(p =>
                    p.is_active &&
                    (!p.valid_until || new Date(p.valid_until) > new Date()) &&
                    !claimedIds.includes(p.id)
                );
                setVouchers(claimable.slice(0, 5));
            }
            setIsLoading(false);
        };
        fetchVouchers();
    }, [claimedIds.length]);

    const handleClaimClick = (voucher: PromoCode) => {
        setSelectedVoucher(voucher);
        setShowClaimModal(true);
    };

    const copyAndNavigate = (code: string, id: string) => {
        navigator.clipboard.writeText(code);

        // Add to claimed list
        const nextClaimed = [...claimedIds, id];
        setClaimedIds(nextClaimed);
        localStorage.setItem('rallio_claimed_vouchers', JSON.stringify(nextClaimed));

        toast.success(`Voucher ${code} claimed!`);
        setShowClaimModal(false);
    };

    if (isLoading) return (
        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
            {[1, 2, 3].map(i => (
                <div key={i} className="min-w-[280px] h-32 bg-gray-100 animate-pulse rounded-2xl" />
            ))}
        </div>
    );

    if (vouchers.length === 0) return null;

    return (
        <section className="mb-8">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <Ticket className="w-5 h-5 text-primary" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">Claimable Vouchers</h2>
                </div>
                <button
                    onClick={() => setShowAllModal(true)}
                    className="flex items-center gap-1 text-sm font-semibold text-primary hover:text-primary-dark transition-colors"
                >
                    See All
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>

            <div className="flex gap-4 overflow-x-auto pb-4 -mx-1 px-1 scrollbar-hide">
                {vouchers.map((voucher) => (
                    <div
                        key={voucher.id}
                        className="min-w-[300px] relative bg-white border border-gray-100 rounded-2xl overflow-hidden group hover:border-primary/30 hover:shadow-lg transition-all duration-300"
                    >
                        {/* Design like a real ticket */}
                        <div className="flex h-full">
                            <div className="flex-1 p-4">
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex flex-col">
                                        <span className="text-2xl font-black text-primary">
                                            {voucher.discount_type === 'percent' ? `${voucher.discount_value}%` : `₱${voucher.discount_value}`}
                                        </span>
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">OFF VOUCHER</span>
                                    </div>
                                    <div className="bg-primary/5 px-2 py-1 rounded-md">
                                        <span className="text-[10px] font-bold text-primary italic">NEW</span>
                                    </div>
                                </div>
                                <h3 className="text-sm font-semibold text-gray-800 line-clamp-1">{voucher.description}</h3>
                                <div className="mt-3 flex items-center gap-2 text-[10px] text-gray-500 font-medium">
                                    <Clock className="w-3 h-3" />
                                    <span>Min. spend ₱{voucher.min_spend}</span>
                                </div>
                            </div>

                            {/* Dotted border/tear line */}
                            <div className="w-[1px] border-l border-dashed border-gray-200 h-full relative">
                                <div className="absolute top-0 -left-1.5 w-3 h-3 bg-gray-50 rounded-full border-b border-gray-100" />
                                <div className="absolute bottom-0 -left-1.5 w-3 h-3 bg-gray-50 rounded-full border-t border-gray-100" />
                            </div>

                            <div className="w-24 bg-gray-50 flex flex-col items-center justify-center p-2 gap-2">
                                <div className="flex flex-col items-center">
                                    <span className="text-[10px] font-black text-gray-400 mb-1">{voucher.code}</span>
                                    <Button
                                        size="sm"
                                        variant="default"
                                        className="h-7 w-16 text-[10px] rounded-full font-bold shadow-sm"
                                        onClick={() => handleClaimClick(voucher)}
                                    >
                                        CLAIM
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <Dialog open={showClaimModal} onOpenChange={setShowClaimModal}>
                <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden rounded-3xl border-none">
                    {selectedVoucher && (
                        <div className="flex flex-col">
                            {/* Visual Header */}
                            <div className="bg-primary p-8 text-white flex flex-col items-center justify-center text-center relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-10">
                                    <Ticket className="w-32 h-32 rotate-12" />
                                </div>
                                <div className="z-10 bg-white/20 p-3 rounded-2xl backdrop-blur-sm mb-4">
                                    <Sparkles className="w-8 h-8 text-white" />
                                </div>
                                <h3 className="text-3xl font-black mb-1 z-10">
                                    {selectedVoucher.discount_type === 'percent' ? `${selectedVoucher.discount_value}%` : `₱${selectedVoucher.discount_value}`} OFF
                                </h3>
                                <p className="text-white/80 font-medium z-10">Voucher Successfully Claimed!</p>
                            </div>

                            {/* Content */}
                            <div className="p-6 bg-white flex flex-col items-center">
                                <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl p-4 w-full flex flex-col items-center mb-6">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">YOUR PROMO CODE</span>
                                    <div className="text-2xl font-mono font-black text-gray-800 tracking-widest select-all">
                                        {selectedVoucher.code}
                                    </div>
                                </div>

                                <div className="space-y-4 w-full text-sm text-gray-600">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-blue-50 rounded-full flex items-center justify-center flex-shrink-0">
                                            <Tag className="w-4 h-4 text-blue-600" />
                                        </div>
                                        <p>Valid for <strong>{selectedVoucher.description || 'all venues'}</strong></p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-amber-50 rounded-full flex items-center justify-center flex-shrink-0">
                                            <Clock className="w-4 h-4 text-amber-600" />
                                        </div>
                                        <p>Minimum spend of ₱{selectedVoucher.min_spend}</p>
                                    </div>
                                </div>

                                <div className="mt-8 grid grid-cols-2 gap-3 w-full">
                                    <Button
                                        variant="outline"
                                        className="rounded-xl h-12"
                                        onClick={() => setShowClaimModal(false)}
                                    >
                                        Close
                                    </Button>
                                    <Button
                                        className="rounded-xl h-12 bg-primary hover:bg-primary-dark shadow-md shadow-primary/20"
                                        onClick={() => copyAndNavigate(selectedVoucher.code, selectedVoucher.id)}
                                    >
                                        <Copy className="w-4 h-4 mr-2" />
                                        Copy Code
                                    </Button>
                                </div>

                                <button
                                    onClick={() => {
                                        setShowClaimModal(false);
                                        router.push('/home'); // Or wherever bookings are
                                    }}
                                    className="mt-6 flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                                >
                                    <BookOpen className="w-3 h-3" />
                                    Book a Court Now
                                </button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={showAllModal} onOpenChange={setShowAllModal}>
                <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden rounded-3xl">
                    <DialogHeader className="p-6 bg-gray-50 border-b border-gray-100">
                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                            <Ticket className="w-5 h-5 text-primary" />
                            My Voucher Wallet
                        </DialogTitle>
                        <DialogDescription>
                            All available, claimed, and used promo codes.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="max-h-[60vh] overflow-y-auto p-4 space-y-3 bg-white">
                        {allVouchers.length === 0 ? (
                            <div className="py-12 text-center text-gray-500">
                                <Tag className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p>No vouchers found.</p>
                            </div>
                        ) : (
                            allVouchers.map(v => {
                                const isClaimed = claimedIds.includes(v.id);
                                const isExpired = v.valid_until && new Date(v.valid_until) < new Date();
                                const isInactive = !v.is_active;

                                return (
                                    <div
                                        key={v.id}
                                        className={`flex items-center p-3 rounded-2xl border transition-all ${isExpired || isInactive ? 'bg-gray-50 border-gray-100 opacity-60' :
                                                isClaimed ? 'bg-primary/5 border-primary/20' : 'bg-white border-gray-100'
                                            }`}
                                    >
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${isExpired || isInactive ? 'bg-gray-200' : 'bg-primary/10'
                                            }`}>
                                            <span className={`font-bold text-sm ${isExpired || isInactive ? 'text-gray-500' : 'text-primary'}`}>
                                                {v.discount_type === 'percent' ? `${v.discount_value}%` : `₱${v.discount_value}`}
                                            </span>
                                        </div>

                                        <div className="flex-1 min-w-0 px-3">
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-bold text-gray-900 truncate">{v.code}</h4>
                                                {isClaimed && !isExpired && (
                                                    <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">CLAIMED</span>
                                                )}
                                                {isExpired && (
                                                    <span className="text-[10px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded">EXPIRED</span>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-500 truncate">{v.description || 'Venue discount'}</p>
                                        </div>

                                        <Button
                                            size="sm"
                                            variant={isClaimed ? "outline" : "default"}
                                            className="rounded-full text-[10px] h-7 px-3 flex-shrink-0"
                                            disabled={isExpired || isInactive}
                                            onClick={() => {
                                                if (!isClaimed) {
                                                    handleClaimClick(v);
                                                    setShowAllModal(false);
                                                } else {
                                                    navigator.clipboard.writeText(v.code);
                                                    toast.success("Code copied!");
                                                }
                                            }}
                                        >
                                            {isExpired ? 'OVER' : isClaimed ? 'COPY' : 'CLAIM'}
                                        </Button>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </section >
    );
}
