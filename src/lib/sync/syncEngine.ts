import { prisma } from '../db/prisma'
import { decrypt } from '../encryption'
import { getErpNextClient } from '../erpnext/client'
import { ganttRowsFromBacklogs } from '../erpnext/transformers'
import { persistErpSprints } from '../frappe/persistSprint'
import { SprintKickoffClient } from '../sprint-kickoff/client'
import { transformSKTask } from '../sprint-kickoff/transformers'
import { packTaskMeta } from '../tasks/meta'
import { sendTaskAssigned, sendTaskCompleted } from '../email/resend'
import type { SyncResult } from '../types'

export async function runSync(): Promise<SyncResult> {
  const start = Date.now()
  let tasksAdded = 0
  let tasksUpdated = 0
  let errors = 0

  const settings = await prisma.settings.findFirst()
  const teamEmails = (await prisma.teamMember.findMany({ where: { isActive: true } }))
    .map(m => m.email)

  // ── ERPNext sync ─────────────────────────────────────────────────────────
  if (settings?.erpnextApiKey && settings.erpnextApiSecret) {
    try {
      const client = getErpNextClient(settings)
      if (!client) throw new Error('ERPNext API keys are missing')

      const remoteSprints = await client.fetchSprints()
      const boards = await persistErpSprints(remoteSprints)
      const chartBySprint = new Map(boards.flatMap(board => [
        [board.externalId, board.chartId],
        [board.name, board.chartId],
      ]))
      const sprintIds = remoteSprints.map(s => s.id)
      const backlogs = await client.fetchSprintBacklogs(sprintIds)  // always by id: dept sprints may not match the CORE name pattern
      const tree = await client.resolveBacklogTree(backlogs)
      const rawTasks = ganttRowsFromBacklogs(backlogs, tree)

      for (const task of rawTasks) {
        const existing = await prisma.task.findUnique({ where: { externalId: task.externalId } })
        const description = packTaskMeta(task.description, {
          priority: task.priority,
          workType: task.workType,
          sprintPoints: task.sprintPoints,
          module: task.module,
          assigneeName: task.assigneeName,
          qaAssignee: task.qaAssignee,
          dateAssigned: task.dateAssigned,
          dependencies: task.dependencies,
          parentBacklogId: task.parentBacklogId,
          parentBacklogName: task.parentBacklogName,
        })
        const chartId = chartBySprint.get(task.sprintId ?? '')
          ?? chartBySprint.get(task.sprintName ?? '')
          ?? null

        await prisma.task.upsert({
          where: { externalId: task.externalId },
          create: {
            externalId: task.externalId, source: 'erpnext',
            title: task.name, description,
            assigneeEmail: task.assigneeEmail, status: task.status,
            progress: task.progress, startDate: task.start ? new Date(task.start) : null,
            endDate: task.end ? new Date(task.end) : null,
            projectName: task.projectName, sprintName: task.sprintName, sprintId: task.sprintId,
            chartId,
            isOverdue: task.status === 'Overdue',
          },
          update: {
            title: task.name, status: task.status, progress: task.progress,
            startDate: task.start ? new Date(task.start) : null,
            endDate: task.end ? new Date(task.end) : null,
            assigneeEmail: task.assigneeEmail,
            description,
            projectName: task.projectName,
            sprintName: task.sprintName, sprintId: task.sprintId,
            chartId,
            isOverdue: task.status === 'Overdue',
          },
        })

        if (!existing) {
          tasksAdded++
          if (task.assigneeEmail && teamEmails.includes(task.assigneeEmail)) {
            await sendTaskAssigned({ task, recipientEmail: task.assigneeEmail }).catch(() => {})
          }
        } else {
          if (existing.status !== 'Completed' && task.status === 'Completed') {
            for (const email of teamEmails) {
              await sendTaskCompleted({ task, recipientEmail: email }).catch(() => {})
            }
          }
          tasksUpdated++
        }
      }

      await prisma.syncLog.create({
        data: { source: 'erpnext', tasksAdded, tasksUpdated, errors, durationMs: Date.now() - start },
      })
    } catch (e) {
      errors++
      console.error('ERPNext sync error:', e)
    }
  }

  // ── Sprint Kickoff sync ───────────────────────────────────────────────────
  if (settings?.sprintKickoffUrl && settings.sprintKickoffApiKey && settings.sprintKickoffApiSecret) {
    try {
      const client = new SprintKickoffClient({
        baseUrl: settings.sprintKickoffUrl,
        apiKey: decrypt(settings.sprintKickoffApiKey),
        apiSecret: decrypt(settings.sprintKickoffApiSecret),
      })
      const sprints = await client.fetchSprints()

      for (const sprint of sprints) {
        await prisma.sprint.upsert({
          where: { externalId: sprint.id },
          create: {
            externalId: sprint.id, name: sprint.name, status: sprint.status,
            startDate: new Date(sprint.start_date), endDate: new Date(sprint.end_date),
          },
          update: {
            name: sprint.name,
            status: sprint.status,
            startDate: new Date(sprint.start_date),
            endDate: new Date(sprint.end_date),
          },
        })

        const tasks = await client.fetchTasks(sprint.id)
        for (const raw of tasks) {
          const task = transformSKTask(raw)
          const existing = await prisma.task.findUnique({ where: { externalId: task.externalId } })

          await prisma.task.upsert({
            where: { externalId: task.externalId },
            create: {
              externalId: task.externalId, source: 'sprint_kickoff',
              title: task.name, description: task.description,
              assigneeEmail: task.assigneeEmail, status: task.status,
              progress: task.progress, startDate: task.start ? new Date(task.start) : null,
              endDate: task.end ? new Date(task.end) : null,
              projectName: task.projectName, sprintName: task.sprintName, sprintId: task.sprintId,
              isOverdue: task.status === 'Overdue',
            },
            update: {
              title: task.name, status: task.status, progress: task.progress,
              startDate: task.start ? new Date(task.start) : null,
              endDate: task.end ? new Date(task.end) : null,
              isOverdue: task.status === 'Overdue',
            },
          })

          if (!existing) {
            tasksAdded++
            if (task.assigneeEmail && teamEmails.includes(task.assigneeEmail)) {
              await sendTaskAssigned({ task, recipientEmail: task.assigneeEmail }).catch(() => {})
            }
          } else {
            if (existing.status !== 'Completed' && task.status === 'Completed') {
              for (const email of teamEmails) {
                await sendTaskCompleted({ task, recipientEmail: email }).catch(() => {})
              }
            }
            tasksUpdated++
          }
        }
      }
    } catch (e) {
      errors++
      console.error('Sprint Kickoff sync error:', e)
    }
  }

  return { tasksAdded, tasksUpdated, durationMs: Date.now() - start, errors }
}
