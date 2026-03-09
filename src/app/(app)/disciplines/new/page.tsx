import { redirect } from "next/navigation"
import { getAuthSession } from "@/lib/auth-helpers"
import { createDiscipline } from "@/lib/disciplines/actions"
import { DisciplineForm } from "@/components/app/disciplines/DisciplineForm"

export default async function NewDisciplinePage() {
  const session = await getAuthSession()
  // Nur Admins dürfen Disziplinen anlegen
  if (session?.user.role !== "ADMIN") redirect("/disciplines")

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Neue Disziplin</h1>
      <DisciplineForm action={createDiscipline} />
    </div>
  )
}
