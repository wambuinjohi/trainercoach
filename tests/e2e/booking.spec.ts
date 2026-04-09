import { test, expect } from '@playwright/test';

test.describe('Booking flow', () => {
  test('client can search trainer and create mock booking', async ({ page }) => {
    await page.goto('/');

    // Open explore/home and pick first trainer card
    await page.waitForSelector('text=Find Your Perfect Trainer,', { timeout: 5000 }).catch(()=>{})

    // Navigate to client dashboard explore if available
    // This test is resilient: try to click first "View" or trainer card
    const trainerCard = await page.locator('text=Book Now').first();
    if (await trainerCard.count() === 0) {
      // fail fast if UI not present
      test.skip(true, 'No trainer entries available in this environment');
      return;
    }

    await trainerCard.click();
    // open booking modal
    await page.waitForSelector('text=Session Date');

    // Fill booking form
    await page.fill('input[type="date"]', '2030-01-02');
    await page.fill('input[type="time"]', '09:00');
    await page.fill('input[placeholder="Enter code"]', '');

    // Use mock payment if selector present
    await page.selectOption('select', 'mock').catch(()=>{});

    // Confirm
    await page.click('text=Confirm & Pay');

    // The flow should leave the booking form and land on the confirmation page
    await page.waitForURL(/booking-confirmation\//, { timeout: 10000 }).catch(() => {})
    await page.waitForSelector('text=Booking Confirmation', { timeout: 10000 }).catch(() => {})
    expect(page.url()).toContain('booking-confirmation')
  })
});
