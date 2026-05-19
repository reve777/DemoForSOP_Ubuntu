const { upgradeProxy } = require('@openzeppelin/truffle-upgrades');
const fs = require('fs');
const path = require('path');

const DEMO = artifacts.require("DEMO");
const GMR  = artifacts.require("GMR");

module.exports = async function (deployer) {
  const ozDir = path.join(__dirname, '../.openzeppelin');

  const ozFiles = fs.readdirSync(ozDir).filter(f => f.startsWith('unknown-') && f.endsWith('.json'));
  if (ozFiles.length === 0) throw new Error(`❌ 找不到 .openzeppelin/unknown-*.json，請先執行 deploy`);

  const ozFile = path.join(ozDir, ozFiles[0]);
  console.log(`🔍 使用設定檔: ${ozFiles[0]}`);

  const ozData = JSON.parse(fs.readFileSync(ozFile));
  const proxies = ozData.proxies.map(p => p.address);

  const demoProxy = proxies[0];
  const gmrProxy  = proxies[1];

  if (!demoProxy) throw new Error(`❌ 找不到 DEMO proxy 地址`);
  if (!gmrProxy)  throw new Error(`❌ 找不到 GMR proxy 地址`);

  console.log(`🔍 DEMO proxy: ${demoProxy}`);
  console.log(`🔍 GMR  proxy: ${gmrProxy}`);

  await upgradeProxy(demoProxy, DEMO, { deployer });
  console.log("✅ DEMO 升級完成，資料保留");

  await upgradeProxy(gmrProxy, GMR, { deployer });
  console.log("✅ GMR 升級完成，資料保留");
};