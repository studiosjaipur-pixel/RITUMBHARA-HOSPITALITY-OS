import test from "node:test"
import assert from "node:assert/strict"
import { isPublicPath } from "../lib/auth/policy"
import { csvCell, hashCheckInToken, isWellFormedCheckInToken, maskIdNumber, newCheckInToken, newGuestCode, submissionSchema, toCsv, tooManySubmits } from "../lib/checkin/server"

const base = { fullName: "Asha Rao", dateOfBirth: "1990-04-02", gender: "FEMALE", nationality: "Indian", idType: "AADHAAR", idNumber: "1234 5678 9012", address: "12 MG Road, Pune" }

test("tokens are well formed and hashed", () => {
  const t = newCheckInToken()
  assert.ok(isWellFormedCheckInToken(t.token))
  assert.equal(hashCheckInToken(t.token), t.tokenHash)
  assert.notEqual(t.tokenHash, t.token)
  assert.match(newGuestCode(), /^[A-HJ-NP-Z2-9]{6}$/)
})

test("Aadhaar is masked to the last 4 digits; other IDs are kept", () => {
  assert.equal(maskIdNumber("AADHAAR", "1234 5678 9012"), "XXXX XXXX 9012")
  assert.equal(maskIdNumber("PASSPORT", " P1234567 "), "P1234567")
})

test("Indian guests need no Form C; foreign guests need passport and Form C fields", () => {
  assert.equal(submissionSchema.safeParse(base).success, true)
  assert.equal(submissionSchema.safeParse({ ...base, nationality: "French" }).success, false)
  const f = { ...base, nationality: "French", idType: "PASSPORT", idNumber: "P1234567", formC: { passportExpiry: "2030-01-01", visaNumber: "V1", arrivedFrom: "Paris", arrivalInIndia: "2026-11-01" } }
  assert.equal(submissionSchema.safeParse(f).success, true)
})

test("CSV blocks formula injection and quotes commas", () => {
  assert.equal(csvCell("=SUM(A1)"), "'=SUM(A1)")
  assert.equal(csvCell('a,"b"'), '"a,""b"""')
  assert.ok(toCsv(["A"], [["x"]]).includes("A\r\nx"))
})

test("check-in routes are public but the export is not; submit is rate limited", () => {
  assert.equal(isPublicPath("/checkin/abc"), true)
  assert.equal(isPublicPath("/api/checkin/abc"), true)
  assert.equal(isPublicPath("/api/checkin/export"), false)
  assert.equal(isPublicPath("/checkins"), false)
  const k = "t" + Math.random()
  let blocked = false
  for (let i = 0; i < 12; i++) blocked = tooManySubmits(k)
  assert.equal(blocked, true)
})
