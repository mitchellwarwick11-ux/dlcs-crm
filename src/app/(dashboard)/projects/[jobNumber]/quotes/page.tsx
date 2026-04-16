import { redirect } from 'next/navigation'

// The Quotes section has moved into the Invoicing tab.
export default async function ProjectQuotesRedirect({
  params,
}: {
  params: Promise<{ jobNumber: string }>
}) {
  const { jobNumber } = await params
  redirect(`/projects/${jobNumber}/invoices`)
}
