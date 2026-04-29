export interface TaskPo {
  po_number: string
  amount: number | null
}

export async function fetchTaskPosForInvoice(
  db: any,
  projectId: string,
  invoiceTaskIds: string[],
): Promise<Map<string, TaskPo[]>> {
  const map = new Map<string, TaskPo[]>()
  if (invoiceTaskIds.length === 0) return map

  const { data } = await db
    .from('purchase_orders')
    .select('po_number, amount, purchase_order_tasks!inner ( task_id )')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  for (const po of (data ?? []) as any[]) {
    for (const link of (po.purchase_order_tasks ?? []) as any[]) {
      if (!invoiceTaskIds.includes(link.task_id)) continue
      const list = map.get(link.task_id) ?? []
      list.push({ po_number: po.po_number, amount: po.amount })
      map.set(link.task_id, list)
    }
  }
  return map
}

export function formatTaskPos(pos: TaskPo[]): string {
  return pos.map(p => p.po_number).join(', ')
}
