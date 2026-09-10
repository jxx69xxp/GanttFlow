import ExcelJS from 'exceljs'
import {
  ALMOST_OVERDUE_COLOR,
  STATUS_COLORS,
  isAlmostOverdue,
  isOverdueTask,
  type GanttTask,
} from '../types'

export interface SprintExport {
  sprintName: string
  sprintId?: string
  startDate?: string
  endDate?: string
  tasks: GanttTask[]
}

function hex(color: string) {
  return color.replace('#', '').toUpperCase()
}

function statusFill(task: GanttTask) {
  if (isOverdueTask(task)) return hex(STATUS_COLORS.Overdue)
  if (isAlmostOverdue(task)) return hex(ALMOST_OVERDUE_COLOR)
  return hex(STATUS_COLORS[task.status] ?? STATUS_COLORS['Not Started'])
}

export async function exportSprintExcel(input: SprintExport) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'GanttFlow'
  wb.created = new Date()

  const sheet = wb.addWorksheet('Sprint Tasks', {
    views: [{ state: 'frozen', ySplit: 4, xSplit: 0, showGridLines: false }],
    properties: { defaultRowHeight: 20 },
  })

  sheet.mergeCells('A1:I1')
  const title = sheet.getCell('A1')
  title.value = 'GanttFlow'
  title.font = { name: 'Calibri', size: 20, bold: true, color: { argb: 'FFFFFFFF' } }
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } }
  title.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
  sheet.getRow(1).height = 32

  sheet.mergeCells('A2:I2')
  const subtitle = sheet.getCell('A2')
  const range = [input.startDate, input.endDate].filter(Boolean).join('  →  ')
  subtitle.value = `${input.sprintName}${input.sprintId ? `   ${input.sprintId}` : ''}${range ? `   ${range}` : ''}   ·   ${input.tasks.length} tasks`
  subtitle.font = { name: 'Calibri', size: 11, color: { argb: 'FF1E3A8A' } }
  subtitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } }
  subtitle.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
  sheet.getRow(2).height = 22

  sheet.mergeCells('A3:I3')
  sheet.getCell('A3').value = 'Weekdays only  ·  Status and DevOps from Sprint Backlogs'
  sheet.getCell('A3').font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF64748B' } }
  sheet.getRow(3).height = 16

  const headers = ['#', 'Task', 'ID', 'Status', 'DevOps', 'Assignee', 'Start', 'End', 'Progress']
  const headerRow = sheet.getRow(4)
  headers.forEach((label, i) => {
    const cell = headerRow.getCell(i + 1)
    cell.value = label
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }
    cell.alignment = { vertical: 'middle', horizontal: i === 1 ? 'left' : 'center' }
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FF1D4ED8' } },
    }
  })
  headerRow.height = 22

  input.tasks.forEach((task, index) => {
    const row = sheet.addRow([
      index + 1,
      task.name,
      task.externalId && !task.externalId.startsWith('local-') ? task.externalId : '',
      isOverdueTask(task) ? 'Overdue' : task.erpStatus || task.status,
      task.devopsStatus || '',
      task.assigneeName || task.assigneeEmail || '',
      task.start,
      task.end,
      `${task.progress ?? 0}%`,
    ])
    const fill = index % 2 === 0 ? 'FFF8FAFC' : 'FFFFFFFF'
    row.eachCell((cell, col) => {
      cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF0F172A' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } }
      cell.alignment = { vertical: 'middle', horizontal: col === 2 ? 'left' : 'center', wrapText: col === 2 }
      cell.border = {
        bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } },
      }
    })
    const statusCell = row.getCell(4)
    statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${statusFill(task)}` } }
    statusCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
    row.height = 20
  })

  const last = 4 + input.tasks.length
  sheet.autoFilter = { from: 'A4', to: `I${Math.max(4, last)}` }
  sheet.columns = [
    { width: 6 },
    { width: 48 },
    { width: 16 },
    { width: 16 },
    { width: 18 },
    { width: 28 },
    { width: 14 },
    { width: 14 },
    { width: 12 },
  ]

  const legend = wb.addWorksheet('Legend')
  legend.getCell('A1').value = 'Status colors'
  legend.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FF0F172A' } }
  Object.entries(STATUS_COLORS).forEach(([label, color], i) => {
    const cell = legend.getCell(`A${i + 3}`)
    cell.value = label
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${hex(color)}` } }
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  })
  legend.getColumn(1).width = 22

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const slug = (input.sprintId || input.sprintName || 'sprint').replace(/[^\w.-]+/g, '_')
  a.href = url
  a.download = `GanttFlow_${slug}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}
