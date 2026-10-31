import { Contract } from '@algorandfoundation/tealscript';

// ─── Type aliases for AVM-compatible types ────────────────────────
// TEALScript maps these to native AVM types at compile time.

/**
 * Batch state enum encoded as uint64 for AVM compatibility.
 *   0 = Active
 *   1 = Breached
 *   2 = Transferred
 *   3 = Delivered
 */
type BatchState = uint64;

// ── Constants ─────────────────────────────────────────────────────
const STATE_ACTIVE: BatchState = 0;
const STATE_BREACHED: BatchState = 1;
const STATE_TRANSFERRED: BatchState = 2;
const STATE_DELIVERED: BatchState = 3;

// Role bitmask constants (must match AccessManager)
const ADMIN_BIT: uint64 = 1;
const MANUFACTURER_BIT: uint64 = 2;
const DISTRIBUTOR_BIT: uint64 = 4;
const PHARMACY_BIT: uint64 = 8;
const ORACLE_BIT: uint64 = 16;

// Temperature safe range in centi-degrees (2.00 °C – 8.00 °C)
const SAFE_MIN_TEMPERATURE_CENTI: uint64 = 200;
const SAFE_MAX_TEMPERATURE_CENTI: uint64 = 800;

// Maximum seconds an observation timestamp may be ahead of current round time
const MAX_FUTURE_OBSERVATION_WINDOW: uint64 = 300; // 5 minutes

/**
 * MediTrace Batch Provenance Registry (Algorand TEALScript)
 *
 * Stores batch lifecycle, custody handoffs, and tamper-evident
 * temperature evidence entirely on-chain using Algorand boxes.
 *
 * This contract embeds AccessManager role logic directly (single
 * contract deployment) because TEALScript contracts compile to
 * one AVM application each. Role state is shared via the same
 * BoxMap used by AccessManager logic below.
 *
 * ── Algorand Testnet Rules Applied ──
 * • All storage uses Box storage (BoxMap) — no global/local state
 *   limits exceeded.
 * • Method selectors follow ARC-4 ABI routing.
 * • Temperature values use uint64/int (AVM-native); negative temps
 *   are handled as signed 64-bit via two's complement.
 * • Timestamps use the latest confirmed block timestamp
 *   (`globals.latestTimestamp`).
 * • Atomic group transactions can be used for multi-step operations.
 * • All string data is stored as bytes to respect AVM constraints.
 * • Box MBR (Minimum Balance Requirement) is managed by callers via
 *   payment transactions in the group.
 */
export class BatchRegistry extends Contract {
  // ═══════════════════════════════════════════════════════════════
  //  ACCESS MANAGER STATE (embedded)
  // ═══════════════════════════════════════════════════════════════

  admin = GlobalStateKey<Address>({ key: 'admin' });

  /** Per-address role bitmask — same schema as AccessManager. */
  roles = BoxMap<Address, uint64>({ prefix: 'r' });

  // ═══════════════════════════════════════════════════════════════
  //  BATCH REGISTRY STATE
  // ═══════════════════════════════════════════════════════════════

  /** Auto-incrementing batch ID counter. */
  nextBatchId = GlobalStateKey<uint64>({ key: 'nextId' });

  // ── Per-batch core fields ───────────────────────────────────────
  // Using individual BoxMaps keyed by batch ID for each field,
  // because TEALScript does not support nested structs in boxes.

  batchDrugName = BoxMap<uint64, bytes>({ prefix: 'bn', dynamicSize: true });
  batchManufacturer = BoxMap<uint64, Address>({ prefix: 'bm' });
  batchCustodian = BoxMap<uint64, Address>({ prefix: 'bc' });
  batchState = BoxMap<uint64, uint64>({ prefix: 'bs' });
  batchCreatedAt = BoxMap<uint64, uint64>({ prefix: 'bt' });
  batchUpdatedAt = BoxMap<uint64, uint64>({ prefix: 'bu' });

  // ── Per-batch counters for history arrays ───────────────────────
  custodyCount = BoxMap<uint64, uint64>({ prefix: 'cc' });
  breachCount = BoxMap<uint64, uint64>({ prefix: 'xc' });

  // ── Custody history: composite key = batchId * 1_000_000 + index
  custodyFrom = BoxMap<uint64, Address>({ prefix: 'cf' });
  custodyTo = BoxMap<uint64, Address>({ prefix: 'ct' });
  custodyActor = BoxMap<uint64, Address>({ prefix: 'ca' });
  custodyTimestamp = BoxMap<uint64, uint64>({ prefix: 'cs' });

  // ── Breach history: composite key = batchId * 1_000_000 + index
  breachTemp = BoxMap<uint64, uint64>({ prefix: 'xt' });
  breachObservedAt = BoxMap<uint64, uint64>({ prefix: 'xo' });
  breachRecordedAt = BoxMap<uint64, uint64>({ prefix: 'xr' });
  breachSensor = BoxMap<uint64, Address>({ prefix: 'xs' });
  breachEvidenceHash = BoxMap<uint64, bytes32>({ prefix: 'xe' });

  // ═══════════════════════════════════════════════════════════════
  //  LIFECYCLE
  // ═══════════════════════════════════════════════════════════════

  /** Called once at app creation. Deployer becomes admin. */
  createApplication(): void {
    this.admin.value = this.txn.sender;
    this.nextBatchId.value = 1;
  }

  // ═══════════════════════════════════════════════════════════════
  //  ACCESS CONTROL METHODS
  // ═══════════════════════════════════════════════════════════════

  private assertAdmin(): void {
    assert(
      this.txn.sender === this.admin.value ||
        (this.roles(this.txn.sender).exists &&
          (this.roles(this.txn.sender).value & ADMIN_BIT) !== 0),
      'Caller is not an admin'
    );
  }

  private callerHasRole(roleBit: uint64): boolean {
    if (this.txn.sender === this.admin.value) return true;
    if (!this.roles(this.txn.sender).exists) return false;
    return (this.roles(this.txn.sender).value & roleBit) !== 0;
  }

  private addressHasRole(account: Address, roleBit: uint64): boolean {
    if (!this.roles(account).exists) return false;
    return (this.roles(account).value & roleBit) !== 0;
  }

  /**
   * Grant a role bitmask to an account. Admin-only.
   */
  grantRole(role: uint64, account: Address): void {
    this.assertAdmin();
    assert(account !== globals.zeroAddress, 'Cannot grant role to zero address');
    let current: uint64 = 0;
    if (this.roles(account).exists) {
      current = this.roles(account).value;
    }
    this.roles(account).value = current | role;
    log('RoleGranted');
  }

  /**
   * Revoke a role bitmask from an account. Admin-only.
   */
  revokeRole(role: uint64, account: Address): void {
    this.assertAdmin();
    if (this.roles(account).exists) {
      this.roles(account).value = this.roles(account).value & ~role;
    }
    log('RoleRevoked');
  }

  // Convenience role methods
  grantManufacturerRole(account: Address): void {
    this.grantRole(MANUFACTURER_BIT, account);
  }
  grantDistributorRole(account: Address): void {
    this.grantRole(DISTRIBUTOR_BIT, account);
  }
  grantPharmacyRole(account: Address): void {
    this.grantRole(PHARMACY_BIT, account);
  }
  grantTelemetryOracleRole(account: Address): void {
    this.grantRole(ORACLE_BIT, account);
  }

  revokeManufacturerRole(account: Address): void {
    this.revokeRole(MANUFACTURER_BIT, account);
  }
  revokeDistributorRole(account: Address): void {
    this.revokeRole(DISTRIBUTOR_BIT, account);
  }
  revokePharmacyRole(account: Address): void {
    this.revokeRole(PHARMACY_BIT, account);
  }
  revokeTelemetryOracleRole(account: Address): void {
    this.revokeRole(ORACLE_BIT, account);
  }

  /**
   * Check whether an account holds a specific role.
   */
  hasRole(role: uint64, account: Address): boolean {
    return this.addressHasRole(account, role);
  }

  // ═══════════════════════════════════════════════════════════════
  //  BATCH CREATION
  // ═══════════════════════════════════════════════════════════════

  /**
   * Create a new medicine batch. Only manufacturers or admins.
   *
   * @param drugName - Name of the drug (max 256 bytes).
   * @returns batchId - The assigned batch ID.
   */
  createBatch(drugName: string): uint64 {
    // Caller must be admin or manufacturer
    assert(
      this.callerHasRole(ADMIN_BIT) || this.callerHasRole(MANUFACTURER_BIT),
      'Caller is not a manufacturer'
    );
    const nameBytes = rawBytes(drugName);
    assert(len(nameBytes) > 0 && len(nameBytes) <= 256, 'Invalid drug name');

    const batchId = this.nextBatchId.value;
    this.nextBatchId.value = batchId + 1;

    this.batchDrugName(batchId).value = nameBytes;
    this.batchManufacturer(batchId).value = this.txn.sender;
    this.batchCustodian(batchId).value = this.txn.sender;
    this.batchState(batchId).value = STATE_ACTIVE;
    this.batchCreatedAt(batchId).value = globals.latestTimestamp;
    this.batchUpdatedAt(batchId).value = globals.latestTimestamp;
    this.custodyCount(batchId).value = 0;
    this.breachCount(batchId).value = 0;

    log('BatchCreated');
    return batchId;
  }

  // ═══════════════════════════════════════════════════════════════
  //  BATCH STATE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════

  private assertBatchExists(batchId: uint64): void {
    assert(batchId > 0 && batchId < this.nextBatchId.value, 'Batch does not exist');
  }

  private assertNotBreached(batchId: uint64): void {
    assert(this.batchState(batchId).value !== STATE_BREACHED, 'Batch is breached');
  }

  private setBatchState(batchId: uint64, newState: uint64): void {
    this.batchState(batchId).value = newState;
    this.batchUpdatedAt(batchId).value = globals.latestTimestamp;
    log('StateChanged');
  }

  // ═══════════════════════════════════════════════════════════════
  //  TEMPERATURE RECORDING & BREACH DETECTION
  // ═══════════════════════════════════════════════════════════════

  /**
   * Legacy/manual breach method retained for backend compatibility.
   * Only admin, manufacturer, or oracle can flag a breach.
   */
  flagBreach(batchId: uint64): void {
    this.assertBatchExists(batchId);
    this.assertNotBreached(batchId);
    assert(
      this.callerHasRole(ADMIN_BIT) ||
        this.callerHasRole(MANUFACTURER_BIT) ||
        this.callerHasRole(ORACLE_BIT),
      'Caller cannot flag breach'
    );
    this.setBatchState(batchId, STATE_BREACHED);
  }

  /**
   * Records a signed sensor reading digest on-chain and auto-breaches
   * if the temperature is outside the safe range [2.00 °C, 8.00 °C].
   *
   * Temperature is in hundredths of a degree (e.g. 450 = 4.50 °C).
   * For the AVM, we pass temperature as uint64; values above a threshold
   * (e.g. > SAFE_MAX) are treated as out of range. Negative temperatures
   * should be encoded as very large uint64 values and will always breach.
   *
   * @param batchId - The batch to record against.
   * @param temperatureCenti - Temp in 1/100 °C (uint64 encoding).
   * @param observedAt - Sensor observation timestamp (unix seconds).
   * @param sensor - Sensor account address.
   * @param evidenceHash - keccak256 of the signed telemetry payload.
   * @returns isSafe - Whether the reading is within the safe range.
   */
  recordTemperature(
    batchId: uint64,
    temperatureCenti: uint64,
    observedAt: uint64,
    sensor: Address,
    evidenceHash: bytes32
  ): boolean {
    this.assertBatchExists(batchId);

    // Only admin or oracle
    assert(
      this.callerHasRole(ADMIN_BIT) || this.callerHasRole(ORACLE_BIT),
      'Caller is not a telemetry oracle'
    );
    assert(sensor !== globals.zeroAddress, 'Sensor cannot be zero address');
    assert(evidenceHash !== bzero(32) as bytes32, 'Evidence hash required');
    assert(
      observedAt <= globals.latestTimestamp + MAX_FUTURE_OBSERVATION_WINDOW,
      'Observation is too far in future'
    );

    const isSafe =
      temperatureCenti >= SAFE_MIN_TEMPERATURE_CENTI &&
      temperatureCenti <= SAFE_MAX_TEMPERATURE_CENTI;

    log('TemperatureRecorded');

    if (!isSafe) {
      // Store breach record
      const idx = this.breachCount(batchId).value;
      const key = batchId * 1_000_000 + idx;

      this.breachTemp(key).value = temperatureCenti;
      this.breachObservedAt(key).value = observedAt;
      this.breachRecordedAt(key).value = globals.latestTimestamp;
      this.breachSensor(key).value = sensor;
      this.breachEvidenceHash(key).value = evidenceHash;

      this.breachCount(batchId).value = idx + 1;

      log('TemperatureBreachRecorded');

      if (this.batchState(batchId).value !== STATE_BREACHED) {
        this.setBatchState(batchId, STATE_BREACHED);
      }
    }

    return isSafe;
  }

  // ═══════════════════════════════════════════════════════════════
  //  CUSTODY TRANSFER
  // ═══════════════════════════════════════════════════════════════

  /**
   * Transfer batch custody to a new custodian.
   * Allowed for: current custodian, admin, manufacturer, distributor, pharmacy.
   */
  transferBatch(batchId: uint64, newCustodian: Address): void {
    this.assertBatchExists(batchId);
    this.assertNotBreached(batchId);
    assert(newCustodian !== globals.zeroAddress, 'Custodian cannot be zero address');

    const isCustodian = this.txn.sender === this.batchCustodian(batchId).value;
    assert(
      isCustodian ||
        this.callerHasRole(ADMIN_BIT) ||
        this.callerHasRole(MANUFACTURER_BIT) ||
        this.callerHasRole(DISTRIBUTOR_BIT) ||
        this.callerHasRole(PHARMACY_BIT),
      'Caller not authorized to transfer'
    );

    const previousCustodian = this.batchCustodian(batchId).value;
    this.batchCustodian(batchId).value = newCustodian;
    this.batchUpdatedAt(batchId).value = globals.latestTimestamp;

    if (this.batchState(batchId).value !== STATE_TRANSFERRED) {
      this.setBatchState(batchId, STATE_TRANSFERRED);
    }

    // Record custody history
    const idx = this.custodyCount(batchId).value;
    const key = batchId * 1_000_000 + idx;

    this.custodyFrom(key).value = previousCustodian;
    this.custodyTo(key).value = newCustodian;
    this.custodyActor(key).value = this.txn.sender;
    this.custodyTimestamp(key).value = globals.latestTimestamp;

    this.custodyCount(batchId).value = idx + 1;

    log('CustodyTransferred');
  }

  // ═══════════════════════════════════════════════════════════════
  //  DELIVERY CONFIRMATION
  // ═══════════════════════════════════════════════════════════════

  /**
   * Pharmacy confirms final delivery of a batch.
   * Only a pharmacy-role holder who is the current custodian (or admin).
   */
  confirmDelivery(batchId: uint64): void {
    this.assertBatchExists(batchId);
    this.assertNotBreached(batchId);
    assert(this.callerHasRole(PHARMACY_BIT), 'Only pharmacy can confirm delivery');
    assert(
      this.batchCustodian(batchId).value === this.txn.sender ||
        this.callerHasRole(ADMIN_BIT),
      'Caller is not current custodian'
    );
    this.setBatchState(batchId, STATE_DELIVERED);
  }

  // ═══════════════════════════════════════════════════════════════
  //  VIEW / READ METHODS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get core batch info (drug name, manufacturer, state, created timestamp).
   */
  getBatch(batchId: uint64): [bytes, Address, uint64, uint64] {
    this.assertBatchExists(batchId);
    return [
      this.batchDrugName(batchId).value,
      this.batchManufacturer(batchId).value,
      this.batchState(batchId).value,
      this.batchCreatedAt(batchId).value,
    ];
  }

  /**
   * Get full batch details.
   */
  getBatchDetails(
    batchId: uint64
  ): [bytes, Address, Address, uint64, uint64, uint64] {
    this.assertBatchExists(batchId);
    return [
      this.batchDrugName(batchId).value,
      this.batchManufacturer(batchId).value,
      this.batchCustodian(batchId).value,
      this.batchState(batchId).value,
      this.batchCreatedAt(batchId).value,
      this.batchUpdatedAt(batchId).value,
    ];
  }

  /**
   * Get a single custody record by batch ID and index.
   */
  getCustodyRecord(
    batchId: uint64,
    index: uint64
  ): [Address, Address, Address, uint64] {
    this.assertBatchExists(batchId);
    assert(index < this.custodyCount(batchId).value, 'Index out of range');
    const key = batchId * 1_000_000 + index;
    return [
      this.custodyFrom(key).value,
      this.custodyTo(key).value,
      this.custodyActor(key).value,
      this.custodyTimestamp(key).value,
    ];
  }

  /**
   * Get a single breach record by batch ID and index.
   */
  getBreachRecord(
    batchId: uint64,
    index: uint64
  ): [uint64, uint64, uint64, Address, bytes32] {
    this.assertBatchExists(batchId);
    assert(index < this.breachCount(batchId).value, 'Index out of range');
    const key = batchId * 1_000_000 + index;
    return [
      this.breachTemp(key).value,
      this.breachObservedAt(key).value,
      this.breachRecordedAt(key).value,
      this.breachSensor(key).value,
      this.breachEvidenceHash(key).value,
    ];
  }

  /**
   * Get the number of custody transfers for a batch.
   */
  getCustodyCount(batchId: uint64): uint64 {
    this.assertBatchExists(batchId);
    return this.custodyCount(batchId).value;
  }

  /**
   * Get the number of breach records for a batch.
   */
  getBreachCount(batchId: uint64): uint64 {
    this.assertBatchExists(batchId);
    return this.breachCount(batchId).value;
  }
}
