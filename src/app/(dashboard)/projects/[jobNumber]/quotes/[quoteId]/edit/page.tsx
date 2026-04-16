import { redirect } from 'next/navigation'

// Quote editing is now handled globally at /quotes/[quoteId]/edit
export default async function OldQuoteEditRedirect({
  params,
}: {
  params: Promise<{ jobNumber: string; quoteId: string }>
}) {
  const { quoteId } = await params
  redirect(`/quotes/${quoteId}/edit`)
}
