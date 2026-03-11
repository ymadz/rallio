import { redirect } from 'next/navigation'

interface Params {
  params: {
    id: string
  }
}

export default function ReservationByIdPage({ params }: Params) {
  const { id } = params
  redirect(`/court-admin/reservations?reservationId=${id}`)
}
