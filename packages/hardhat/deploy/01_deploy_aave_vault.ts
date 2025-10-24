import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { Contract } from "ethers";
import { AaveV3Optimism } from "@bgd-labs/aave-address-book";
// Uncomment to add more networks:
// import { AaveV3Ethereum, AaveV3Arbitrum, AaveV3Polygon, AaveV3Base } from "@bgd-labs/aave-address-book";

/**
 * Helper function to get network-specific Aave addresses using the official Aave Address Book
 * This ensures we always use correct, up-to-date addresses without manual hardcoding
 */
function getNetworkConfig(networkName: string) {
  // Optimism mainnet and forks (localhost/hardhat)
  if (networkName === "optimism" || networkName === "localhost" || networkName === "hardhat") {
    return {
      aavePool: AaveV3Optimism.POOL,
      weth: AaveV3Optimism.ASSETS.WETH.UNDERLYING,
      aToken: AaveV3Optimism.ASSETS.WETH.A_TOKEN,
    };
  }

  // To add more networks, uncomment the imports above and add cases like:
  // if (networkName === "mainnet") {
  //   return {
  //     aavePool: AaveV3Ethereum.POOL,
  //     weth: AaveV3Ethereum.ASSETS.WETH.UNDERLYING,
  //     aToken: AaveV3Ethereum.ASSETS.WETH.A_TOKEN,
  //   };
  // }
  //
  // if (networkName === "arbitrum") {
  //   return {
  //     aavePool: AaveV3Arbitrum.POOL,
  //     weth: AaveV3Arbitrum.ASSETS.WETH.UNDERLYING,
  //     aToken: AaveV3Arbitrum.ASSETS.WETH.A_TOKEN,
  //   };
  // }

  throw new Error(
    `Network ${networkName} not supported. Please add network configuration to getNetworkConfig() function.`,
  );
}

/**
 * Deploys the AaveVault contract with network-specific Aave addresses
 *
 * @param hre HardhatRuntimeEnvironment object.
 */
const deployAaveVault: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const networkName = hre.network.name;
  const config = getNetworkConfig(networkName);

  console.log(`\n📦 Deploying AaveVault to ${networkName}...`);
  console.log(
    `  Using Aave Address Book for ${networkName === "localhost" || networkName === "hardhat" ? "Optimism (fork)" : networkName}`,
  );
  console.log(`  Aave Pool: ${config.aavePool}`);
  console.log(`  WETH: ${config.weth}`);
  console.log(`  aToken: ${config.aToken}`);

  await deploy("AaveVault", {
    from: deployer,
    args: [config.aavePool, config.weth, config.aToken],
    log: true,
    autoMine: true,
  });

  const aaveVault = await hre.ethers.getContract<Contract>("AaveVault", deployer);
  console.log("✅ AaveVault deployed successfully");
  console.log(`📍 Contract address: ${await aaveVault.getAddress()}\n`);
};

export default deployAaveVault;

deployAaveVault.tags = ["AaveVault"];
