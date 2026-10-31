// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./AccessManager.sol";

/// @title MediTrace batch provenance registry
/// @notice Stores batch lifecycle, custody handoffs, and tamper-evident temperature evidence.
contract BatchRegistry is AccessManager {
    enum BatchState { Active, Breached, Transferred, Delivered }

    uint256 public constant SAFE_MIN_TEMPERATURE_CENTI = 200; // 2.00°C
    uint256 public constant SAFE_MAX_TEMPERATURE_CENTI = 800; // 8.00°C
    uint256 public constant MAX_FUTURE_OBSERVATION_WINDOW = 5 minutes;

    struct Batch {
        string drugName;
        address manufacturer;
        address currentCustodian;
        BatchState state;
        uint256 timestamp;
        uint256 lastUpdatedAt;
    }

    struct CustodyRecord {
        address from;
        address to;
        address actor;
        uint256 timestamp;
    }

    struct BreachRecord {
        int256 temperatureCenti;
        uint256 observedAt;
        uint256 recordedAt;
        address sensor;
        bytes32 evidenceHash;
    }

    mapping(uint256 => Batch) public batches;
    mapping(uint256 => CustodyRecord[]) private _custodyHistory;
    mapping(uint256 => BreachRecord[]) private _breachHistory;
    uint256 public nextBatchId = 1;

    event BatchCreated(uint256 indexed batchId, string drugName, address indexed manufacturer, uint256 timestamp);
    event StateChanged(uint256 indexed batchId, BatchState oldState, BatchState newState, uint256 timestamp);
    event CustodyTransferred(uint256 indexed batchId, address indexed from, address indexed to, address actor, uint256 timestamp);
    event TemperatureRecorded(uint256 indexed batchId, int256 temperatureCenti, uint256 observedAt, address indexed sensor, bytes32 evidenceHash);
    event TemperatureBreachRecorded(uint256 indexed batchId, int256 temperatureCenti, uint256 observedAt, address indexed sensor, bytes32 evidenceHash);

    modifier batchExists(uint256 batchId) {
        require(batchId > 0 && batchId < nextBatchId, "Batch does not exist");
        _;
    }

    modifier onlyManufacturer() {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender) || hasRole(MANUFACTURER_ROLE, msg.sender), "Caller is not a manufacturer");
        _;
    }

    modifier notBreached(uint256 batchId) {
        require(batches[batchId].state != BatchState.Breached, "Batch is breached");
        _;
    }

    modifier onlyTelemetryOracle() {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender) || hasRole(TELEMETRY_ORACLE_ROLE, msg.sender), "Caller is not a telemetry oracle");
        _;
    }

    function createBatch(string calldata drugName) external onlyManufacturer returns (uint256 batchId) {
        require(bytes(drugName).length > 0 && bytes(drugName).length <= 256, "Invalid drug name");
        batchId = nextBatchId++;
        batches[batchId] = Batch({
            drugName: drugName,
            manufacturer: msg.sender,
            currentCustodian: msg.sender,
            state: BatchState.Active,
            timestamp: block.timestamp,
            lastUpdatedAt: block.timestamp
        });
        emit BatchCreated(batchId, drugName, msg.sender, block.timestamp);
    }

    /// @notice Legacy/manual breach method retained for backend compatibility.
    function flagBreach(uint256 batchId) external batchExists(batchId) notBreached(batchId) {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender) ||
            hasRole(MANUFACTURER_ROLE, msg.sender) ||
            hasRole(TELEMETRY_ORACLE_ROLE, msg.sender),
            "Caller cannot flag breach"
        );
        _setBreached(batchId);
    }

    /// @notice Records the signed sensor reading digest on-chain and breaches unsafe batches.
    /// @param temperatureCenti Temperature in hundredths of a degree Celsius (e.g. 450 = 4.50°C).
    /// @param observedAt Original sensor observation time.
    /// @param sensor Sensor wallet that produced the reading.
    /// @param evidenceHash keccak256 hash of the exact signed telemetry payload.
    function recordTemperature(
        uint256 batchId,
        int256 temperatureCenti,
        uint256 observedAt,
        address sensor,
        bytes32 evidenceHash
    ) external batchExists(batchId) onlyTelemetryOracle returns (bool isSafe) {
        require(sensor != address(0), "Sensor cannot be zero address");
        require(evidenceHash != bytes32(0), "Evidence hash required");
        require(observedAt <= block.timestamp + MAX_FUTURE_OBSERVATION_WINDOW, "Observation is too far in future");

        isSafe = temperatureCenti >= int256(SAFE_MIN_TEMPERATURE_CENTI) && temperatureCenti <= int256(SAFE_MAX_TEMPERATURE_CENTI);
        emit TemperatureRecorded(batchId, temperatureCenti, observedAt, sensor, evidenceHash);
        if (!isSafe) {
            _breachHistory[batchId].push(BreachRecord({
                temperatureCenti: temperatureCenti,
                observedAt: observedAt,
                recordedAt: block.timestamp,
                sensor: sensor,
                evidenceHash: evidenceHash
            }));
            emit TemperatureBreachRecorded(batchId, temperatureCenti, observedAt, sensor, evidenceHash);
            if (batches[batchId].state != BatchState.Breached) _setBreached(batchId);
        }
    }

    function transferBatch(uint256 batchId, address newCustodian) external batchExists(batchId) notBreached(batchId) {
        require(newCustodian != address(0), "Custodian cannot be zero address");
        require(
            msg.sender == batches[batchId].currentCustodian ||
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender) ||
            hasRole(MANUFACTURER_ROLE, msg.sender) ||
            hasRole(DISTRIBUTOR_ROLE, msg.sender) ||
            hasRole(PHARMACY_ROLE, msg.sender),
            "Caller not authorized to transfer"
        );

        address previousCustodian = batches[batchId].currentCustodian;
        batches[batchId].currentCustodian = newCustodian;
        batches[batchId].lastUpdatedAt = block.timestamp;
        if (batches[batchId].state != BatchState.Transferred) _setState(batchId, BatchState.Transferred);
        _custodyHistory[batchId].push(CustodyRecord(previousCustodian, newCustodian, msg.sender, block.timestamp));
        emit CustodyTransferred(batchId, previousCustodian, newCustodian, msg.sender, block.timestamp);
    }

    function confirmDelivery(uint256 batchId) external batchExists(batchId) notBreached(batchId) {
        require(hasRole(PHARMACY_ROLE, msg.sender), "Only pharmacy can confirm delivery");
        require(batches[batchId].currentCustodian == msg.sender || hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Caller is not current custodian");
        _setState(batchId, BatchState.Delivered);
    }

    function getBatch(uint256 batchId) external view batchExists(batchId) returns (
        string memory drugName,
        address manufacturer,
        uint8 state,
        uint256 timestamp
    ) {
        Batch memory batch = batches[batchId];
        return (batch.drugName, batch.manufacturer, uint8(batch.state), batch.timestamp);
    }

    function getBatchDetails(uint256 batchId) external view batchExists(batchId) returns (Batch memory) {
        return batches[batchId];
    }

    function getCustodyHistory(uint256 batchId) external view batchExists(batchId) returns (CustodyRecord[] memory) {
        return _custodyHistory[batchId];
    }

    function getBreachHistory(uint256 batchId) external view batchExists(batchId) returns (BreachRecord[] memory) {
        return _breachHistory[batchId];
    }

    function getBreachCount(uint256 batchId) external view batchExists(batchId) returns (uint256) {
        return _breachHistory[batchId].length;
    }

    function _setBreached(uint256 batchId) internal {
        _setState(batchId, BatchState.Breached);
    }

    function _setState(uint256 batchId, BatchState newState) internal {
        BatchState oldState = batches[batchId].state;
        batches[batchId].state = newState;
        batches[batchId].lastUpdatedAt = block.timestamp;
        emit StateChanged(batchId, oldState, newState, block.timestamp);
    }
}
