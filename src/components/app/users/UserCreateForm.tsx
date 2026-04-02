"use client"

import { useActionState, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff } from "lucide-react"
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
import { createUser } from "@/lib/users/actions"

export function UserCreateForm() {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(createUser, null)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    if (state && "success" in state && state.success) {
      router.push("/admin/users")
    }
  }, [state, router])

  const fieldErrors =
    state && "error" in state && typeof state.error === "object" ? state.error : null
  const generalError =
    state && "error" in state && typeof state.error === "string" ? state.error : null

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name (optional)</Label>
        <Input id="name" name="name" placeholder="Vor- und Nachname" disabled={isPending} />
        {fieldErrors?.name && <p className="text-sm text-destructive">{fieldErrors.name[0]}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">E-Mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="nutzer@beispiel.de"
          disabled={isPending}
        />
        {fieldErrors?.email && <p className="text-sm text-destructive">{fieldErrors.email[0]}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="tempPassword">Temporäres Passwort</Label>
        <div className="relative">
          <Input
            id="tempPassword"
            name="tempPassword"
            type={showPassword ? "text" : "password"}
            placeholder="Mind. 12 Zeichen"
            disabled={isPending}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {fieldErrors?.tempPassword && (
          <p className="text-sm text-destructive">{fieldErrors.tempPassword[0]}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="role">Rolle</Label>
        <Select name="role" defaultValue="USER" disabled={isPending}>
          <SelectTrigger id="role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="USER">Benutzer</SelectItem>
            <SelectItem value="MANAGER">Manager</SelectItem>
            <SelectItem value="ADMIN">Administrator</SelectItem>
          </SelectContent>
        </Select>
        {fieldErrors?.role && <p className="text-sm text-destructive">{fieldErrors.role[0]}</p>}
      </div>

      {generalError && <p className="text-sm text-destructive">{generalError}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Anlegen…" : "Nutzer anlegen"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={isPending}>
          Abbrechen
        </Button>
      </div>
    </form>
  )
}
