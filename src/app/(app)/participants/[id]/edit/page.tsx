import { notFound, redirect } from "next/navigation"
import { getAuthSession, canManage } from "@/lib/auth-helpers"
import { getParticipantById } from "@/lib/participants/queries"
import { updateParticipant } from "@/lib/participants/actions"
import { ParticipantForm } from "@/components/app/participants/ParticipantForm"

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditParticipantPage({ params }: Props) {
  const session = await getAuthSession()
  if (!session || !canManage(session.user.role)) redirect("/")

  const { id } = await params
  const participant = await getParticipantById(id)
  if (!participant) notFound()

  const action = updateParticipant.bind(null, id)

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Teilnehmer bearbeiten</h1>
      <ParticipantForm participant={participant} action={action} />
    </div>
  )
}
