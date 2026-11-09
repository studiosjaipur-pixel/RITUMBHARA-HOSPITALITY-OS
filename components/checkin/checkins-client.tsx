"use client"

import { useState, useTransition } from "react"
import { addVisitor, createCheckInLink, findByGuestCode, sendCheckInLink, verifyCheckIn, visitorOut } from "@/app/actions/checkin"

export interface CheckInRow {
  id: string; guest: string; phone: string; unit: string; checkIn: string; checkOut: string; status: string
  cin: { status: string; code: string; foreign: boolean; submittedAt: string | null } | null
  visitors: { id: string; name: string; inAt: string; outAt: string | null }[]
}

const badge: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800", SUBMITTED: "bg-blue-100 text-blue-800", VERIFIED: "bg-emerald-100 text-emerald-800",
}
const box = "rounded-lg border bg-background px-2 py-1 text-sm"
const btn = "rounded-lg border px-2.5 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"

export function CheckInsClient({ rows }: { rows: CheckInRow[] }) {
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState("")
  const [code, setCode] = useState("")
  const [lookup, setLookup] = useState("")
  const [open, setOpen] = useState<string | null>(null)
  const [filter, setFilter] = useState("ALL")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")

  const shown = rows.filter((r) => filter === "ALL" || (r.cin?.status ?? "NONE") === filter)
  const qs = `${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}`

  const copy = (url: string) => navigator.clipboard?.writeText(url).then(() => setMsg("Link copied."), () => setMsg(url))
  const act = (fn: () => Promise<{ ok: boolean; error?: string; url?: string }>, done?: string) =>
    start(async () => {
      const r = await fn()
      if (r.url && r.ok) copy(r.url)
      else setMsg(r.ok ? done ?? "Done." : r.error ?? "Failed.")
    })

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Digital check-in</h1>
          <p className="text-sm text-muted-foreground">Guests fill their ID details before arrival. Verify on arrival, then export the register or Form C.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={box} aria-label="From" />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={box} aria-label="To" />
          <a className={btn} href={`/api/checkin/export?type=register${qs}`}>Guest register CSV</a>
          <a className={btn} href={`/api/checkin/export?type=formc${qs}`}>Form C CSV</a>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
        <span className="text-sm font-medium">Guest code</span>
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={6} placeholder="ABC234" className={`${box} w-28 font-mono`} />
        <button className={btn} disabled={pending} onClick={() => start(async () => {
          const r = await findByGuestCode(code)
          setLookup(r.ok ? `${r.guest} · ${r.unit} · ${r.status}${r.idType ? ` · ${r.idType} ${r.idNumber ?? ""}` : ""}` : r.error)
        })}>Find</button>
        {lookup && <span className="text-sm">{lookup}</span>}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {["ALL", "NONE", "PENDING", "SUBMITTED", "VERIFIED"].map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`${btn} ${filter === f ? "bg-muted" : ""}`}>{f === "NONE" ? "NO LINK" : f}</button>
        ))}
        {msg && <span className="ml-2 self-center text-xs text-muted-foreground">{msg}</span>}
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr><th className="p-2">Guest</th><th className="p-2">Unit</th><th className="p-2">Stay</th><th className="p-2">Check-in</th><th className="p-2">Actions</th></tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <>
                <tr key={r.id} className="border-t align-top">
                  <td className="p-2"><div className="font-medium">{r.guest}</div><div className="text-xs text-muted-foreground">{r.phone}</div></td>
                  <td className="p-2">{r.unit}</td>
                  <td className="p-2 whitespace-nowrap">{r.checkIn} → {r.checkOut}<div className="text-xs text-muted-foreground">{r.status}</div></td>
                  <td className="p-2">
                    {r.cin ? (
                      <>
                        <span className={`rounded-full px-2 py-0.5 text-xs ${badge[r.cin.status]}`}>{r.cin.status}</span>
                        {r.cin.foreign && <span className="ml-1 text-xs">Form C</span>}
                        <div className="font-mono text-xs">{r.cin.code}</div>
                      </>
                    ) : <span className="text-xs text-muted-foreground">No link</span>}
                  </td>
                  <td className="p-2">
                    <div className="flex flex-wrap gap-1.5">
                      <button className={btn} disabled={pending} onClick={() => act(() => createCheckInLink(r.id))}>{r.cin ? "New link" : "Copy link"}</button>
                      <button className={btn} disabled={pending} onClick={() => act(() => sendCheckInLink(r.id), "Sent on WhatsApp.")}>WhatsApp</button>
                      {r.cin && r.cin.status === "SUBMITTED" && <button className={btn} disabled={pending} onClick={() => act(() => verifyCheckIn(r.id), "Verified.")}>Verify</button>}
                      <button className={btn} onClick={() => setOpen(open === r.id ? null : r.id)}>Visitors ({r.visitors.length})</button>
                    </div>
                  </td>
                </tr>
                {open === r.id && (
                  <tr key={r.id + "v"} className="border-t bg-muted/20">
                    <td colSpan={5} className="space-y-2 p-3">
                      <form className="flex flex-wrap gap-2" action={(fd) => act(() => addVisitor(r.id, fd), "Visitor logged.")}>
                        <input name="visitorName" required placeholder="Visitor name" className={box} />
                        <input name="visitorPhone" placeholder="Phone" className={box} />
                        <input name="idNote" placeholder="ID seen" className={box} />
                        <input name="purpose" placeholder="Purpose" className={box} />
                        <button className={btn} disabled={pending}>Log in</button>
                      </form>
                      {r.visitors.map((v) => (
                        <div key={v.id} className="flex items-center gap-3 text-xs">
                          <span className="font-medium">{v.name}</span>
                          <span>in {new Date(v.inAt).toLocaleString()}</span>
                          {v.outAt ? <span>out {new Date(v.outAt).toLocaleString()}</span> : <button className={btn} disabled={pending} onClick={() => act(() => visitorOut(v.id), "Marked out.")}>Mark out</button>}
                        </div>
                      ))}
                    </td>
                  </tr>
                )}
              </>
            ))}
            {!shown.length && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No reservations match.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
