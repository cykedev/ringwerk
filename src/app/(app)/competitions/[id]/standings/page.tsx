import { redirect } from "next/navigation"

interface Props {
  params: Promise<{ id: string }>
}

export default async function CompetitionStandingsPage({ params }: Props) {
  const { id } = await params
  redirect(`/competitions/${id}/schedule`)
}
