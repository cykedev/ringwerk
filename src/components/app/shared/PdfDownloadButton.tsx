"use client"

import { useState } from "react"
import { FileDown } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Props {
  href: string
  label?: string
}

export function PdfDownloadButton({ href, label = "PDF exportieren" }: Props) {
  const [loading, setLoading] = useState(false)

  function handleClick() {
    setLoading(true)
    window.open(href, "_blank")
    setTimeout(() => setLoading(false), 2500)
  }

  return (
    <Button variant="outline" size="sm" onClick={handleClick} disabled={loading}>
      <FileDown className="mr-1 h-4 w-4" />
      {loading ? "Erstelle PDF…" : label}
    </Button>
  )
}
