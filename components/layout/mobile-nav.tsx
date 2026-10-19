"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Sidebar } from "./sidebar"

// Slide-out navigation for phones and tablets. Closes itself once a page is picked.
export function MobileNav() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button size="icon" variant="ghost" className="lg:hidden -ml-2 hover:bg-accent" />}>
        <Menu className="h-5 w-5" />
        <span className="sr-only">Open menu</span>
      </SheetTrigger>
      <SheetContent side="left" showCloseButton={false} className="data-[side=left]:w-64 max-w-[85vw] gap-0 p-0 border-0 bg-transparent">
        <SheetTitle className="sr-only">Menu</SheetTitle>
        <SheetDescription className="sr-only">Navigation menu</SheetDescription>
        <Sidebar />
      </SheetContent>
    </Sheet>
  )
}
