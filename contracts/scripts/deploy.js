const hre = require("hardhat");
require("dotenv").config();

async function main() {
  const [deployer, manufacturer, distributor, pharmacy, oracle] = await hre.ethers.getSigners();
  const BatchRegistry = await hre.ethers.getContractFactory("BatchRegistry");
  const registry = await BatchRegistry.deploy();
  await registry.deployed();

  const roleAddresses = {
    manufacturer: process.env.MANUFACTURER_ADDRESS || manufacturer.address,
    distributor: process.env.DISTRIBUTOR_ADDRESS || distributor.address,
    pharmacy: process.env.PHARMACY_ADDRESS || pharmacy.address,
    oracle: process.env.TELEMETRY_ORACLE_ADDRESS || oracle.address
  };

  await (await registry.grantManufacturerRole(roleAddresses.manufacturer)).wait();
  await (await registry.grantDistributorRole(roleAddresses.distributor)).wait();
  await (await registry.grantPharmacyRole(roleAddresses.pharmacy)).wait();
  await (await registry.grantTelemetryOracleRole(roleAddresses.oracle)).wait();

  console.log(JSON.stringify({
    network: hre.network.name,
    batchRegistryAddress: registry.address,
    deployer: deployer.address,
    roles: roleAddresses
  }, null, 2));
  console.log("Set BATCH_REGISTRY_ADDRESS to", registry.address);
  console.log("Set TELEMETRY_ORACLE_ADDRESS to the backend signer address when using recordTemperature.");
}

main().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });
