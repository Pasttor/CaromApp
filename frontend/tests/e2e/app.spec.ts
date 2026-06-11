import { expect, test } from '@playwright/test'

const state = {
  match: {
    id: 'match-1',
    player_1_name: 'Jugador 1',
    player_2_name: 'Jugador 2',
    player_1_score: 8,
    player_2_score: 8,
    current_turn: 1,
    started_at: new Date().toISOString(),
    ended_at: null,
    duration_seconds: 360,
    hourly_rate: 120,
    hourly_rate_mxn: 120,
    total_cost: 12,
    status: 'active',
  },
  latest_match: null,
  history: [],
  settings: {
    hourly_rate_mxn: '120',
    camera_source_type: 'demo',
    camera_device: 'default',
    demo_mode_enabled: 'true',
    buffer_minutes: '30',
    segment_seconds: '5',
    video_resolution: '1280x720',
    video_fps: '30',
    allow_negative_scores: 'false',
  },
  video: {
    status: 'running',
    running: true,
    mode: 'live',
    message: 'Grabando buffer circular.',
    available_seconds: 30,
  },
}

test.beforeEach(async ({ page }) => {
  await page.route('http://127.0.0.1:8000/api/**', async (route) => {
    await route.fulfill({ json: state })
  })
})

test('scoreboard flow renders controls and replay buttons', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByLabel('Nombre jugador 1')).toHaveValue('Jugador 1')
  await expect(page.getByLabel('Sumar 1 punto al jugador 1')).toContainText('8')
  await page.locator('[aria-label="Acciones jugador 1"]').getByRole('button', { name: '+2' }).click()
  await page.getByRole('button', { name: /-30s/i }).click()
  await expect(page.getByText('00:06:00')).toBeVisible()
})
