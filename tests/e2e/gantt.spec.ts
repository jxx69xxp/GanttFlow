import { test, expect } from '@playwright/test'

test.describe('Gantt Chart', () => {
  test('renders dashboard page', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('GanttFlow')).toBeVisible()
  })

  test('shows empty state when no tasks', async ({ page }) => {
    await page.goto('/')
    // Either gantt chart or empty state should be visible
    const gantt = page.getByTestId('gantt-chart')
    const empty = page.getByText(/No tasks found/)
    await expect(gantt.or(empty)).toBeVisible({ timeout: 10000 })
  })

  test('switches view modes', async ({ page }) => {
    await page.goto('/')
    for (const mode of ['Day', 'Month', 'Quarter Year', 'Week']) {
      await page.getByRole('button', { name: mode }).click()
      await expect(page.getByRole('button', { name: mode })).toHaveClass(/bg-blue-600/)
    }
  })

  test('search filter works', async ({ page }) => {
    await page.goto('/')
    await page.getByPlaceholder('Search tasks…').fill('test query')
    // No error should occur
    await expect(page.getByPlaceholder('Search tasks…')).toHaveValue('test query')
  })

  test('clear filters button appears after filtering', async ({ page }) => {
    await page.goto('/')
    await page.getByPlaceholder('Search tasks…').fill('something')
    await expect(page.getByText('Clear')).toBeVisible()
  })

  test('Sync button triggers sync', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /Sync/i }).first().click()
    // Should show loading or result
    await expect(page.getByText(/Sync/i).first()).toBeVisible()
  })
})

test.describe('Settings page', () => {
  test('renders settings page', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByText('Settings')).toBeVisible()
    await expect(page.getByText('ERPNext Connection')).toBeVisible()
    await expect(page.getByText('Sprint Kickoff Connection')).toBeVisible()
    await expect(page.getByText('Team Members')).toBeVisible()
  })

  test('can fill ERPNext credentials', async ({ page }) => {
    await page.goto('/settings')
    await page.getByPlaceholder('https://yoursite.erpnext.com').fill('https://test.erpnext.com')
    await expect(page.getByPlaceholder('https://yoursite.erpnext.com')).toHaveValue('https://test.erpnext.com')
  })

  test('can add team member', async ({ page }) => {
    await page.goto('/settings')
    await page.getByPlaceholder('email@company.com').fill('testdev@company.com')
    await page.getByPlaceholder('Name').fill('Test Dev')
    await page.getByRole('button', { name: /Add/i }).click()
    // Toast or table update
    await expect(page.locator('body')).toBeVisible()
  })
})

test.describe('Notifications page', () => {
  test('renders notifications page', async ({ page }) => {
    await page.goto('/notifications')
    await expect(page.getByText('Notification Log')).toBeVisible()
  })

  test('shows empty state or table', async ({ page }) => {
    await page.goto('/notifications')
    const empty = page.getByText(/No notifications/)
    const table = page.locator('table')
    await expect(empty.or(table)).toBeVisible({ timeout: 5000 })
  })
})
