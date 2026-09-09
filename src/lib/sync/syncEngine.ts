import { prisma } from '../db/prisma'
import { decrypt } from '../encryption'
import { ErpNextClient } from '../erpnext/client'
import { transformErpTask } from '../erpnext/transformers'
import { SprintKickoffClient } from '../sprint-kickoff/client'
import { transformSKTask } from '../sprint-kickoff/transformers'
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
  if (settings?.erpnextBaseUrl && settings.erpnextApiKey && settings.erpnextApiSecret) {
    try {
      const client = new ErpNextClient({
        baseUrl: settings.erpnextBaseUrl,
        apiKey: decrypt(settings.erpnextApiKey),
        apiSecret: decrypt(settings.erpnextApiSecret),
      })
      const rawTasks = await client.fetchTasks()

      for (const raw of rawTasks) {
        const task = transformErpTask(raw)
        const existing = await prisma.task.findUnique({ where: { externalId: task.externalId } })

        await prisma.task.upsert({
          where: { externalId: task.externalId },
          create: {
            externalId: task.externalId, source: 'erpnext',
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

      await prisma.syncLog.create({
        data: { source: 'erpnext', tasksAdded, tasksUpdated, errors, durationMs: Date.now() - start },
      })
    } catch (e) {
      errors++
      console.error('ERPNext sync error:', e)
    }
  }

  // ── Sprint Kickoff sync ───────────────────────────────────────────────────
  if (settings?.sprintKickoffUrl && settings.sprintKickoffToken) {
    try {
      const client = new SprintKickoffClient({
        baseUrl: settings.sprintKickoffUrl,
        apiToken: decrypt(settings.sprintKickoffToken),
      })
      const sprints = await client.fetchSprints()

      for (const sprint of sprints) {
        await prisma.sprint.upsert({
          where: { externalId: sprint.id },
          create: {
            externalId: sprint.id, name: sprint.name, status: sprint.status,
            startDate: new Date(sprint.start_date), endDate: new Date(sprint.end_date),
          },
          update: { name: sprint.name, status: sprint.status },
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
