// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title MediTrace access control
/// @notice Small role manager used by BatchRegistry. The deployer is the initial admin.
contract AccessManager {
    bytes32 public constant DEFAULT_ADMIN_ROLE = keccak256("DEFAULT_ADMIN_ROLE");
    bytes32 public constant MANUFACTURER_ROLE = keccak256("MANUFACTURER_ROLE");
    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");
    bytes32 public constant PHARMACY_ROLE = keccak256("PHARMACY_ROLE");
    bytes32 public constant TELEMETRY_ORACLE_ROLE = keccak256("TELEMETRY_ORACLE_ROLE");

    mapping(address => mapping(bytes32 => bool)) private _hasRole;

    event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender);
    event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender);

    modifier onlyAdmin() {
        require(_hasRole[msg.sender][DEFAULT_ADMIN_ROLE], "Caller is not an admin");
        _;
    }

    constructor() {
        _hasRole[msg.sender][DEFAULT_ADMIN_ROLE] = true;
        emit RoleGranted(DEFAULT_ADMIN_ROLE, msg.sender, msg.sender);
    }

    function grantRole(bytes32 role, address account) public onlyAdmin {
        require(account != address(0), "Cannot grant role to zero address");
        _hasRole[account][role] = true;
        emit RoleGranted(role, account, msg.sender);
    }

    function revokeRole(bytes32 role, address account) public onlyAdmin {
        _hasRole[account][role] = false;
        emit RoleRevoked(role, account, msg.sender);
    }

    function grantManufacturerRole(address account) external { grantRole(MANUFACTURER_ROLE, account); }
    function grantDistributorRole(address account) external { grantRole(DISTRIBUTOR_ROLE, account); }
    function grantPharmacyRole(address account) external { grantRole(PHARMACY_ROLE, account); }
    function grantTelemetryOracleRole(address account) external { grantRole(TELEMETRY_ORACLE_ROLE, account); }

    function revokeManufacturerRole(address account) external onlyAdmin { revokeRole(MANUFACTURER_ROLE, account); }
    function revokeDistributorRole(address account) external onlyAdmin { revokeRole(DISTRIBUTOR_ROLE, account); }
    function revokePharmacyRole(address account) external onlyAdmin { revokeRole(PHARMACY_ROLE, account); }
    function revokeTelemetryOracleRole(address account) external onlyAdmin { revokeRole(TELEMETRY_ORACLE_ROLE, account); }

    function hasRole(bytes32 role, address account) public view returns (bool) {
        return _hasRole[account][role];
    }
}
