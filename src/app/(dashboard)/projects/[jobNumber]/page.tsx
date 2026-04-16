import { redirect } from 'next/navigation'

export default async function ProjectRoot({ params }: { params: Promise<{ jobNumber: string }> }) {
  const { jobNumber } = await params
  redirect(`/projects/${jobNumber}/details`)
}
