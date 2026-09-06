import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function login(page: Page, role = 'analyst') {
  await page.goto('/login');
  await page.getByLabel('Email address').fill(`${role}@bankguard.test`);
  await page
    .getByLabel('Password', { exact: true })
    .fill(`${role[0].toUpperCase() + role.slice(1)}-demo-123!`);
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  await expect(page).not.toHaveURL(/login/);
}

async function reset(page: Page) {
  const login = await page.request.post('/api/auth/login', {
    data: { email: 'admin@bankguard.test', password: 'Admin-demo-123!' },
  });
  expect(login.ok()).toBeTruthy();
  const data = await login.json();
  const response = await page.request.post('/api/admin/reset', {
    data: { confirmation: 'RESET BANKGUARD' },
    headers: { 'X-CSRF-Token': data.csrf_token },
  });
  expect(response.ok()).toBeTruthy();
  await page.context().clearCookies();
}

test('analyst guided ATO: live events, investigation, real containment, report, resolution and UI reset', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await reset(page);
  await login(page);
  await page.getByRole('link', { name: 'Start Guided Simulation', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Attack simulation center' })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: /Guided learning mode/ })).toBeChecked();
  const launch = page.waitForResponse(
    (r) => r.url().endsWith('/api/simulations') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Launch Simulation', exact: true }).click();
  const run = await (await launch).json();
  for (let step = 1; step <= 8; step++) {
    const next = page.waitForResponse((r) => r.url().endsWith('/continue'));
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    expect((await next).ok()).toBeTruthy();
    await expect(page.getByRole('progressbar', { name: 'Simulation progress' })).toHaveAttribute(
      'value',
      String(step),
    );
  }
  await expect(page.getByRole('heading', { name: 'Fraud prevented.' })).toBeVisible();
  await expect(page.getByText('Transaction Frozen', { exact: true }).first()).toBeVisible();
  await page.screenshot({ path: '../artifacts/simulation-success.png', fullPage: true });
  await page.getByRole('link', { name: 'View Investigation', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Potential Account Takeover', exact: true }),
  ).toBeVisible();
  const detailResponse = await page.request.get(
    new URL(page.url()).pathname.replace('/soc/', '/api/soc/'),
  );
  const detail = await detailResponse.json();
  expect(detail.account.status).toBe('LOCKED');
  expect(detail.transactions.some((t: { status: string }) => t.status === 'FROZEN')).toBeTruthy();
  expect(detail.sessions.every((s: { status: string }) => s.status === 'REVOKED')).toBeTruthy();
  expect(detail.threat_intel.status).toBe('BLOCKED');
  expect(detail.incident.risk_score).toBe(110);
  await page.getByRole('tab', { name: 'Timeline', exact: true }).click();
  await expect(page.getByRole('button', { name: /Phishing Email Sent/ })).toBeVisible();
  await page.getByRole('tab', { name: 'Evidence', exact: true }).click();
  await expect(page.getByText('Captured snapshots with SHA-256 integrity hashes.')).toBeVisible();
  await page.getByRole('tab', { name: 'Response', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Playbook completed' })).toBeDisabled();
  await page.getByRole('tab', { name: 'Investigation', exact: true }).click();
  await page
    .getByLabel('Add your findings')
    .fill('Verified account lock, revoked sessions, frozen funds and blocked synthetic IP.');
  await page.getByRole('button', { name: 'Add note', exact: true }).click();
  await expect(
    page.getByText(
      'Verified account lock, revoked sessions, frozen funds and blocked synthetic IP.',
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Assign to me' }).click();
  await expect(page.getByRole('button', { name: 'Assigned to you' })).toBeDisabled();
  await page.getByLabel('Update incident status').selectOption('REMEDIATING');
  await expect(page.getByText('REMEDIATING', { exact: true })).toBeVisible();
  await page.getByLabel('Update incident status').selectOption('RESOLVED');
  await expect(page.getByText('RESOLVED', { exact: true })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Generate Incident Report', exact: true }).click();
  await (await download).saveAs('../artifacts/incident-report.pdf');
  await page.goto('/soc/dashboard');
  await expect(page.getByRole('heading', { name: 'Security overview' })).toBeVisible();
  await page.screenshot({ path: '../artifacts/dashboard-1440.png', fullPage: true });
  const runs = await (await page.request.get('/api/simulations')).json();
  expect(runs.find((r: { id: string }) => r.id === run.id).status).toBe('COMPLETED');
  await page.getByRole('button', { name: 'Sign out' }).click();
  await login(page, 'admin');
  await page.goto('/simulation');
  await page.getByRole('button', { name: 'Reset Demo Environment' }).click();
  await page.getByRole('button', { name: 'Confirm Reset', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign in to workspace' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('automatic simulation pushes telemetry to a separate event-explorer tab; pause, resume and stop', async ({
  page,
}) => {
  await reset(page);
  await login(page);
  await page.goto('/simulation');
  const other = await page.context().newPage();
  await other.goto('/soc/events');
  await page.getByRole('button', { name: 'Launch Simulation', exact: true }).click();
  await expect(other.getByText('Phishing Email Sent', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByText('PAUSED', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(page.getByText('STOPPED', { exact: true })).toBeVisible();
  await other.close();
});

test('customer banking and role protection', async ({ page }) => {
  await reset(page);
  await login(page, 'customer');
  await expect(page.getByText('₹2,50,000', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Add beneficiary' }).click();
  await page.getByLabel('Beneficiary name').fill('Demo household');
  await page.getByLabel('Fictional account number').fill('BG-HOME-222');
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.getByRole('button', { name: 'Transfer', exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Beneficiary', exact: true })
    .selectOption({ label: 'Demo household' });
  await page.getByLabel('Amount (INR)').fill('250');
  await page.getByLabel('Reference', { exact: true }).fill('Browser-tested transfer');
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByText('Browser-tested transfer')).toBeVisible();
  await page.goto('/soc/incidents');
  await expect(page).toHaveURL(/\/banking$/);
});

test('responsive navigation and core pages at required widths', async ({ page }) => {
  await login(page, 'admin');
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const width of [375, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of ['/', '/soc/dashboard', '/soc/incidents', '/soc/events', '/simulation']) {
      await page.goto(route);
      await expect(page.locator('h1')).toBeVisible();
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
        .toBeTruthy();
    }
    await page.screenshot({ path: `../artifacts/responsive-${width}.png`, fullPage: true });
    if (width < 1024) {
      await page.getByRole('button', { name: 'Open navigation' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toBeHidden();
    }
  }
  expect(errors).toEqual([]);
});

test('all supporting pages load meaningful data and rule test executes', async ({ page }) => {
  await login(page, 'admin');
  for (const route of [
    '/soc/alerts',
    '/soc/detections',
    '/soc/hunting',
    '/soc/reports',
    '/soc/playbooks',
    '/soc/threat-intel',
    '/response/history',
    '/simulation/history',
    '/banking',
    '/banking/transactions',
    '/banking/beneficiaries',
    '/system/audit',
    '/system/health',
    '/system/users',
  ]) {
    await page.goto(route);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
  }
  await page.goto('/soc/detections');
  await page.getByRole('button', { name: 'Test rule', exact: true }).first().click();
  await expect(page.getByRole('dialog', { name: 'Rule replay results' })).toBeVisible({
    timeout: 30000,
  });
  await expect(page.getByText(/ROLLBACK_ONLY/)).toBeVisible();
  await page.keyboard.press('Escape');
  for (const route of ['/', '/soc/dashboard', '/simulation', '/soc/events']) {
    await page.goto(route);
    await expect(page.locator('h1')).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(results.violations, `Accessibility violations on ${route}`).toEqual([]);
  }
  await page.goto('/api/docs');
  await expect(page.getByRole('heading', { name: /BankGuard SOC API/ })).toBeVisible({
    timeout: 30000,
  });
});
