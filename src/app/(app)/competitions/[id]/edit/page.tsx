import { notFound, redirect } from "next/navigation"
import { getAuthSession } from "@/lib/auth-helpers"
import { getDisciplines } from "@/lib/disciplines/queries"
import { getCompetitionById } from "@/lib/competitions/queries"
import { updateCompetition } from "@/lib/competitions/actions"
import { CompetitionForm } from "@/components/app/competitions/CompetitionForm"
import { ForceDeleteCompetitionSection } from "@/components/app/competitions/ForceDeleteCompetitionSection"
import type { ActionResult } from "@/lib/types"

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditCompetitionPage({ params }: Props) {
  const { id } = await params

  const [session, competition, disciplines] = await Promise.all([
    getAuthSession(),
    getCompetitionById(id),
    getDisciplines(),
  ])

  if (session?.user.role !== "ADMIN") redirect("/")
  if (!competition) notFound()

  const hasMatchups = competition._count.matchups > 0

  const action = async (prevState: ActionResult | null, formData: FormData) => {
    "use server"
    return updateCompetition(id, prevState, formData)
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Wettbewerb bearbeiten</h1>
      <CompetitionForm
        competition={competition}
        disciplines={disciplines}
        action={action}
        hasMatchups={hasMatchups}
      />
      <div className="mt-12">
        <ForceDeleteCompetitionSection competitionId={id} competitionName={competition.name} />
      </div>
    </div>
  )
}
