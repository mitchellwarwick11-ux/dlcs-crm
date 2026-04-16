import { redirect } from 'next/navigation'

// Quotes are now managed globally at /quotes/[quoteId]
export default async function OldQuoteDetailRedirect({
  params,
}: {
  params: Promise<{ jobNumber: string; quoteId: string }>
}) {
  const { quoteId } = await params
  redirect(`/quotes/${quoteId}`)
}
