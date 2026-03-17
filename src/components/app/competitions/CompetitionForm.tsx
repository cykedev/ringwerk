"use client"

import { useActionState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { SerializableDiscipline } from "@/lib/disciplines/types"
import type { CompetitionDetail } from "@/lib/competitions/types"
import type { ActionResult } from "@/lib/types"

interface Props {
  competition?: CompetitionDetail
  disciplines: SerializableDiscipline[]
  action: (prevState: ActionResult | null, formData: FormData) => Promise<ActionResult>
}

function toDateInputValue(date: Date | null | undefined): string {
  if (!date) return ""
  return new Date(date).toISOString().slice(0, 10)
}

export function CompetitionForm({ competition, disciplines, action }: Props) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(action, null)
  const isEdit = !!competition

  useEffect(() => {
    if (state && "success" in state && state.success) {
      router.push("/competitions")
    }
  }, [state, router])

  const fieldErrors =
    state && "error" in state && typeof state.error === "object" ? state.error : null
  const generalError =
    state && "error" in state && typeof state.error === "string" ? state.error : null

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          defaultValue={competition?.name ?? ""}
          placeholder="z.B. Winterliga 2026"
          disabled={isPending}
        />
        {fieldErrors?.name && <p className="text-sm text-destructive">{fieldErrors.name[0]}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="disciplineId">Disziplin</Label>
        <Select
          name="disciplineId"
          defaultValue={competition?.disciplineId ?? ""}
          disabled={isPending || isEdit}
        >
          <SelectTrigger id="disciplineId">
            <SelectValue placeholder="Disziplin wählen…" />
          </SelectTrigger>
          <SelectContent>
            {disciplines.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isEdit && (
          <p className="text-xs text-muted-foreground">
            Die Disziplin kann nach der Erstellung nicht mehr geändert werden.
          </p>
        )}
        {fieldErrors?.disciplineId && (
          <p className="text-sm text-destructive">{fieldErrors.disciplineId[0]}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="hinrundeDeadline">Hinrunde-Stichtag (optional)</Label>
        <Input
          id="hinrundeDeadline"
          name="hinrundeDeadline"
          type="date"
          defaultValue={toDateInputValue(competition?.hinrundeDeadline)}
          disabled={isPending}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="rueckrundeDeadline">Rückrunde-Stichtag (optional)</Label>
        <Input
          id="rueckrundeDeadline"
          name="rueckrundeDeadline"
          type="date"
          defaultValue={toDateInputValue(competition?.rueckrundeDeadline)}
          disabled={isPending}
        />
      </div>

      {generalError && <p className="text-sm text-destructive">{generalError}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Speichern…" : "Speichern"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={isPending}>
          Abbrechen
        </Button>
      </div>
    </form>
  )
}
