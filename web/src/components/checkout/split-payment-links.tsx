'use client'

import { useState } from 'react'
import { useCheckoutStore } from '@/stores/checkout-store'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, Clock, XCircle, Copy, ExternalLink } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'

interface SplitPaymentLinksProps {
  onClose?: () => void
}

export function SplitPaymentLinks({ onClose }: SplitPaymentLinksProps) {
  const { playerPayments } = useCheckoutStore()
  const [copiedLink, setCopiedLink] = useState<string | null>(null)

  if (playerPayments.length === 0) {
    return null
  }

  const paidCount = playerPayments.filter(payment => payment.status === 'paid').length
  const allPaid = paidCount === playerPayments.length

  const handleCopyLink = async (url: string, playerNumber: number) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopiedLink(`player-${playerNumber}`)
      window.setTimeout(() => setCopiedLink(null), 2000)
    } catch (error) {
      console.error('Failed to copy split link:', error)
    }
  }

  const getStatusIcon = (status: string) => {
    if (status === 'paid') return <CheckCircle className="w-5 h-5 text-green-500" />
    if (status === 'failed') return <XCircle className="w-5 h-5 text-red-500" />
    return <Clock className="w-5 h-5 text-yellow-500" />
  }

  const getStatusBadge = (status: string) => {
    if (status === 'paid') return <Badge className="bg-green-100 text-green-800">Paid</Badge>
    if (status === 'failed') return <Badge variant="destructive">Failed</Badge>
    return <Badge variant="secondary">Pending</Badge>
  }

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Split Payment Links</span>
          {allPaid && <Badge className="bg-green-100 text-green-800">All Paid</Badge>}
        </CardTitle>
        <p className="text-sm text-gray-600">
          Share each unique link with the corresponding teammate.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {playerPayments.map((payment) => (
          <div
            key={payment.playerNumber}
            className="border border-gray-200 rounded-lg p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {getStatusIcon(payment.status)}
                <div>
                  <p className="font-medium text-gray-900">Player {payment.playerNumber}</p>
                  <p className="text-sm text-gray-600">₱{payment.amountDue.toFixed(2)}</p>
                </div>
              </div>
              {getStatusBadge(payment.status)}
            </div>

            {payment.qrCodeUrl && (
              <div className="grid md:grid-cols-[auto_1fr] gap-4 items-start">
                <div className="bg-white border border-gray-200 rounded-md p-2">
                  <QRCodeSVG value={payment.qrCodeUrl} size={112} includeMargin={true} />
                </div>

                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyLink(payment.qrCodeUrl!, payment.playerNumber)}
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      {copiedLink === `player-${payment.playerNumber}` ? 'Copied!' : 'Copy URL'}
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(payment.qrCodeUrl, '_blank')}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Open Link
                    </Button>
                  </div>

                  <p className="text-xs text-gray-500 break-all">{payment.qrCodeUrl}</p>
                </div>
              </div>
            )}
          </div>
        ))}

        <div className="pt-3 border-t border-gray-200 flex items-center justify-between">
          <p className="text-sm text-gray-600">
            {paidCount} of {playerPayments.length} shares paid
          </p>

          {onClose && (
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
