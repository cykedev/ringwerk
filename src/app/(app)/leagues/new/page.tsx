import { redirect } from "next/navigation"
import { getAuthSession } from "@/lib/auth-helpers"
import { getDisciplines } from "@/lib/disciplines/queries"
import { createLeague } from "@/lib/leagues/actions"
import { LeagueForm } from "@/components/app/leagues/LeagueForm"

export default async function NewLeaguePage() {
  const [session, disciplines] = await Promise.all([getAuthSession(), getDisciplines()])
  if (session?.user.role !== "ADMIN") redirect("/")

  if (disciplines.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8">
        <h1 className="mb-4 text-2xl font-semibold">Neue Liga</h1>
        <p className="text-sm text-muted-foreground">
          Es sind keine Disziplinen vorhanden. Bitte zuerst eine Disziplin anlegen.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Neue Liga</h1>
      <LeagueForm action={createLeague} disciplines={disciplines} />
    </div>
  )
}
