import { prisma } from '../db/prisma'
import { getErpNextClient } from '../erpnext/client'
import { ganttRowsFromBacklogs } from '../erpnext/transformers'
import { packTaskMeta } from '../tasks/meta'
import { toSprintDocId, type MappedSprint } from './sprint'

function ymd(value: Date | string) {
  if (typeof value === 'string') return value.slice(0, 10)
  return value.toISOString().slice(0, 10)
}

export function boardsFromErpSprints(
  remote: MappedSprint[],
  charts: Array<{ id: string; name: string }>,
) {
  return remote.map(sprint => ({
    id: sprint.id,
    externalId: sprint.id,
    name: sprint.name,
    startDate: ymd(sprint.start_date),
    endDate: ymd(sprint.end_date),
    status: sprint.status,
    chartId: charts.find(c => c.name.toLowerCase() === sprint.name.toLowerCase())?.id ?? null,
  }))
}

export async function persistErpSprints(remote: MappedSprint[]) {
  const charts = await prisma.chart.findMany()
  for (const sprint of remote) {
    await prisma.sprint.upsert({
      where: { externalId: sprint.id },
      create: {
        externalId: sprint.id,
        name: sprint.name,
        status: sprint.status,
        startDate: new Date(sprint.start_date),
        endDate: new Date(sprint.end_date),
      },
      update: {
        name: sprint.name,
        status: sprint.status,
        startDate: new Date(sprint.start_date),
        endDate: new Date(sprint.end_date),
      },
    })
  }
  return boardsFromErpSprints(remote, charts)
}

const importing = new Map<string, Promise<number>>()

export async function importBacklogsForSprint(sprintKey: string, chartId?: string | null) {
  const key = `${toSprintDocId(sprintKey)}:${chartId ?? ''}`
  const existing = importing.get(key)
  if (existing) return existing
  const run = importBacklogsOnce(sprintKey, chartId).finally(() => importing.delete(key))
  importing.set(key, run)
  return run
}

async function importBacklogsOnce(sprintKey: string, chartId?: string | null) {
  const settings = await prisma.settings.findFirst()
  const client = getErpNextClient(settings)
  if (!client) return 0

  const stored = await prisma.sprint.findFirst({
    where: {
      OR: [
        { externalId: sprintKey },
        { externalId: toSprintDocId(sprintKey) },
        { name: sprintKey },
      ],
    },
  })
  const sprintId = stored?.externalId && !stored.externalId.startsWith('local-')
    ? stored.externalId
    : toSprintDocId(sprintKey)
  if (!sprintId) return 0
  const backlogs = await client.fetchSprintBacklogs([sprintId])
  if (backlogs.length === 0) return 0
  const tree = await client.resolveBacklogTree(backlogs)
  const tasks = ganttRowsFromBacklogs(backlogs, tree, sprintId)
  if (tasks.length === 0) return 0
  let chart = chartId
    ? await prisma.chart.findUnique({ where: { id: chartId } })
    : stored
      ? await prisma.chart.findFirst({ where: { name: stored.name } })
      : null
  if (!chart) {
    chart = await prisma.chart.create({
      data: {
        name: stored?.name ?? sprintKey,
        startDate: stored?.startDate ?? new Date(),
        endDate: stored?.endDate ?? stored?.startDate ?? new Date(),
        viewMode: 'Week',
      },
    })
  }

  const leafIds = new Set(tasks.map(task => task.externalId))
  const expandedParents = backlogs
    .map(row => row.name)
    .filter(name => !leafIds.has(name))
  if (expandedParents.length) {
    await prisma.task.deleteMany({
      where: { source: 'erpnext', sprintId, externalId: { in: expandedParents } },
    })
  }

  for (const task of tasks) {
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
      erpStatus: task.erpStatus,
      devopsStatus: task.devopsStatus,
    })
    await prisma.task.upsert({
      where: { externalId: task.externalId },
      create: {
        externalId: task.externalId,
        source: 'erpnext',
        title: task.name,
        description,
        assigneeEmail: task.assigneeEmail,
        status: task.status,
        progress: task.progress,
        startDate: task.start ? new Date(task.start) : null,
        endDate: task.end ? new Date(task.end) : null,
        projectName: task.projectName,
        sprintName: task.sprintName,
        sprintId: task.sprintId,
        chartId: chart?.id ?? null,
        isOverdue: task.status === 'Overdue',
      },
      update: {
        title: task.name,
        description,
        assigneeEmail: task.assigneeEmail,
        status: task.status,
        progress: task.progress,
        startDate: task.start ? new Date(task.start) : null,
        endDate: task.end ? new Date(task.end) : null,
        projectName: task.projectName,
        sprintName: task.sprintName,
        sprintId: task.sprintId,
        chartId: chart?.id ?? undefined,
      },
    })
  }
  return tasks.length
}
