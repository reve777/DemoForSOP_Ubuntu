const { deployProxy } = require('@openzeppelin/truffle-upgrades');

const DEMO = artifacts.require("DEMO");
const GMR = artifacts.require("GMR");

module.exports = async function (deployer) {
  const demo = await deployProxy(DEMO, [], { deployer });
  console.log("DEMO proxy deployed at:", demo.address);

  const gmr = await deployProxy(GMR, [], { deployer });
  console.log("GMR proxy deployed at:", gmr.address);
};