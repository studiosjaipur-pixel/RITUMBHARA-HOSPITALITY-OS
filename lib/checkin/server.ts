// Digital check-in helpers: link tokens, guest codes, validation, ID masking and CSV exports. SERVER-ONLY.
import { createHash, randomBytes, randomInt } from "node:crypto"
import { z } from "zod"

export const CHECKIN_TTL_DAYS = 30
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // no 0/O/1/I

export function newCheckInToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url")
  return { token, tokenHash: hashCheckInToken(token) }
}

export function hashCheckInToken(token: string): string {
  return createHash("sha256").update("checkin:" + token).digest("hex")
}

export function isWellFormedCheckInToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{40,50}$/.test(token ?? "")
}

export function newGuestCode(): string {
  let c = ""
  for (let i = 0; i < 6; i++) c += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]
  return c
}

export function checkInUrl(base: string, token: string): string {
  return `${base}/checkin/${token}`
}

// Aadhaar must never be stored in full: keep the last 4 digits. Other IDs are kept as typed.
export function maskIdNumber(idType: string, raw: string): string {
  const v = raw.trim()
  if (idType === "AADHAAR") {
    const d = v.replace(/\D/g, "")
    return d.length >= 4 ? "XXXX XXXX " + d.slice(-4) : "XXXX"
  }
  return v
}

export const ID_TYPES = ["AADHAAR", "PASSPORT", "DRIVING_LICENCE", "VOTER_ID", "OTHER"] as const

const text = (max: number) => z.string().trim().max(max)
const optional = (max: number) => text(max).optional().transform((v) => (v ? v : undefined))
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date")

export const submissionSchema = z
  .object({
    fullName: text(120).min(2, "Enter your full name"),
    dateOfBirth: isoDate,
    gender: z.enum(["MALE", "FEMALE", "OTHER"]),
    nationality: text(60).min(2, "Enter your nationality"),
    idType: z.enum(ID_TYPES),
    idNumber: text(40).min(4, "Enter your ID number"),
    address: text(400).min(5, "Enter your address"),
    purpose: optional(120),
    companions: z.coerce.number().int().min(0).max(20).default(0),
    formC: z
      .object({
        passportIssuePlace: optional(80),
        passportIssueDate: isoDate.optional(),
        passportExpiry: isoDate.optional(),
        visaNumber: optional(40),
        visaType: optional(40),
        visaIssueDate: isoDate.optional(),
        visaExpiry: isoDate.optional(),
        arrivedFrom: optional(80),
        arrivalInIndia: isoDate.optional(),
        nextDestination: optional(80),
      })
      .optional(),
  })
  .superRefine((v, ctx) => {
    if (isForeignNationality(v.nationality)) {
      const f = v.formC
      for (const k of ["passportExpiry", "visaNumber", "arrivedFrom", "arrivalInIndia"] as const) {
        if (!f?.[k]) ctx.addIssue({ code: "custom", path: ["formC", k], message: "Required for foreign guests" })
      }
      if (v.idType !== "PASSPORT") ctx.addIssue({ code: "custom", path: ["idType"], message: "Foreign guests must use a passport" })
    }
  })

export type CheckInSubmission = z.infer<typeof submissionSchema>

export function isForeignNationality(n: string): boolean {
  const v = n.trim().toLowerCase()
  return !(v === "indian" || v === "india" || v === "in")
}

// ---------- CSV ----------
export function csvCell(v: unknown): string {
  let s = v == null ? "" : String(v)
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s // stop spreadsheet formula injection
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n"
}

export const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "")

// Simple per-instance limiter for the public submit endpoint (same speed-bump approach as lib/auth/rate-limit).
const hits = new Map<string, { n: number; at: number }>()
export function tooManySubmits(key: string, now = Date.now(), max = 10, windowMs = 15 * 60 * 1000): boolean {
  const e = hits.get(key)
  if (!e || now - e.at > windowMs) {
    if (hits.size > 5000) hits.delete(hits.keys().next().value as string)
    hits.set(key, { n: 1, at: now })
    return false
  }
  e.n++
  return e.n > max
}
