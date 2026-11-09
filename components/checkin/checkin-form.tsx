"use client"

import { useState } from "react"

const inp = "mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
const lbl = "block text-xs font-medium text-muted-foreground"

interface Props { token: string; guestName: string; stay: string; checkIn: string; checkOut: string; doneCode: string | null; verified: boolean }

export function CheckInForm({ token, guestName, stay, checkIn, checkOut, doneCode, verified }: Props) {
  const [code, setCode] = useState<string | null>(doneCode)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [nationality, setNationality] = useState("Indian")
  const foreign = !["indian", "india", "in"].includes(nationality.trim().toLowerCase())

  if (code) {
    return (
      <div className="rounded-2xl border bg-card p-6 text-center shadow-sm">
        <h1 className="text-lg font-semibold">{verified ? "You're checked in" : "Check-in details received"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Show this code to our team on arrival.</p>
        <p className="my-4 font-mono text-4xl font-bold tracking-[0.3em]">{code}</p>
        <p className="text-xs text-muted-foreground">{stay} · {checkIn} to {checkOut}</p>
      </div>
    )
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setError("")
    const f = Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string, string>
    const payload = {
      fullName: f.fullName, dateOfBirth: f.dateOfBirth, gender: f.gender, nationality: f.nationality,
      idType: foreign ? "PASSPORT" : f.idType, idNumber: f.idNumber, address: f.address, purpose: f.purpose,
      companions: f.companions || 0,
      formC: foreign
        ? {
            passportIssuePlace: f.passportIssuePlace, passportIssueDate: f.passportIssueDate || undefined, passportExpiry: f.passportExpiry || undefined,
            visaNumber: f.visaNumber, visaType: f.visaType, visaIssueDate: f.visaIssueDate || undefined, visaExpiry: f.visaExpiry || undefined,
            arrivedFrom: f.arrivedFrom, arrivalInIndia: f.arrivalInIndia || undefined, nextDestination: f.nextDestination,
          }
        : undefined,
    }
    try {
      const res = await fetch(`/api/checkin/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (data.ok) setCode(data.guestCode)
      else setError(data.error || "Something went wrong.")
    } catch {
      setError("Network error. Please try again.")
    }
    setBusy(false)
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
      <div>
        <h1 className="text-lg font-semibold">Hi {guestName}, check in before you arrive</h1>
        <p className="mt-1 text-sm text-muted-foreground">{stay} · {checkIn} to {checkOut}</p>
      </div>
      <label className={lbl}>Full name (as on ID)<input name="fullName" required defaultValue={guestName} className={inp} /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className={lbl}>Date of birth<input name="dateOfBirth" type="date" required className={inp} /></label>
        <label className={lbl}>Gender
          <select name="gender" required className={inp}><option value="MALE">Male</option><option value="FEMALE">Female</option><option value="OTHER">Other</option></select>
        </label>
      </div>
      <label className={lbl}>Nationality<input name="nationality" required value={nationality} onChange={(e) => setNationality(e.target.value)} className={inp} /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className={lbl}>ID type
          {foreign ? <input readOnly value="Passport" className={inp} /> : (
            <select name="idType" className={inp}><option value="AADHAAR">Aadhaar</option><option value="DRIVING_LICENCE">Driving licence</option><option value="VOTER_ID">Voter ID</option><option value="PASSPORT">Passport</option></select>
          )}
        </label>
        <label className={lbl}>{foreign ? "Passport number" : "ID number"}<input name="idNumber" required className={inp} /></label>
      </div>
      {!foreign && <p className="-mt-2 text-[11px] text-muted-foreground">For Aadhaar we keep only the last 4 digits.</p>}
      <label className={lbl}>Home address<textarea name="address" required rows={2} className={inp} /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className={lbl}>Purpose of visit<input name="purpose" placeholder="Leisure, business…" className={inp} /></label>
        <label className={lbl}>Other guests with you<input name="companions" type="number" min={0} max={20} defaultValue={0} className={inp} /></label>
      </div>
      {foreign && (
        <fieldset className="space-y-3 rounded-xl border p-3">
          <legend className="px-1 text-xs font-semibold">Foreign guest details (Form C)</legend>
          <div className="grid grid-cols-2 gap-3">
            <label className={lbl}>Passport issued at<input name="passportIssuePlace" className={inp} /></label>
            <label className={lbl}>Passport issue date<input name="passportIssueDate" type="date" className={inp} /></label>
            <label className={lbl}>Passport expiry<input name="passportExpiry" type="date" required className={inp} /></label>
            <label className={lbl}>Visa number<input name="visaNumber" required className={inp} /></label>
            <label className={lbl}>Visa type<input name="visaType" className={inp} /></label>
            <label className={lbl}>Visa issue date<input name="visaIssueDate" type="date" className={inp} /></label>
            <label className={lbl}>Visa expiry<input name="visaExpiry" type="date" className={inp} /></label>
            <label className={lbl}>Date of arrival in India<input name="arrivalInIndia" type="date" required className={inp} /></label>
            <label className={lbl}>Arrived from<input name="arrivedFrom" required className={inp} /></label>
            <label className={lbl}>Next destination<input name="nextDestination" className={inp} /></label>
          </div>
        </fieldset>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button disabled={busy} className="w-full rounded-lg bg-[#5c0a20] py-2.5 text-sm font-semibold text-white disabled:opacity-60">
        {busy ? "Submitting…" : "Submit check-in"}
      </button>
      <p className="text-center text-[11px] text-muted-foreground">Required by law for guest registration. Your details are shared only with the property.</p>
    </form>
  )
}
