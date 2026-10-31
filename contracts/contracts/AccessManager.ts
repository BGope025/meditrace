import { Contract } from '@algorandfoundation/tealscript';

/**
 * MediTrace Access Control Contract (Algorand TEALScript)
 *
 * Small role manager used by MediTraceBatchRegistry.
 * The creator (deployer) is the initial admin.
 *
 * Roles are stored as per-address flags in BoxMap storage,
 * keyed by Address. Each address maps to a uint64 bitmask
 * representing assigned roles.
 *
 * Role bit positions:
 *   bit 0 (1)  = DEFAULT_ADMIN_ROLE
 *   bit 1 (2)  = MANUFACTURER_ROLE
 *   bit 2 (4)  = DISTRIBUTOR_ROLE
 *   bit 3 (8)  = PHARMACY_ROLE
 *   bit 4 (16) = TELEMETRY_ORACLE_ROLE
 */
export class AccessManager extends Contract {
  // ── Role bit constants ──────────────────────────────────────────
  //    Stored as global state so ABI callers can read them.
  ADMIN_BIT = GlobalStateKey<uint64>({ key: 'ADMIN_BIT' });
  MANUFACTURER_BIT = GlobalStateKey<uint64>({ key: 'MFR_BIT' });
  DISTRIBUTOR_BIT = GlobalStateKey<uint64>({ key: 'DIST_BIT' });
  PHARMACY_BIT = GlobalStateKey<uint64>({ key: 'PHARM_BIT' });
  ORACLE_BIT = GlobalStateKey<uint64>({ key: 'ORACLE_BIT' });

  /** The deployer / admin address */
  admin = GlobalStateKey<Address>({ key: 'admin' });

  /**
   * Role bitmask per address.
   * Each address maps to a uint64 where set bits represent granted roles.
   */
  roles = BoxMap<Address, uint64>({ prefix: 'r' });

  // ── Lifecycle ───────────────────────────────────────────────────

  /** Called once on app creation. Sets the creator as admin. */
  createApplication(): void {
    this.admin.value = this.txn.sender;
    this.ADMIN_BIT.value = 1;
    this.MANUFACTURER_BIT.value = 2;
    this.DISTRIBUTOR_BIT.value = 4;
    this.PHARMACY_BIT.value = 8;
    this.ORACLE_BIT.value = 16;
  }

  // ── Internal helpers ────────────────────────────────────────────

  /** Assert that the transaction sender is an admin. */
  private assertAdmin(): void {
    assert(
      this.txn.sender === this.admin.value ||
        (this.roles(this.txn.sender).exists &&
          (this.roles(this.txn.sender).value & this.ADMIN_BIT.value) !== 0),
      'Caller is not an admin'
    );
  }

  /** Check whether an address holds a specific role bit. */
  private addressHasRole(account: Address, roleBit: uint64): boolean {
    if (!this.roles(account).exists) return false;
    return (this.roles(account).value & roleBit) !== 0;
  }

  // ── Generic grant / revoke ──────────────────────────────────────

  /**
   * Grant a role (by bit) to an account. Admin-only.
   *
   * @param role - The role bit to grant (1, 2, 4, 8, or 16).
   * @param account - The target account address.
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
   * Revoke a role (by bit) from an account. Admin-only.
   *
   * @param role - The role bit to revoke.
   * @param account - The target account address.
   */
  revokeRole(role: uint64, account: Address): void {
    this.assertAdmin();

    if (this.roles(account).exists) {
      this.roles(account).value = this.roles(account).value & ~role;
    }

    log('RoleRevoked');
  }

  // ── Convenience grant methods ───────────────────────────────────

  grantManufacturerRole(account: Address): void {
    this.grantRole(this.MANUFACTURER_BIT.value, account);
  }

  grantDistributorRole(account: Address): void {
    this.grantRole(this.DISTRIBUTOR_BIT.value, account);
  }

  grantPharmacyRole(account: Address): void {
    this.grantRole(this.PHARMACY_BIT.value, account);
  }

  grantTelemetryOracleRole(account: Address): void {
    this.grantRole(this.ORACLE_BIT.value, account);
  }

  // ── Convenience revoke methods ──────────────────────────────────

  revokeManufacturerRole(account: Address): void {
    this.revokeRole(this.MANUFACTURER_BIT.value, account);
  }

  revokeDistributorRole(account: Address): void {
    this.revokeRole(this.DISTRIBUTOR_BIT.value, account);
  }

  revokePharmacyRole(account: Address): void {
    this.revokeRole(this.PHARMACY_BIT.value, account);
  }

  revokeTelemetryOracleRole(account: Address): void {
    this.revokeRole(this.ORACLE_BIT.value, account);
  }

  // ── View methods ────────────────────────────────────────────────

  /**
   * Check whether an account holds a specific role.
   *
   * @param role - The role bit to check.
   * @param account - The account address.
   * @returns true if the account holds the role.
   */
  hasRole(role: uint64, account: Address): boolean {
    return this.addressHasRole(account, role);
  }

  /**
   * Returns the full role bitmask for an account.
   */
  getRoleMask(account: Address): uint64 {
    if (!this.roles(account).exists) return 0;
    return this.roles(account).value;
  }

  /**
   * Returns the admin address.
   */
  getAdmin(): Address {
    return this.admin.value;
  }
}
