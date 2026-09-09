import { NextRequest, NextResponse } from 'next/server'
import { runSync } from '@/lib/sync/syncEngine'
import { prisma } from '@/lib/db/prisma'
import { sendOverdueAlert } from '@/lib/email/resend'

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const syncResult = await runSync()

  // Check overdue tasks and notify
  const overdueTasks = await prisma.task.findMany({
    where: { isOverdue: true, status: { not: 'Completed' } },
  })
  const teamMembers = await prisma.teamMember.findMany({ where: { isActive: true } })
  let notificationsSent = 0

  for (const task of overdueTasks) {
    const recipients = task.assigneeEmail
      ? teamMembers.filter(m => m.email === task.assigneeEmail || m.role === 'Lead')
      : teamMembers.filter(m => m.role === 'Lead')

    for (const member of recipients) {
      await sendOverdueAlert({
        task: { id: task.id, name: task.title, end: task.endDate?.toISOString().slice(0,10) ?? '', sprintName: task.sprintName },
        recipientEmail: member.email,
      })
      notificationsSent++
    }
  }

  return NextResponse.json({ ok: true, ...syncResult, notificationsSent })
}
