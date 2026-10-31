const { expect } = require("chai");
const { ethers } = require("hardhat");

function toBytes32(value) {
  return ethers.utils.keccak256(ethers.utils.toUtf8Bytes(value));
}

describe("BatchRegistry", function () {
  let registry;
  let admin;
  let manufacturer;
  let distributor;
  let pharmacy;
  let oracle;
  let outsider;
  let batchId;

  beforeEach(async function () {
    [admin, manufacturer, distributor, pharmacy, oracle, outsider] = await ethers.getSigners();
    const BatchRegistry = await ethers.getContractFactory("BatchRegistry");
    registry = await BatchRegistry.deploy();
    await registry.deployed();
    await registry.grantManufacturerRole(manufacturer.address);
    await registry.grantDistributorRole(distributor.address);
    await registry.grantPharmacyRole(pharmacy.address);
    await registry.grantTelemetryOracleRole(oracle.address);

    const tx = await registry.connect(manufacturer).createBatch("Test Vaccine");
    const receipt = await tx.wait();
    batchId = receipt.events.find((event) => event.event === "BatchCreated").args.batchId;
  });

  it("creates a batch with manufacturer as initial custodian", async function () {
    const batch = await registry.getBatchDetails(batchId);
    expect(batch.drugName).to.equal("Test Vaccine");
    expect(batch.manufacturer).to.equal(manufacturer.address);
    expect(batch.currentCustodian).to.equal(manufacturer.address);
    expect(batch.state).to.equal(0);
  });

  it("records custody provenance and updates the current custodian", async function () {
    await expect(registry.connect(manufacturer).transferBatch(batchId, distributor.address))
      .to.emit(registry, "CustodyTransferred");

    const batch = await registry.getBatchDetails(batchId);
    expect(batch.currentCustodian).to.equal(distributor.address);
    expect(batch.state).to.equal(2);

    const history = await registry.getCustodyHistory(batchId);
    expect(history.length).to.equal(1);
    expect(history[0].from).to.equal(manufacturer.address);
    expect(history[0].to).to.equal(distributor.address);
  });

  it("prevents an outsider from transferring custody", async function () {
    await expect(registry.connect(outsider).transferBatch(batchId, pharmacy.address))
      .to.be.revertedWith("Caller not authorized to transfer");
  });

  it("allows the current pharmacy custodian to confirm delivery", async function () {
    await registry.connect(manufacturer).transferBatch(batchId, pharmacy.address);
    await expect(registry.connect(pharmacy).confirmDelivery(batchId)).to.emit(registry, "StateChanged");
    expect((await registry.getBatchDetails(batchId)).state).to.equal(3);
  });

  it("records unsafe signed telemetry evidence and breaches the batch", async function () {
    const evidenceHash = toBytes32("signed-reading-12c");
    await expect(registry.connect(oracle).recordTemperature(batchId, 1200, Math.floor(Date.now() / 1000), oracle.address, evidenceHash))
      .to.emit(registry, "TemperatureBreachRecorded");

    const breaches = await registry.getBreachHistory(batchId);
    expect(breaches.length).to.equal(1);
    expect(breaches[0].temperatureCenti).to.equal(1200);
    expect(breaches[0].sensor).to.equal(oracle.address);
    expect(breaches[0].evidenceHash).to.equal(evidenceHash);
    expect((await registry.getBatchDetails(batchId)).state).to.equal(1);
  });

  it("does not create a breach record for safe telemetry", async function () {
    const result = await registry.connect(oracle).recordTemperature(batchId, 450, Math.floor(Date.now() / 1000), oracle.address, toBytes32("safe-reading"));
    await result.wait();
    expect(await registry.getBreachCount(batchId)).to.equal(0);
    expect((await registry.getBatchDetails(batchId)).state).to.equal(0);
  });

  it("rejects unauthorized oracle writes and tampered evidence values", async function () {
    const evidenceHash = toBytes32("reading");
    await expect(registry.connect(outsider).recordTemperature(batchId, 1200, Math.floor(Date.now() / 1000), outsider.address, evidenceHash))
      .to.be.revertedWith("Caller is not a telemetry oracle");
    await expect(registry.connect(oracle).recordTemperature(batchId, 1200, Math.floor(Date.now() / 1000), oracle.address, ethers.constants.HashZero))
      .to.be.revertedWith("Evidence hash required");
  });

  it("blocks lifecycle actions after a breach", async function () {
    await registry.connect(oracle).recordTemperature(batchId, 1200, Math.floor(Date.now() / 1000), oracle.address, toBytes32("breach"));
    await expect(registry.connect(manufacturer).transferBatch(batchId, distributor.address)).to.be.revertedWith("Batch is breached");
    await expect(registry.connect(pharmacy).confirmDelivery(batchId)).to.be.revertedWith("Batch is breached");
  });
});
