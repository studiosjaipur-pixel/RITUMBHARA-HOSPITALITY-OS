// Public pre-arrival check-in page. Shows only the one reservation behind this link.
import type { Metadata } from "next"
import { prisma } from "@/lib/prisma"
import { hashCheckInToken, isWellFormedCheckInToken } from "@/lib/checkin/server"
import { CheckInForm } from "@/components/checkin/checkin-form"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Online check-in · Ritumbhara", robots: { index: false, follow: false } }

export default async function CheckInPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const row = isWellFormedCheckInToken(token)
    ? await prisma.checkIn.findUnique({
        where: { tokenHash: hashCheckInToken(token) },
        include: { reservation: { include: { guest: true, unit: { include: { property: true } } } } },
      })
    : null
  const bad = !row ? "This check-in link is not valid." : row.expiresAt < new Date() ? "This check-in link has expired. Please ask the property for a new one." : null

  return (
    <div className="min-h-[100dvh] bg-muted/30">
      <header className="bg-gradient-to-r from-[#4a0518] via-[#5c0a20] to-[#3a0312] px-4 py-4 text-white">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="Ritumbhara" className="h-8 w-auto" />
          <span className="text-sm font-semibold tracking-tight text-white/90">Online check-in</span>
        </div>
      </header>
      <main className="mx-auto max-w-xl px-4 py-5">
        {bad || !row ? (
          <div className="rounded-2xl border bg-card p-6 text-center shadow-sm">
            <h1 className="text-lg font-semibold">Link not available</h1>
            <p className="mt-2 text-sm text-muted-foreground">{bad}</p>
          </div>
        ) : (
          <CheckInForm
            token={token}
            guestName={row.reservation.guest.name}
            stay={`${row.reservation.unit.name}, ${row.reservation.unit.property.name}`}
            checkIn={row.reservation.checkIn.toISOString().slice(0, 10)}
            checkOut={row.reservation.checkOut.toISOString().slice(0, 10)}
            done={row.status !== "PENDING"}
            verified={row.status === "VERIFIED"}
          />
        )}
      </main>
    </div>
  )
}
