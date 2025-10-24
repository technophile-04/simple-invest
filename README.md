# 🏗 Simple Invest

## Overview

A simple yet powerful vault that accepts ETH deposits and automatically supplies them to **Aave V3** on Optimism to earn yield. Users can withdraw their deposits plus earned interest at any time.

### Key Features

- ✅ Deposit ETH into the vault
- ✅ Anyone can trigger supply to Aave V3
- ✅ Automatic yield generation from Aave
- ✅ Withdraw with proportional interest

## Quickstart

### 1. Install Packages

```bash
yarn install
```

### 2. Start Local Chain (Optimism Fork)

> Make sure to set the Alchemy API key `ALCHEMY_API_KEY` in `.env` inside `packages/hardhat`

```bash
MAINNET_FORKING_ENABLED=true yarn chain
```

This starts a local Hardhat node that forks Optimism mainnet, giving you access to the real Aave V3 deployment.

### 3. Deploy Contract

In a new terminal:

```bash
yarn deploy
```

This deploys the AaveVault contract with the correct Aave addresses from the official Address Book.

### 4. Start Frontend

In another terminal:

```bash
yarn start
```

Visit your app on: `http://localhost:3000` to interact with the Aave Vault!

## How It Works

1. **Deposit**: Users deposit ETH into the vault
2. **Supply**: Anyone can trigger the vault to supply ETH to Aave (wraps to WETH automatically)
3. **Earn**: The vault receives aWETH tokens that automatically accrue interest
4. **Withdraw**: Users can withdraw their proportional share including earned interest

## Testing

```bash
yarn hardhat:test
```

## Project Structure

- `packages/hardhat/contracts/AaveVault.sol` - Main vault contract
- `packages/hardhat/deploy/01_deploy_aave_vault.ts` - Deployment script
- `packages/hardhat/test/AaveVault.ts` - Tests
- `packages/nextjs/app/page.tsx` - Frontend UI
