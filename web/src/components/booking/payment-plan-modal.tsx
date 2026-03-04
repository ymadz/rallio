'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { format, isAfter, startOfDay } from 'date-fns'
import { initiatePaymentAction } from '@/app/actions/payments'
import { toast } from 'sonner'
import { Loader2, Calendar as CalendarIcon, PhilippinePeso, CheckCircle2, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { PaymentPlan, PaymentInstallment } from '@/lib/payment-plan'

interface PaymentPlanModalProps {
  isOpen: boolean
  onClose: () => void
  reservationId: string
}

export function PaymentPlanModal({ isOpen, onClose, reservationId }: PaymentPlanModalProps) {
  const [loading, setLoading] = useState(true)
  const [processingPayment, setProcessingPayment] = useState(false)
  const [reservation, setReservation] = useState<any>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const supabase = createClient()

  useEffect(() => {
    if (isOpen && reservationId) {
      fetchReservation()
    }
  }, [isOpen, reservationId])

  const fetchReservation = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('reservations')
      .select(`
        *,
        courts (
          name,
          venues (name)
        )
      `)
      .eq('id', reservationId)
      .single()

    if (error) {
      toast.error('Failed to load reservation details')
      onClose()
    } else {
      setReservation(data)
      // Pre-select pending installments that are due (today or before)
      const plan = data.metadata?.payment_plan as PaymentPlan
      if (plan) {
        const today = startOfDay(new Date())
        const dueIds = plan.installments
          .filter(inst => inst.status === 'pending' && !isAfter(startOfDay(new Date(inst.date)), today))
          .map(inst => inst.id)
        setSelectedIds(dueIds)
      }
    }
    setLoading(false)
  }

  const plan = reservation?.metadata?.payment_plan as PaymentPlan
  const installments = plan?.installments || []
  
  const selectedInstallments = installments.filter(i => selectedIds.includes(i.id))
  const selectedTotal = selectedInstallments.reduce((sum, i) => sum + i.amount, 0)

  const toggleInstallment = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const handlePay = async () => {
    if (selectedIds.length === 0) return

    setProcessingPayment(true)
    try {
      const result = await initiatePaymentAction(
        reservationId, 
        'gcash', // Default to gcash for installments
        selectedTotal,
        selectedIds
      )

      if (result.success && result.checkoutUrl) {
        window.location.href = result.checkoutUrl
      } else {
        toast.error(result.error || 'Failed to initiate payment')
      }
    } catch (err) {
      toast.error('An unexpected error occurred')
    } finally {
      setProcessingPayment(false)
    }
  }

  if (!isOpen) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl bg-slate-50">
        <DialogHeader className="p-6 bg-white border-b border-slate-100">
          <DialogTitle className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <PhilippinePeso className="w-6 h-6 text-primary" />
            Payment Plan
          </DialogTitle>
          <DialogDescription className="text-slate-500">
            {reservation?.courts?.venues?.name} - {reservation?.courts?.name}
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-slate-500 font-medium">Loading your payment schedule...</p>
            </div>
          ) : !plan ? (
            <div className="text-center py-12">
              <p className="text-slate-500">No payment plan found for this reservation.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Total Amount</p>
                  <p className="text-xl font-bold text-slate-900">₱{reservation?.total_amount.toFixed(2)}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Paid So Far</p>
                  <p className="text-xl font-bold text-emerald-600">₱{reservation?.amount_paid.toFixed(2)}</p>
                </div>
              </div>

              <h3 className="text-sm font-bold text-slate-900 mb-2 uppercase tracking-wide px-1">Daily Installments</h3>
              <div className="space-y-3">
                {installments.map((inst) => {
                  const isPaid = inst.status === 'paid'
                  const isPastDue = !isPaid && isAfter(startOfDay(new Date()), startOfDay(new Date(inst.date)))
                  const isToday = !isPaid && startOfDay(new Date()).getTime() === startOfDay(new Date(inst.date)).getTime()
                  
                  return (
                    <div 
                      key={inst.id}
                      onClick={() => !isPaid && toggleInstallment(inst.id)}
                      className={`
                        flex items-center justify-between p-4 rounded-xl transition-all cursor-pointer border-2
                        ${isPaid 
                          ? 'bg-slate-100/50 border-transparent opacity-60' 
                          : selectedIds.includes(inst.id)
                            ? 'bg-white border-primary ring-4 ring-primary/5 shadow-md'
                            : 'bg-white border-slate-100 hover:border-slate-200'
                        }
                      `}
                    >
                      <div className="flex items-center gap-3">
                        {isPaid ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        ) : (
                          <Checkbox 
                            checked={selectedIds.includes(inst.id)} 
                            onCheckedChange={() => toggleInstallment(inst.id)}
                            className="w-5 h-5"
                          />
                        )}
                        <div>
                          <p className={`font-bold ${isPaid ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                            {format(new Date(inst.date), 'MMMM d, yyyy')}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {isPaid ? (
                              <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold uppercase">Paid</span>
                            ) : isPastDue ? (
                              <span className="text-[10px] bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full font-bold uppercase flex items-center gap-1">
                                <Clock className="w-3 h-3" /> Past Due
                              </span>
                            ) : isToday ? (
                              <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold uppercase">Due Today</span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      <p className={`text-lg font-black ${isPaid ? 'text-slate-400' : 'text-slate-900'}`}>
                        ₱{inst.amount.toFixed(2)}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="p-6 bg-white border-t border-slate-100">
          <div className="flex items-center justify-between w-full">
            <div className="text-left">
              <p className="text-xs text-slate-500 font-semibold uppercase">Total to Pay</p>
              <p className="text-2xl font-black text-slate-900">₱{selectedTotal.toFixed(2)}</p>
            </div>
            <Button 
              onClick={handlePay}
              disabled={selectedIds.length === 0 || processingPayment}
              className="px-8 py-6 rounded-xl text-lg font-bold shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95"
            >
              {processingPayment ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                'Pay Selected Days'
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
