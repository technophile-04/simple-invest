"use client";

import { useState } from "react";
import type { NextPage } from "next";
import { formatEther, parseEther } from "viem";
import { useAccount } from "wagmi";
import { Address, EtherInput } from "~~/components/scaffold-eth";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

const Home: NextPage = () => {
  const { address: connectedAddress } = useAccount();
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");

  // Read contract data
  const { data: userDeposit } = useScaffoldReadContract({
    contractName: "AaveVault",
    functionName: "userDeposits",
    args: [connectedAddress],
    watch: true,
  });

  const { data: totalDeposits } = useScaffoldReadContract({
    contractName: "AaveVault",
    functionName: "totalDeposits",
    watch: true,
  });

  const { data: ethBalance } = useScaffoldReadContract({
    contractName: "AaveVault",
    functionName: "getEthBalance",
    watch: true,
  });

  const { data: aaveBalance } = useScaffoldReadContract({
    contractName: "AaveVault",
    functionName: "getAaveBalance",
    watch: true,
  });

  const { data: userValue } = useScaffoldReadContract({
    contractName: "AaveVault",
    functionName: "getUserValue",
    args: [connectedAddress],
    watch: true,
  });

  const { data: userInterest } = useScaffoldReadContract({
    contractName: "AaveVault",
    functionName: "getUserInterest",
    args: [connectedAddress],
    watch: true,
  });

  // Write contract functions
  const { writeContractAsync: writeDeposit, isMining: isDepositing } = useScaffoldWriteContract({
    contractName: "AaveVault",
  });

  const { writeContractAsync: writeSupply, isMining: isSupplying } = useScaffoldWriteContract({
    contractName: "AaveVault",
  });

  const { writeContractAsync: writeWithdraw, isMining: isWithdrawing } = useScaffoldWriteContract({
    contractName: "AaveVault",
  });

  const handleDeposit = async () => {
    try {
      if (!depositAmount || parseFloat(depositAmount) <= 0) {
        alert("Please enter a valid deposit amount");
        return;
      }
      await writeDeposit({
        functionName: "deposit",
        value: parseEther(depositAmount),
      });
      setDepositAmount("");
    } catch (error) {
      console.error("Deposit error:", error);
    }
  };

  const handleSupplyToAave = async () => {
    try {
      await writeSupply({
        functionName: "supplyToAave",
      });
    } catch (error) {
      console.error("Supply error:", error);
    }
  };

  const handleWithdraw = async () => {
    try {
      if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
        alert("Please enter a valid withdrawal amount");
        return;
      }
      await writeWithdraw({
        functionName: "withdraw",
        args: [parseEther(withdrawAmount)],
      });
      setWithdrawAmount("");
    } catch (error) {
      console.error("Withdraw error:", error);
    }
  };

  return (
    <>
      <div className="flex items-center flex-col grow pt-10">
        <div className="px-5 w-full max-w-4xl">
          <h1 className="text-center mb-8">
            <span className="block text-4xl font-bold mb-2">Aave ETH Vault</span>
            <span className="block text-xl text-gray-600">Deposit ETH and earn yield on Aave</span>
          </h1>

          <div className="flex justify-center items-center space-x-2 mb-8">
            <p className="font-medium">Connected:</p>
            <Address address={connectedAddress} />
          </div>

          {/* Vault Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h2 className="card-title text-sm">Total Vault Deposits</h2>
                <p className="text-2xl font-bold">{totalDeposits ? formatEther(totalDeposits) : "0"} ETH</p>
              </div>
            </div>

            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h2 className="card-title text-sm">Your Deposit</h2>
                <p className="text-2xl font-bold">{userDeposit ? formatEther(userDeposit) : "0"} ETH</p>
              </div>
            </div>

            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h2 className="card-title text-sm">Your Total Value</h2>
                <p className="text-2xl font-bold">{userValue ? formatEther(userValue) : "0"} ETH</p>
              </div>
            </div>

            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h2 className="card-title text-sm">Your Interest Earned</h2>
                <p className="text-2xl font-bold text-success">{userInterest ? formatEther(userInterest) : "0"} ETH</p>
              </div>
            </div>
          </div>

          {/* Vault Balances */}
          <div className="card bg-base-200 shadow-xl mb-8">
            <div className="card-body">
              <h2 className="card-title">Vault Balances</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">ETH in Vault (Not Yet Supplied)</p>
                  <p className="text-xl font-bold">{ethBalance ? formatEther(ethBalance) : "0"} ETH</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Supplied to Aave</p>
                  <p className="text-xl font-bold">{aaveBalance ? formatEther(aaveBalance) : "0"} aWETH</p>
                </div>
              </div>
              {ethBalance && ethBalance > 0n && (
                <button
                  className="btn btn-primary mt-4"
                  onClick={handleSupplyToAave}
                  disabled={isSupplying || !ethBalance || ethBalance === 0n}
                >
                  {isSupplying ? (
                    <>
                      <span className="loading loading-spinner"></span>
                      Supplying to Aave...
                    </>
                  ) : (
                    "Supply ETH to Aave"
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Deposit */}
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h2 className="card-title">Deposit ETH</h2>
                <p className="text-sm text-gray-600 mb-4">Deposit ETH into the vault</p>
                <EtherInput value={depositAmount} onChange={setDepositAmount} placeholder="Amount to deposit" />
                <button className="btn btn-primary mt-4" onClick={handleDeposit} disabled={isDepositing}>
                  {isDepositing ? (
                    <>
                      <span className="loading loading-spinner"></span>
                      Depositing...
                    </>
                  ) : (
                    "Deposit"
                  )}
                </button>
              </div>
            </div>

            {/* Withdraw */}
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h2 className="card-title">Withdraw ETH</h2>
                <p className="text-sm text-gray-600 mb-4">Withdraw your deposit + interest</p>
                <EtherInput value={withdrawAmount} onChange={setWithdrawAmount} placeholder="Amount to withdraw" />
                <button
                  className="btn btn-secondary mt-4"
                  onClick={handleWithdraw}
                  disabled={isWithdrawing || !userDeposit || userDeposit === 0n}
                >
                  {isWithdrawing ? (
                    <>
                      <span className="loading loading-spinner"></span>
                      Withdrawing...
                    </>
                  ) : (
                    "Withdraw"
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="card bg-base-300 shadow-xl mt-8">
            <div className="card-body">
              <h2 className="card-title">How it works</h2>
              <ol className="list-decimal list-inside space-y-2">
                <li>Deposit ETH into the vault</li>
                <li>Anyone can trigger the supply to Aave (wraps ETH to WETH and supplies to Aave Pool)</li>
                <li>Your deposit earns interest automatically on Aave</li>
                <li>Withdraw anytime to get your deposit + earned interest</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Home;
