// Public: a guest submits their check-in details for one reservation (link token is the only credential).
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  hashCheckInToken, isForeignNationality, isWellFormedCheckInToken, maskIdNumber, submissionSchema, tooManySubmits,
} from "@/lib/checkin/server"

const headers = { "Cache-Control": "no-store" }

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!isWellFormedCheckInToken(token)) return NextResponse.json({ ok: false, error: "Link not valid." }, { status: 404, headers })
  if (tooManySubmits(token)) return NextResponse.json({ ok: false, error: "Too many attempts. Please try again later." }, { status: 429, headers })

  const body = await request.json().catch(() => null)
  const parsed = submissionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || "Please check the form." }, { status: 400, headers })
  }

  const row = await prisma.checkIn.findUnique({ where: { tokenHash: hashCheckInToken(token) } })
  if (!row) return NextResponse.json({ ok: false, error: "Link not valid." }, { status: 404, headers })
  if (row.expiresAt < new Date()) return NextResponse.json({ ok: false, error: "This link has expired. Please ask the property for a new one." }, { status: 410, headers })
  if (row.status === "VERIFIED") return NextResponse.json({ ok: false, error: "Your check-in is already verified." }, { status: 409, headers })

  const v = parsed.data
  const foreign = isForeignNationality(v.nationality)
  const idNumber = maskIdNumber(v.idType, v.idNumber)
  await prisma.$transaction([
    prisma.checkIn.update({
      where: { id: row.id },
      data: {
        status: "SUBMITTED", submittedAt: new Date(), fullName: v.fullName, dateOfBirth: v.dateOfBirth, gender: v.gender,
        nationality: v.nationality, isForeign: foreign, idType: v.idType, idNumber, address: v.address,
        purpose: v.purpose ?? null, companions: v.companions, formC: foreign ? (v.formC ?? {}) : undefined,
      },
    }),
    prisma.guest.updateMany({
      where: { reservations: { some: { id: row.reservationId } } },
      data: { idType: v.idType, idNumber },
    }),
  ])
  return NextResponse.json({ ok: true }, { headers })
}
