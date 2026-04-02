import { redirect } from "next/navigation"
import { getAuthSession, canManage } from "@/lib/auth-helpers"
import { createDiscipline } from "@/lib/disciplines/actions"
import { DisciplineForm } from "@/components/app/disciplines/DisciplineForm"

export default async function NewDisciplinePage() {
  const session = await getAuthSession()
  if (!session || !canManage(session.user.role)) redirect("/")

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Neue Disziplin</h1>
      <DisciplineForm action={createDiscipline} />
    </div>
  )
}
