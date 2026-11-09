import { prisma } from "@/lib/prisma"
import { requireAdminPage } from "@/lib/auth/guard"
import { CheckInsClient, type CheckInRow } from "@/components/checkin/checkins-client"

export const dynamic = "force-dynamic"

const daysFromNow = (n: number) => new Date(Date.now() + n * 86400_000)

export default async function CheckInsPage() {
  await requireAdminPage("/checkins")
  const from = daysFromNow(-2)
  const to = daysFromNow(21)
  const reservations = await prisma.reservation.findMany({
    where: { OR: [{ checkIn: { gte: from, lte: to } }, { status: "CHECKED_IN" }, { checkIn: { lt: from }, checkOut: { gte: from } }] },
    include: { guest: true, unit: true, checkIn: true, visitors: { orderBy: { inAt: "desc" }, take: 20 } },
    orderBy: { checkIn: "asc" },
    take: 300,
  })
  const rows: CheckInRow[] = reservations.map((r) => ({
    id: r.id,
    guest: r.guest.name,
    phone: r.guest.phone,
    unit: r.unit.name,
    checkIn: r.checkIn.toISOString().slice(0, 10),
    checkOut: r.checkOut.toISOString().slice(0, 10),
    status: r.status,
    cin: r.checkIn
      ? { status: r.checkIn.status, code: r.checkIn.guestCode, foreign: r.checkIn.isForeign, submittedAt: r.checkIn.submittedAt?.toISOString() ?? null }
      : null,
    visitors: r.visitors.map((v) => ({ id: v.id, name: v.visitorName, inAt: v.inAt.toISOString(), outAt: v.outAt?.toISOString() ?? null })),
  }))
  return <CheckInsClient rows={rows} />
}
