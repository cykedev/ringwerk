import { redirect } from "next/navigation"

interface Props {
  params: Promise<{ id: string }>
}

export default async function LeagueStandingsPage({ params }: Props) {
  const { id } = await params
  redirect(`/leagues/${id}/schedule`)
}
