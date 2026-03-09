import { notFound, redirect } from "next/navigation"
import { getAuthSession } from "@/lib/auth-helpers"
import { getDisciplines } from "@/lib/disciplines/queries"
import { getLeagueById } from "@/lib/leagues/queries"
import { updateLeague } from "@/lib/leagues/actions"
import { LeagueForm } from "@/components/app/leagues/LeagueForm"
import type { ActionResult } from "@/lib/types"

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditLeaguePage({ params }: Props) {
  const { id } = await params

  const [session, league, disciplines] = await Promise.all([
    getAuthSession(),
    getLeagueById(id),
    getDisciplines(),
  ])

  if (session?.user.role !== "ADMIN") redirect("/")
  if (!league) notFound()

  const action = async (prevState: ActionResult | null, formData: FormData) => {
    "use server"
    return updateLeague(id, prevState, formData)
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Liga bearbeiten</h1>
      <LeagueForm league={league} disciplines={disciplines} action={action} />
    </div>
  )
}
