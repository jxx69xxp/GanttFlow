import { Resend } from 'resend'
import type { GanttTask } from '../types'
import { prisma } from '../db/prisma'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.FROM_EMAIL ?? 'ganttflow@example.com'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

async function logNotification(
  event: string, recipient: string, taskId?: string, status = 'sent', errorMsg?: string
) {
  await prisma.notificationLog.create({
    data: { event, recipient, taskId, status, errorMsg },
  }).catch(() => {})
}

export async function sendTaskAssigned({
  task, recipientEmail,
}: { task: GanttTask; recipientEmail: string }) {
  const html = `
    <div style="font-family:sans-serif;max-width:540px;margin:auto;padding:32px">
      <h2 style="color:#1e293b">📋 New Task Assigned</h2>
      <p>Hi,</p>
      <p>You have been assigned a new task in <strong>${task.sprintName ?? 'your project'}</strong>:</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:8px;color:#64748b;width:100px">Task</td>
            <td style="padding:8px;font-weight:600">${task.name}</td></tr>
        <tr style="background:#f8fafc">
            <td style="padding:8px;color:#64748b">Project</td>
            <td style="padding:8px">${task.projectName ?? '—'}</td></tr>
        <tr><td style="padding:8px;color:#64748b">Sprint</td>
            <td style="padding:8px">${task.sprintName ?? '—'}</td></tr>
        <tr style="background:#f8fafc">
            <td style="padding:8px;color:#64748b">Due</td>
            <td style="padding:8px">${task.end}</td></tr>
      </table>
      <a href="${APP_URL}" style="display:inline-block;background:#3b82f6;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
        View in GanttFlow →
      </a>
      <p style="color:#94a3b8;font-size:12px;margin-top:32px">GanttFlow · Task notification</p>
    </div>`

  try {
    await resend.emails.send({
      from: FROM, to: recipientEmail,
      subject: `📋 New Task Assigned: ${task.name}`, html,
    })
    await logNotification('task_assigned', recipientEmail, task.id)
  } catch (e) {
    await logNotification('task_assigned', recipientEmail, task.id, 'failed', String(e))
    throw e
  }
}

export async function sendTaskCompleted({
  task, recipientEmail,
}: { task: GanttTask; recipientEmail: string }) {
  const html = `
    <div style="font-family:sans-serif;max-width:540px;margin:auto;padding:32px">
      <h2 style="color:#1e293b">✅ Task Completed</h2>
      <p>Hi team,</p>
      <p>A task has been marked complete in <strong>${task.sprintName ?? 'your project'}</strong>:</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:8px;color:#64748b;width:100px">Task</td>
            <td style="padding:8px;font-weight:600">${task.name}</td></tr>
        <tr style="background:#f8fafc">
            <td style="padding:8px;color:#64748b">Sprint</td>
            <td style="padding:8px">${task.sprintName ?? '—'}</td></tr>
        <tr><td style="padding:8px;color:#64748b">Done on</td>
            <td style="padding:8px">${new Date().toLocaleDateString('en-PH')}</td></tr>
      </table>
      <a href="${APP_URL}" style="display:inline-block;background:#22c55e;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
        View Timeline →
      </a>
      <p style="color:#94a3b8;font-size:12px;margin-top:32px">GanttFlow · Task notification</p>
    </div>`

  try {
    await resend.emails.send({
      from: FROM, to: recipientEmail,
      subject: `✅ Task Completed: ${task.name}`, html,
    })
    await logNotification('task_completed', recipientEmail, task.id)
  } catch (e) {
    await logNotification('task_completed', recipientEmail, task.id, 'failed', String(e))
    throw e
  }
}

export async function sendOverdueAlert({
  task, recipientEmail,
}: { task: { id: string; name: string; end: string; sprintName?: string | null }; recipientEmail: string }) {
  const html = `
    <div style="font-family:sans-serif;max-width:540px;margin:auto;padding:32px">
      <h2 style="color:#ef4444">⚠️ Task Overdue</h2>
      <p>The following task is past its due date:</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:8px;color:#64748b;width:100px">Task</td>
            <td style="padding:8px;font-weight:600">${task.name}</td></tr>
        <tr style="background:#f8fafc">
            <td style="padding:8px;color:#64748b">Was due</td>
            <td style="padding:8px;color:#ef4444;font-weight:600">${task.end}</td></tr>
      </table>
      <a href="${APP_URL}" style="display:inline-block;background:#ef4444;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
        Review in GanttFlow →
      </a>
    </div>`

  try {
    await resend.emails.send({
      from: FROM, to: recipientEmail,
      subject: `⚠️ Overdue Task: ${task.name}`, html,
    })
    await logNotification('task_overdue', recipientEmail, task.id)
  } catch (e) {
    await logNotification('task_overdue', recipientEmail, task.id, 'failed', String(e))
  }
}
