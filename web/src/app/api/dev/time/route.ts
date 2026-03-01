import { NextRequest, NextResponse } from 'next/server'
import { getServerNow, setServerTimeOffset } from '@/lib/time-server'

/**
 * GET /api/dev/time
 * Returns the current simulated time and offset.
 */
export async function GET() {
    if (process.env.NODE_ENV !== 'development') {
        return NextResponse.json({ error: 'Not allowed in production' }, { status: 403 })
    }

    const now = await getServerNow()
    // Calculate offset relative to request time
    const offset = now.getTime() - Date.now()

    return NextResponse.json({
        now: now.toISOString(),
        offsetMs: offset,
        realTime: new Date().toISOString()
    })
}

/**
 * POST /api/dev/time
 * Sets the time offset.
 * Body: { targetTime: string } OR { offsetMs: number }
 */
export async function POST(req: NextRequest) {
    if (process.env.NODE_ENV !== 'development') {
        return NextResponse.json({ error: 'Not allowed in production' }, { status: 403 })
    }

    try {
        const body = await req.json()
        let offsetMs = 0

        if (typeof body.offsetMs === 'number') {
            offsetMs = body.offsetMs
        } else if (body.targetTime) {
            const targetTime = new Date(body.targetTime).getTime()
            if (isNaN(targetTime)) {
                return NextResponse.json({ error: 'Invalid targetTime' }, { status: 400 })
            }
            offsetMs = targetTime - Date.now()
        } else if (body.reset) {
            offsetMs = 0
        } else {
            return NextResponse.json({ error: 'Missing offsetMs or targetTime' }, { status: 400 })
        }

        const success = await setServerTimeOffset(offsetMs)

        if (!success) {
            return NextResponse.json({ error: 'Failed to set time offset' }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            offsetMs,
            newTime: new Date(Date.now() + offsetMs).toISOString()
        })
    } catch (error) {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }
}
