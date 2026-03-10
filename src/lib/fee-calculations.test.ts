import { calculateFeeBreakdown } from './fee-calculations'

// Test cases based on user's calculation order specification
describe('Fee Calculations', () => {
  const testSettings = {
    platformChargeClientPercent: 15,
    platformChargeTrainerPercent: 10,
    compensationFeePercent: 10,
    maintenanceFeePercent: 15,
  }

  test('Basic calculation with Ksh 1000 base amount', () => {
    const breakdown = calculateFeeBreakdown(1000, testSettings, 0)

    // Step 1: Calculate charges on base amount
    // platformChargeClient: 1000 × 15% = 150
    // platformChargeTrainer: 1000 × 10% = 100
    // compensationFee: 1000 × 10% = 100
    expect(breakdown.platformChargeClient).toBe(150)
    expect(breakdown.platformChargeTrainer).toBe(100)
    expect(breakdown.compensationFee).toBe(100)

    // Step 2: Sum all charges
    // Sum: 150 + 100 + 100 = 350
    expect(breakdown.sumOfCharges).toBe(350)

    // Step 3: Apply maintenance fee on sum
    // maintenanceFee: 350 × 15% = 52.50
    // (This is platform/developer revenue, NOT charged to client)
    expect(breakdown.maintenanceFee).toBe(52.5)

    // Step 4: Client total (maintenance fee NOT included)
    // Client charges: platformChargeClient + compensationFee = 150 + 100 = 250
    // Client total: base + client charges + transport = 1000 + 250 + 0 = 1250
    expect(breakdown.clientTotal).toBe(1250)

    // Step 5: Trainer net (deducts trainer's share of maintenance)
    // Trainer share of maintenance: (platformChargeTrainer / sumOfCharges) × maintenanceFee
    // = (100 / 350) × 52.50 = 15
    // Trainer net: base + transport - platformChargeTrainer - trainer's share of maintenance
    // = 1000 + 0 - 100 - 15 = 885
    expect(breakdown.trainerNetAmount).toBe(885)
  })

  test('With transport fee', () => {
    const breakdown = calculateFeeBreakdown(1000, testSettings, 200)

    // Transport fee should be added to both client total and trainer net
    // Client: 1250 + 200 = 1450 (maintenance fee NOT included)
    expect(breakdown.clientTotal).toBe(1450)

    // Trainer: 885 + 200 = 1085 (already deducted trainer's maintenance share)
    expect(breakdown.trainerNetAmount).toBe(1085)
  })

  test('Standard booking calculation (800 base)', () => {
    const breakdown = calculateFeeBreakdown(800, testSettings, 0)

    // platformChargeClient: 800 × 15% = 120
    expect(breakdown.platformChargeClient).toBe(120)

    // platformChargeTrainer: 800 × 10% = 80
    expect(breakdown.platformChargeTrainer).toBe(80)

    // compensationFee: 800 × 10% = 80
    expect(breakdown.compensationFee).toBe(80)

    // Sum: 280
    expect(breakdown.sumOfCharges).toBe(280)

    // maintenanceFee: 280 × 15% = 42 (NOT charged to client)
    expect(breakdown.maintenanceFee).toBe(42)

    // Client total: 800 + 120 + 80 = 1000 (no maintenance fee added)
    expect(breakdown.clientTotal).toBe(1000)

    // Trainer share of maintenance: (80 / 280) × 42 = 12
    // Trainer net: 800 + 0 - 80 - 12 = 708
    expect(breakdown.trainerNetAmount).toBe(708)
  })

  test('Zero fees scenario', () => {
    const zeroSettings = {
      platformChargeClientPercent: 0,
      platformChargeTrainerPercent: 0,
      compensationFeePercent: 0,
      maintenanceFeePercent: 0,
    }
    
    const breakdown = calculateFeeBreakdown(1000, zeroSettings, 100)

    // No charges
    expect(breakdown.platformChargeClient).toBe(0)
    expect(breakdown.platformChargeTrainer).toBe(0)
    expect(breakdown.compensationFee).toBe(0)
    expect(breakdown.sumOfCharges).toBe(0)
    expect(breakdown.maintenanceFee).toBe(0)

    // Client and trainer amounts should be base + transport only
    expect(breakdown.clientTotal).toBe(1100)
    expect(breakdown.trainerNetAmount).toBe(1100)
  })

  test('Percentage bounds', () => {
    const extremeSettings = {
      platformChargeClientPercent: 150, // Will be clamped to 100
      platformChargeTrainerPercent: -50, // Will be clamped to 0
      compensationFeePercent: 100,
      maintenanceFeePercent: 75,
    }

    const breakdown = calculateFeeBreakdown(1000, extremeSettings, 0)

    // platformChargeClient: 1000 × 100% = 1000 (clamped)
    expect(breakdown.platformChargeClient).toBe(1000)
    
    // platformChargeTrainer: 1000 × 0% = 0 (clamped)
    expect(breakdown.platformChargeTrainer).toBe(0)
    
    // compensationFee: 1000 × 100% = 1000
    expect(breakdown.compensationFee).toBe(1000)
    
    // Sum: 2000
    expect(breakdown.sumOfCharges).toBe(2000)
    
    // maintenanceFee: 2000 × 75% = 1500
    expect(breakdown.maintenanceFee).toBe(1500)
  })

  test('Calculation matches user specification', () => {
    // Verify the calculation order matches the specification:
    // 1. Base amount + charges on base = client amount
    // 2. Maintenance is internal (deducted from trainer, not charged to client)

    const breakdown = calculateFeeBreakdown(1000, testSettings, 0)

    // Verify the calculation order by checking the intermediate values
    const charges = breakdown.platformChargeClient + breakdown.platformChargeTrainer + breakdown.compensationFee
    expect(charges).toBe(breakdown.sumOfCharges)

    const maintenance = Math.round((breakdown.sumOfCharges * testSettings.maintenanceFeePercent) / 100 * 100) / 100
    expect(maintenance).toBe(breakdown.maintenanceFee)

    // Client should pay: base + charges that apply to client (NOT maintenance fee)
    const clientCharges = breakdown.platformChargeClient + breakdown.compensationFee
    const expectedClientTotal = breakdown.baseAmount + clientCharges
    expect(breakdown.clientTotal).toBe(expectedClientTotal)

    // Trainer should have maintenance deducted (proportionally)
    const trainerShareOfMaintenance = (breakdown.platformChargeTrainer / breakdown.sumOfCharges) * breakdown.maintenanceFee
    const expectedTrainerNet = breakdown.baseAmount - breakdown.platformChargeTrainer - trainerShareOfMaintenance
    expect(breakdown.trainerNetAmount).toBe(expectedTrainerNet)
  })
})

// Example: If you want to run these tests, uncomment below and run with Jest
// To run: npm test -- fee-calculations.test.ts
