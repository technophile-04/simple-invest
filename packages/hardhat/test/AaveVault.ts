import { expect } from "chai";
import { ethers } from "hardhat";
import { AaveVault } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { AaveV3Optimism } from "@bgd-labs/aave-address-book";

describe("AaveVault", function () {
  let aaveVault: AaveVault;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;

  // Use Aave Address Book for Optimism addresses
  const AAVE_POOL = AaveV3Optimism.POOL;
  const WETH = AaveV3Optimism.ASSETS.WETH.UNDERLYING;
  const ATOKEN = AaveV3Optimism.ASSETS.WETH.A_TOKEN;

  before(async function () {
    [, user1, user2] = await ethers.getSigners();

    // Deploy AaveVault
    const AaveVaultFactory = await ethers.getContractFactory("AaveVault");
    aaveVault = await AaveVaultFactory.deploy(AAVE_POOL, WETH, ATOKEN);
    await aaveVault.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct Aave Pool address", async function () {
      expect(await aaveVault.aavePool()).to.equal(AAVE_POOL);
    });

    it("Should set the correct WETH address", async function () {
      expect(await aaveVault.weth()).to.equal(WETH);
    });

    it("Should set the correct aToken address", async function () {
      expect(await aaveVault.aToken()).to.equal(ATOKEN);
    });

    it("Should have zero total deposits initially", async function () {
      expect(await aaveVault.totalDeposits()).to.equal(0);
    });
  });

  describe("Deposits", function () {
    it("Should allow users to deposit ETH", async function () {
      const depositAmount = ethers.parseEther("1.0");

      await expect(aaveVault.connect(user1).deposit({ value: depositAmount }))
        .to.emit(aaveVault, "Deposited")
        .withArgs(user1.address, depositAmount);

      expect(await aaveVault.userDeposits(user1.address)).to.equal(depositAmount);
      expect(await aaveVault.totalDeposits()).to.equal(depositAmount);
    });

    it("Should track multiple deposits from same user", async function () {
      const depositAmount = ethers.parseEther("0.5");
      const previousDeposit = await aaveVault.userDeposits(user1.address);

      await aaveVault.connect(user1).deposit({ value: depositAmount });

      expect(await aaveVault.userDeposits(user1.address)).to.equal(previousDeposit + depositAmount);
    });

    it("Should track deposits from multiple users", async function () {
      const depositAmount = ethers.parseEther("2.0");

      await aaveVault.connect(user2).deposit({ value: depositAmount });

      expect(await aaveVault.userDeposits(user2.address)).to.equal(depositAmount);
    });

    it("Should revert on zero deposit", async function () {
      await expect(aaveVault.connect(user1).deposit({ value: 0 })).to.be.revertedWith("Must deposit more than 0");
    });

    it("Should correctly report ETH balance", async function () {
      const ethBalance = await aaveVault.getEthBalance();
      expect(ethBalance).to.be.gt(0);
    });
  });

  describe("Supply to Aave", function () {
    it("Should supply ETH to Aave", async function () {
      const ethBalanceBefore = await aaveVault.getEthBalance();
      expect(ethBalanceBefore).to.be.gt(0);

      await expect(aaveVault.connect(user1).supplyToAave()).to.emit(aaveVault, "SuppliedToAave");

      const ethBalanceAfter = await aaveVault.getEthBalance();
      const aaveBalance = await aaveVault.getAaveBalance();

      expect(ethBalanceAfter).to.equal(0);
      expect(aaveBalance).to.be.gt(0);
    });

    it("Should revert when no ETH to supply", async function () {
      await expect(aaveVault.connect(user2).supplyToAave()).to.be.revertedWith("No ETH to supply");
    });

    it("Should allow anyone to call supplyToAave", async function () {
      // Deposit some more ETH
      await aaveVault.connect(user1).deposit({ value: ethers.parseEther("0.1") });

      // User2 should be able to trigger supply
      await expect(aaveVault.connect(user2).supplyToAave()).to.emit(aaveVault, "SuppliedToAave");
    });
  });

  describe("View Functions", function () {
    it("Should return correct total vault value", async function () {
      const totalValue = await aaveVault.getTotalVaultValue();
      expect(totalValue).to.be.gt(0);
    });

    it("Should return correct user value", async function () {
      const user1Value = await aaveVault.getUserValue(user1.address);
      expect(user1Value).to.be.gt(0);
    });

    it("Should calculate user interest", async function () {
      // Interest might be zero or very small initially
      const user1Interest = await aaveVault.getUserInterest(user1.address);
      expect(user1Interest).to.be.gte(0);
    });
  });

  describe("Withdrawals", function () {
    it("Should allow users to withdraw their deposits", async function () {
      // First, make a fresh deposit to ensure we have funds to withdraw
      const depositAmount = ethers.parseEther("1.0");
      await aaveVault.connect(user1).deposit({ value: depositAmount });

      // Supply to Aave to simulate real scenario
      await aaveVault.supplyToAave();

      const user1DepositBefore = await aaveVault.userDeposits(user1.address);
      const withdrawAmount = ethers.parseEther("0.5");

      expect(user1DepositBefore).to.be.gte(withdrawAmount);

      // Get WETH contract to check WETH balance (since withdrawal returns WETH from Aave)
      const wethContract = await ethers.getContractAt("IWETH", WETH);
      const wethBalanceBefore = await wethContract.balanceOf(user1.address);

      await expect(aaveVault.connect(user1).withdraw(withdrawAmount)).to.emit(aaveVault, "Withdrawn");

      // User should have received WETH (since funds were in Aave)
      const wethBalanceAfter = await wethContract.balanceOf(user1.address);
      expect(wethBalanceAfter).to.be.gt(wethBalanceBefore);

      // User deposit should be reduced
      expect(await aaveVault.userDeposits(user1.address)).to.equal(user1DepositBefore - withdrawAmount);
    });

    it("Should revert on zero withdrawal", async function () {
      await expect(aaveVault.connect(user1).withdraw(0)).to.be.revertedWith("Must withdraw more than 0");
    });

    it("Should revert when withdrawing more than deposited", async function () {
      const user1Deposit = await aaveVault.userDeposits(user1.address);
      const excessAmount = user1Deposit + ethers.parseEther("1000");

      await expect(aaveVault.connect(user1).withdraw(excessAmount)).to.be.revertedWith("Insufficient balance");
    });

    it("Should allow user to withdraw entire balance", async function () {
      // Make a fresh deposit for this test
      const depositAmount = ethers.parseEther("0.5");
      await aaveVault.connect(user2).deposit({ value: depositAmount });
      await aaveVault.supplyToAave();

      const user2Deposit = await aaveVault.userDeposits(user2.address);
      expect(user2Deposit).to.be.gt(0);

      // Get WETH contract to verify receipt
      const wethContract = await ethers.getContractAt("IWETH", WETH);
      const wethBalanceBefore = await wethContract.balanceOf(user2.address);

      await aaveVault.connect(user2).withdraw(user2Deposit);

      expect(await aaveVault.userDeposits(user2.address)).to.equal(0);

      // User should have received WETH
      const wethBalanceAfter = await wethContract.balanceOf(user2.address);
      expect(wethBalanceAfter).to.be.gt(wethBalanceBefore);
    });
  });

  describe("Proportional Withdrawals", function () {
    it("Should distribute interest proportionally among users", async function () {
      // Deploy fresh vault for clean test
      const AaveVaultFactory = await ethers.getContractFactory("AaveVault");
      const freshVault = await AaveVaultFactory.deploy(AAVE_POOL, WETH, ATOKEN);

      // Equal deposits
      await freshVault.connect(user1).deposit({ value: ethers.parseEther("1.0") });
      await freshVault.connect(user2).deposit({ value: ethers.parseEther("1.0") });

      // Supply to Aave
      await freshVault.supplyToAave();

      // Both users should have approximately equal value
      const user1Value = await freshVault.getUserValue(user1.address);
      const user2Value = await freshVault.getUserValue(user2.address);

      // Allow for small rounding differences
      const diff = user1Value > user2Value ? user1Value - user2Value : user2Value - user1Value;
      expect(diff).to.be.lt(ethers.parseEther("0.001"));
    });
  });

  describe("Edge Cases", function () {
    it("Should handle vault with no deposits", async function () {
      const AaveVaultFactory = await ethers.getContractFactory("AaveVault");
      const emptyVault = await AaveVaultFactory.deploy(AAVE_POOL, WETH, ATOKEN);

      expect(await emptyVault.getTotalVaultValue()).to.equal(0);
      expect(await emptyVault.getUserValue(user1.address)).to.equal(0);
      expect(await emptyVault.getUserInterest(user1.address)).to.equal(0);
    });
  });
});
