"use client"

import { useActionState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { ParticipantDetail } from "@/lib/participants/types"
import type { ActionResult } from "@/lib/types"

interface Props {
  participant?: Pick<ParticipantDetail, "firstName" | "lastName" | "contact">
  action: (prevState: ActionResult | null, formData: FormData) => Promise<ActionResult>
  onSuccess?: () => void
}

export function ParticipantForm({ participant, action, onSuccess }: Props) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(action, null)

  useEffect(() => {
    if (state && "success" in state && state.success) {
      if (onSuccess) onSuccess()
      else router.push("/participants")
    }
  }, [state, router, onSuccess])

  const fieldErrors =
    state && "error" in state && typeof state.error === "object" ? state.error : null
  const generalError =
    state && "error" in state && typeof state.error === "string" ? state.error : null

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="firstName">Vorname</Label>
        <Input
          id="firstName"
          name="firstName"
          defaultValue={participant?.firstName ?? ""}
          placeholder="z.B. Max"
          disabled={isPending}
        />
        {fieldErrors?.firstName && (
          <p className="text-sm text-destructive">{fieldErrors.firstName[0]}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="lastName">Nachname</Label>
        <Input
          id="lastName"
          name="lastName"
          defaultValue={participant?.lastName ?? ""}
          placeholder="z.B. Muster"
          disabled={isPending}
        />
        {fieldErrors?.lastName && (
          <p className="text-sm text-destructive">{fieldErrors.lastName[0]}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="contact">E-Mail / Telefon</Label>
        <Input
          id="contact"
          name="contact"
          type="text"
          defaultValue={participant?.contact ?? ""}
          placeholder="z.B. max@example.com oder +49 151 12345678"
          disabled={isPending}
        />
        {fieldErrors?.contact && (
          <p className="text-sm text-destructive">{fieldErrors.contact[0]}</p>
        )}
      </div>

      {generalError && <p className="text-sm text-destructive">{generalError}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Speichern…" : "Speichern"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => (onSuccess ? onSuccess() : router.back())}
          disabled={isPending}
        >
          Abbrechen
        </Button>
      </div>
    </form>
  )
}
