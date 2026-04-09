import { calculateFeeBreakdown } from './fee-calculations'

// Test cases for NEW SIMPLIFIED PRICING MODEL
// Client pays: base + VAT (16%) + transport
// Trainer receives: base - platform fee (25%) + transport
describe('Fee Calculations - New Simplified Model', () => {
  const testSettings = {
    platformChargeClientPercent: 15, // DEPRECATED: No longer used
    platformChargeTrainerPercent: 10, // DEPRECATED: No longer used
    compensationFeePercent: 10, // DEPRECATED: No longer used
    maintenanceFeePercent: 15, // DEPRECATED: No longer used
  }

  test('Basic calculation with Ksh 1000 base amount - no transport', () => {
    const breakdown = calculateFeeBreakdown(1000, testSettings, 0)

    // NEW LOGIC:
    // VAT = 1000 × 16% = 160
    expect(breakdown.vatAmount).toBe(160)

    // Platform Fee = 1000 × 25% = 250
    expect(breakdown.platformFeeAmount).toBe(250)

    // Client pays: base + VAT + transport = 1000 + 160 + 0 = 1160
    expect(breakdown.clientTotal).toBe(1160)

    // Trainer receives: base - platform fee + transport = 1000 - 250 + 0 = 750
    expect(breakdown.trainerNetAmount).toBe(750)

    // All deprecated fields should be 0
    expect(breakdown.platformChargeClient).toBe(0)
    expect(breakdown.platformChargeTrainer).toBe(0)
    expect(breakdown.compensationFee).toBe(0)
    expect(breakdown.maintenanceFee).toBe(0)
  })

  test('Calculation with transport fee', () => {
    const breakdown = calculateFeeBreakdown(1000, testSettings, 150)

    // VAT = 1000 × 16% = 160
    expect(breakdown.vatAmount).toBe(160)

    // Platform Fee = 1000 × 25% = 250
    expect(breakdown.platformFeeAmount).toBe(250)

    // Client pays: base + VAT + transport = 1000 + 160 + 150 = 1310
    expect(breakdown.clientTotal).toBe(1310)

    // Trainer receives: base - platform fee + transport = 1000 - 250 + 150 = 900
    expect(breakdown.trainerNetAmount).toBe(900)
  })

  test('Standard booking calculation (Ksh 800 base)', () => {
    const breakdown = calculateFeeBreakdown(800, testSettings, 0)

    // VAT = 800 × 16% = 128
    expect(breakdown.vatAmount).toBe(128)

    // Platform Fee = 800 × 25% = 200
    expect(breakdown.platformFeeAmount).toBe(200)

    // Client total: 800 + 128 = 928
    expect(breakdown.clientTotal).toBe(928)

    // Trainer net: 800 - 200 = 600
    expect(breakdown.trainerNetAmount).toBe(600)
  })

  test('Calculation with distance-based transport fee', () => {
    // Example: 5km away, transport fee = Ksh 150
    const breakdown = calculateFeeBreakdown(500, testSettings, 150)

    // VAT = 500 × 16% = 80
    expect(breakdown.vatAmount).toBe(80)

    // Platform Fee = 500 × 25% = 125
    expect(breakdown.platformFeeAmount).toBe(125)

    // Client total: 500 + 80 + 150 = 730
    expect(breakdown.clientTotal).toBe(730)

    // Trainer net: 500 - 125 + 150 = 525
    expect(breakdown.trainerNetAmount).toBe(525)
  })

  test('Verify client only pays base + VAT + transport', () => {
    const breakdown = calculateFeeBreakdown(1000, testSettings, 100)

    // Calculate expected values
    const expectedVat = Math.round(1000 * 0.16 * 100) / 100 // 160
    const expectedClientTotal = 1000 + expectedVat + 100 // 1260

    expect(breakdown.vatAmount).toBe(expectedVat)
    expect(breakdown.clientTotal).toBe(expectedClientTotal)

    // Verify no other fees are charged to client
    expect(breakdown.platformChargeClient).toBe(0)
    expect(breakdown.compensationFee).toBe(0)
    expect(breakdown.maintenanceFee).toBe(0)
  })

  test('Verify trainer only loses platform fee from base', () => {
    const breakdown = calculateFeeBreakdown(1000, testSettings, 100)

    // Calculate expected values
    const expectedPlatformFee = Math.round(1000 * 0.25 * 100) / 100 // 250
    const expectedTrainerNet = 1000 - expectedPlatformFee + 100 // 850

    expect(breakdown.platformFeeAmount).toBe(expectedPlatformFee)
    expect(breakdown.trainerNetAmount).toBe(expectedTrainerNet)

    // Verify trainer doesn't lose any other fees
    expect(breakdown.platformChargeTrainer).toBe(0)
    expect(breakdown.maintenanceFee).toBe(0)
  })

  test('Edge case: Zero base amount', () => {
    const breakdown = calculateFeeBreakdown(0, testSettings, 0)

    expect(breakdown.baseAmount).toBe(0)
    expect(breakdown.vatAmount).toBe(0)
    expect(breakdown.platformFeeAmount).toBe(0)
    expect(breakdown.clientTotal).toBe(0)
    expect(breakdown.trainerNetAmount).toBe(0)
  })

  test('Edge case: Only transport fee (no base amount)', () => {
    const breakdown = calculateFeeBreakdown(0, testSettings, 200)

    // No VAT or platform fee on transport (transport is separate)
    expect(breakdown.vatAmount).toBe(0)
    expect(breakdown.platformFeeAmount).toBe(0)

    // Client pays: 0 + 0 + 200 = 200
    expect(breakdown.clientTotal).toBe(200)

    // Trainer receives: 0 - 0 + 200 = 200
    expect(breakdown.trainerNetAmount).toBe(200)
  })

  test('High base amount (group training scenario)', () => {
    const breakdown = calculateFeeBreakdown(5000, testSettings, 300)

    // VAT = 5000 × 16% = 800
    expect(breakdown.vatAmount).toBe(800)

    // Platform Fee = 5000 × 25% = 1250
    expect(breakdown.platformFeeAmount).toBe(1250)

    // Client total: 5000 + 800 + 300 = 6100
    expect(breakdown.clientTotal).toBe(6100)

    // Trainer net: 5000 - 1250 + 300 = 4050
    expect(breakdown.trainerNetAmount).toBe(4050)
  })

  test('Verify calculation consistency across amounts', () => {
    const amounts = [100, 250, 500, 1000, 2500, 5000]
    const transportFee = 150

    for (const baseAmount of amounts) {
      const breakdown = calculateFeeBreakdown(baseAmount, testSettings, transportFee)

      // Client should pay: base + (base × 0.16) + transport
      const expectedClientTotal = baseAmount + (baseAmount * 0.16) + transportFee
      expect(breakdown.clientTotal).toBeCloseTo(expectedClientTotal, 2)

      // Trainer should receive: base - (base × 0.25) + transport
      const expectedTrainerNet = baseAmount - (baseAmount * 0.25) + transportFee
      expect(breakdown.trainerNetAmount).toBeCloseTo(expectedTrainerNet, 2)

      // Verify all other fees are 0
      expect(breakdown.platformChargeClient).toBe(0)
      expect(breakdown.platformChargeTrainer).toBe(0)
      expect(breakdown.compensationFee).toBe(0)
      expect(breakdown.maintenanceFee).toBe(0)
    }
  })

  test('Verify system earns: VAT + platform fee', () => {
    const breakdown = calculateFeeBreakdown(1000, testSettings, 100)

    // System/Platform should receive:
    // - VAT from client
    // - Platform fee from trainer
    const systemRevenue = breakdown.vatAmount + breakdown.platformFeeAmount
    expect(systemRevenue).toBe(160 + 250) // 410
  })

  test('Verify full flow: client payment + trainer earnings + system revenue', () => {
    const baseAmount = 1000
    const transportFee = 100
    const breakdown = calculateFeeBreakdown(baseAmount, testSettings, transportFee)

    // What client pays
    const clientPays = breakdown.clientTotal

    // What trainer gets
    const trainerGets = breakdown.trainerNetAmount

    // What system gets
    const systemGets = breakdown.vatAmount + breakdown.platformFeeAmount

    // Client pays for: base + transport + VAT
    expect(clientPays).toBe(baseAmount + transportFee + breakdown.vatAmount)

    // Trainer gets: base - platform fee + transport
    expect(trainerGets).toBe(baseAmount - breakdown.platformFeeAmount + transportFee)

    // System gets: VAT + platform fee
    expect(systemGets).toBe(410)
  })
})
