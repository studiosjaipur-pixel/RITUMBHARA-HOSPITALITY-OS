// Admin-only CSV exports: ?type=register (guest register) or ?type=formc (foreign guests), optional ?from=&to= (YYYY-MM-DD, by check-in date).
import { NextResponse } from "next/server"
import { adminApiGuard } from "@/lib/auth/guard"
import { prisma } from "@/lib/prisma"
import { day, toCsv } from "@/lib/checkin/server"

type FormC = Record<string, string | undefined>

export async function GET(request: Request) {
  const denied = await adminApiGuard()
  if (denied) return denied
  const url = new URL(request.url)
  const type = url.searchParams.get("type") === "formc" ? "formc" : "register"
  const parse = (k: string) => {
    const v = url.searchParams.get(k)
    return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(v + "T00:00:00.000Z") : undefined
  }
  const from = parse("from")
  const to = parse("to")

  const rows = await prisma.checkIn.findMany({
    where: {
      status: { in: ["SUBMITTED", "VERIFIED"] },
      ...(type === "formc" ? { isForeign: true } : {}),
      reservation: { checkIn: { ...(from ? { gte: from } : {}), ...(to ? { lt: new Date(to.getTime() + 86400_000) } : {}) } },
    },
    include: { reservation: { include: { unit: { include: { property: true } } } } },
    orderBy: { reservation: { checkIn: "asc" } },
    take: 5000,
  })

  const csv =
    type === "formc"
      ? toCsv(
          ["Name", "Date of birth", "Gender", "Nationality", "Passport no", "Passport issued at", "Passport issue date", "Passport expiry",
           "Visa no", "Visa type", "Visa issue date", "Visa expiry", "Arrived from", "Date of arrival in India", "Next destination",
           "Purpose", "Address in India", "Check-in", "Check-out"],
          rows.map((r) => {
            const f = (r.formC ?? {}) as FormC
            const p = r.reservation.unit.property
            return [r.fullName, r.dateOfBirth, r.gender, r.nationality, r.idNumber, f.passportIssuePlace, f.passportIssueDate, f.passportExpiry,
              f.visaNumber, f.visaType, f.visaIssueDate, f.visaExpiry, f.arrivedFrom, f.arrivalInIndia, f.nextDestination,
              r.purpose, `${r.reservation.unit.name}, ${p.address}, ${p.city}`, day(r.reservation.checkIn), day(r.reservation.checkOut)]
          }),
        )
      : toCsv(
          ["Name", "Date of birth", "Gender", "Nationality", "ID type", "ID number", "Address", "Purpose", "Other guests", "Property", "Unit",
           "Check-in", "Check-out", "Status", "Submitted at"],
          rows.map((r) => [r.fullName, r.dateOfBirth, r.gender, r.nationality, r.idType, r.idNumber, r.address, r.purpose, r.companions,
            r.reservation.unit.property.name, r.reservation.unit.name, day(r.reservation.checkIn), day(r.reservation.checkOut), r.status,
            r.submittedAt?.toISOString() ?? ""]),
        )

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${type === "formc" ? "form-c" : "guest-register"}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  })
}
