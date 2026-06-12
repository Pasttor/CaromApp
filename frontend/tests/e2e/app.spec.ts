import { expect, test } from '@playwright/test'

const state = {
  match: {
    id: 'match-1',
    player_count: 4,
    player_1_name: 'Jugador 1',
    player_2_name: 'Jugador 2',
    player_3_name: 'Jugador 3',
    player_4_name: 'Jugador 4',
    player_1_score: 8,
    player_2_score: 8,
    player_3_score: 3,
    player_4_score: 5,
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

test('easy flow selects four players and renders the scoreboard', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'FÁCIL' }).click()
  await page.getByRole('button', { name: '4 jugadores' }).click()
  await expect(page.getByLabel('Nombre jugador 1')).toHaveValue('Jugador 1')
  await expect(page.getByLabel('Nombre jugador 3')).toHaveValue('Jugador 3')
  await expect(page.getByLabel('Nombre jugador 4')).toHaveValue('Jugador 4')
  await expect(page.getByLabel('Sumar 1 punto al jugador 1')).toBeVisible()
  await expect(page.locator('media-controller')).toBeVisible()
})
