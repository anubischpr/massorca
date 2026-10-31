import { test, expect } from './helpers/orca-app'
import { waitForSessionReady } from './helpers/store'

test('creates a team with a bot from the Bot teams mode', async ({ orcaPage: page }, testInfo) => {
  await waitForSessionReady(page)

  await page.getByRole('radio', { name: 'Bot teams' }).click()
  await expect(page.getByRole('heading', { name: 'All teams' })).toBeVisible()

  await page.getByRole('button', { name: 'New team' }).click()
  await page.getByLabel('Team name').fill('Marketing')
  await page.getByLabel('What is this team for?').fill('Flyers and campaigns')

  await page.getByRole('button', { name: 'Add a bot' }).click()
  await page.getByLabel('Name', { exact: true }).fill('Iris')
  await page.getByLabel('Job').fill('Designs flyers')
  await page.getByRole('button', { name: 'Add bot' }).click()
  await page.screenshot({ path: testInfo.outputPath('new-team.png') })
  await page.getByRole('button', { name: 'Create team' }).click()

  const teamCard = page.getByRole('button', { name: /Marketing/ })
  await expect(teamCard).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('all-teams.png') })

  await teamCard.click()
  await expect(page.getByText('Iris')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('team.png') })

  // The host persists the team: leaving the mode and coming back reads it again.
  await page.getByRole('radio', { name: 'Workspaces' }).click()
  await page.getByRole('radio', { name: 'Bot teams' }).click()
  await expect(page.getByRole('button', { name: /Marketing/ })).toBeVisible()
})
