import { redirect } from "next/navigation"
import { getAuthSession, canManage } from "@/lib/auth-helpers"
import { createParticipant } from "@/lib/participants/actions"
import { ParticipantForm } from "@/components/app/participants/ParticipantForm"

export default async function NewParticipantPage() {
  const session = await getAuthSession()
  if (!session || !canManage(session.user.role)) redirect("/")

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Neuer Teilnehmer</h1>
      <ParticipantForm action={createParticipant} />
    </div>
  )
}
