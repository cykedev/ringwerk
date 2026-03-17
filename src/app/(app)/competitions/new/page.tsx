import { redirect } from "next/navigation"
import { getAuthSession } from "@/lib/auth-helpers"
import { getDisciplines } from "@/lib/disciplines/queries"
import { createCompetition } from "@/lib/competitions/actions"
import { CompetitionForm } from "@/components/app/competitions/CompetitionForm"

export default async function NewCompetitionPage() {
  const [session, disciplines] = await Promise.all([getAuthSession(), getDisciplines()])
  if (session?.user.role !== "ADMIN") redirect("/")

  if (disciplines.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8">
        <h1 className="mb-4 text-2xl font-semibold">Neuer Wettbewerb</h1>
        <p className="text-sm text-muted-foreground">
          Es sind keine Disziplinen vorhanden. Bitte zuerst eine Disziplin anlegen.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Neuer Wettbewerb</h1>
      <CompetitionForm action={createCompetition} disciplines={disciplines} />
    </div>
  )
}
