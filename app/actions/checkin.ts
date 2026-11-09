"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/auth/guard"
import { prisma } from "@/lib/prisma"
import { normalizePhoneNumber } from "@/lib/utils/phone"
import { sendWhatsAppMessage } from "@/lib/whatsapp/client"
import { publicBaseUrl } from "@/lib/long-stay/server"
import { CHECKIN_TTL_DAYS, checkInUrl, newCheckInToken } from "@/lib/checkin/server"

// Creates (or re-issues) the private check-in link for a reservation. A new link replaces the old one.
export async function createCheckInLink(reservationId: string) {
  await requireAdmin()
  const reservation = await prisma.reservation.findUnique({ where: { id: reservationId }, include: { checkIn: true } })
  if (!reservation) return { ok: false as const, error: "Reservation not found." }
  const { token, tokenHash } = newCheckInToken()
  const expiresAt = new Date(Date.now() + CHECKIN_TTL_DAYS * 86400_000)
  if (reservation.checkIn) {
    await prisma.checkIn.update({ where: { id: reservation.checkIn.id }, data: { tokenHash, expiresAt } })
  } else {
    await prisma.checkIn.create({ data: { reservationId, tokenHash, expiresAt } })
  }
  const h = await headers()
  revalidatePath("/checkins")
  return { ok: true as const, url: checkInUrl(publicBaseUrl(h.get("host"), h.get("x-forwarded-proto")), token) }
}

// Sends the link on WhatsApp as plain text. WhatsApp only delivers this inside the 24-hour customer-service window;
// outside it, use "Copy link" and send it yourself (a business-started message needs an approved template).
export async function sendCheckInLink(reservationId: string) {
  await requireAdmin()
  const link = await createCheckInLink(reservationId)
  if (!link.ok) return link
  const r = await prisma.reservation.findUnique({ where: { id: reservationId }, include: { guest: true } })
  if (!r?.guest.phone) return { ok: false as const, error: "Guest has no phone number." }
  const body = `Hi ${r.guest.name}, please complete your online check-in before you arrive: ${link.url}`
  const sent = await sendWhatsAppMessage(normalizePhoneNumber(r.guest.phone), "text", body, undefined, "Reservation", reservationId)
  return { ok: sent.success, url: link.url, error: sent.success ? undefined : "WhatsApp send failed. Copy the link and send it manually." }
}

export async function verifyCheckIn(reservationId: string) {
  const session = await requireAdmin()
  const row = await prisma.checkIn.findUnique({ where: { reservationId } })
  if (!row || row.status === "PENDING") return { ok: false as const, error: "Guest has not submitted details yet." }
  await prisma.checkIn.update({
    where: { id: row.id },
    data: { status: "VERIFIED", verifiedAt: new Date(), verifiedBy: String((session as { sub?: string }).sub ?? "admin") },
  })
  revalidatePath("/checkins")
  return { ok: true as const }
}

export async function addVisitor(reservationId: string, formData: FormData) {
  const session = await requireAdmin()
  const visitorName = String(formData.get("visitorName") || "").trim().slice(0, 120)
  if (visitorName.length < 2) return { ok: false as const, error: "Enter the visitor's name." }
  await prisma.visitorLog.create({
    data: {
      reservationId,
      visitorName,
      visitorPhone: String(formData.get("visitorPhone") || "").trim().slice(0, 20) || null,
      idNote: String(formData.get("idNote") || "").trim().slice(0, 80) || null,
      purpose: String(formData.get("purpose") || "").trim().slice(0, 120) || null,
      loggedBy: String((session as { sub?: string }).sub ?? "admin"),
    },
  })
  revalidatePath("/checkins")
  return { ok: true as const }
}

export async function visitorOut(id: string) {
  await requireAdmin()
  await prisma.visitorLog.updateMany({ where: { id, outAt: null }, data: { outAt: new Date() } })
  revalidatePath("/checkins")
  return { ok: true as const }
}
