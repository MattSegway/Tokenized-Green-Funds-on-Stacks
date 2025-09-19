# GreenVault: Tokenized Green Funds on Stacks

## Project Overview

**GreenVault** is a decentralized finance (DeFi) protocol built on the Stacks blockchain using Clarity smart contracts. It enables the tokenization of real-world environmental assets (e.g., carbon credits, reforestation bonds, renewable energy certificates) into fungible and tradable tokens. These tokens are pooled into green-focused investment funds, allowing retail and institutional investors to participate in sustainable finance with transparency, low barriers to entry, and verifiable impact.

### Real-World Problems Solved
- **Transparency in Green Investments**: Traditional green funds often lack on-chain verifiability. GreenVault uses oracles to integrate off-chain environmental data (e.g., satellite imagery for carbon sequestration), ensuring claims are auditable.
- **Accessibility**: High minimum investments in ESG funds exclude small investors. GreenVault allows micro-investments starting from $1 equivalent in STX.
- **Impact Measurement**: Investors can track real-world impact (e.g., CO2 offset per token) via tokenized proofs, combating greenwashing.
- **Liquidity**: Tokenized assets can be traded on decentralized exchanges, unlike illiquid traditional environmental instruments.
- **Decentralized Governance**: Token holders vote on fund allocations (e.g., prioritizing ocean cleanup vs. solar projects), democratizing climate action.

The protocol supports the UN Sustainable Development Goals (SDGs), particularly SDG 13 (Climate Action) and SDG 7 (Affordable and Clean Energy), by channeling funds to verified projects.

### Tech Stack
- **Blockchain**: Stacks (Layer 2 on Bitcoin for secure, predictable finality).
- **Smart Contract Language**: Clarity (secure, decidable language for auditable contracts).
- **Tokens**: SIP-010 (fungible tokens) for asset tokens and fund shares.
- **Off-Chain Integration**: Oracles (e.g., Chainlink on Stacks) for environmental data feeds; IPFS for project documentation.
- **Frontend**: React + Stacks.js (not included here; deployable via Hiro's Gaia hub).
- **Testing**: Clarinet for local development and unit tests.

### Key Features
- **Tokenization**: Mint tokens backed by verified environmental assets.
- **Fund Pooling**: Investors buy fund shares; managers allocate to tokenized assets.
- **Yield Distribution**: Profits from asset appreciation/redemptions distributed as yields.
- **Governance**: DAO-style voting on fund strategies.
- **Compliance**: Built-in KYC hooks (optional) and impact reporting.

## Smart Contracts (5-7 Solid Contracts)
The protocol consists of 6 core Clarity smart contracts, each with defined traits for composability. All contracts are upgradeable via a proxy pattern (using `clarity-repl` for testing). Contracts are designed to be secure, with invariants checked (e.g., total supply caps, oracle validations).

### 1. `green-asset-token.clar` (SIP-010 Fungible Token)
   - **Purpose**: Represents tokenized environmental assets (e.g., 1 token = 1 ton of CO2 offset).
   - **Key Functions**:
     - `mint-asset`: Mints tokens backed by oracle-verified data (e.g., carbon credit issuance).
     - `burn-asset`: Burns tokens upon redemption for real-world asset transfer.
     - `transfer` with impact metadata (stored in memo).
   - **Traits**: Implements `SIP-010-trait`.
   - **Security**: Only minter role can mint; supply capped by oracle.

### 2. `green-fund.clar` (Fund Management)
   - **Purpose**: Core vault for pooling investments into green assets.
   - **Key Functions**:
     - `invest`: Users deposit STX to receive fund shares (proportional to pool).
     - `withdraw`: Redeem shares for STX + yields.
     - `allocate-funds`: Manager (or governance) allocates to asset tokens.
   - **Traits**: Custom `fund-trait` for share calculation.
   - **Security**: Time-locks on withdrawals; slippage protection.

### 3. `oracle-verifier.clar` (Data Oracle Integration)
   - **Purpose**: Verifies off-chain environmental data to prevent fraud.
   - **Key Functions**:
     - `submit-proof`: Oracle submits proof (e.g., hash of satellite data).
     - `validate-asset`: Checks proof against contract rules before minting.
     - `get-impact`: Queries cumulative impact (e.g., total CO2 offset).
   - **Traits**: Integrates with Stacks oracle adapters.
   - **Security**: Multi-signature oracle consensus; replay protection via nonces.

### 4. `governance-dao.clar` (DAO Voting)
   - **Purpose**: Token holders govern fund strategies (e.g., vote on new asset types).
   - **Key Functions**:
     - `propose`: Submit governance proposal (e.g., "Allocate 20% to reforestation").
     - `vote`: Weighted voting by fund shares held.
     - `execute`: Auto-execute passed proposals.
   - **Traits**: `dao-trait` with quadratic voting option.
   - **Security**: Voting periods; veto power for emergencies.

### 5. `yield-distributor.clar` (Yield Farming)
   - **Purpose**: Distributes yields from asset performance (e.g., carbon price appreciation).
   - **Key Functions**:
     - `claim-yield`: Users claim proportional yields in STX or asset tokens.
     - `stake-shares`: Lock shares for bonus yields (green staking).
     - `distribute`: Auto-distribute from fund profits.
   - **Traits**: Integrates with `green-fund`.
   - **Security**: Claim cooldowns; flash loan resistance.

### 6. `marketplace.clar` (Asset Trading)
   - **Purpose**: Peer-to-peer trading of tokenized assets and fund shares.
   - **Key Functions**:
     - `list-asset`: List tokens for sale with price in STX.
     - `buy-asset`: Atomic swap with escrow.
     - `cancel-listing`: Owner cancels.
   - **Traits**: `market-trait` compatible with DEXs like Velar.
   - **Security**: Escrow holds funds; minimum trade sizes.

### Deployment & Testing
- **Local Setup**: Use Clarinet (`clarinet new green-vault; clarinet integrate`).
- **Tests**: Each contract has unit tests (e.g., mint/burn balance invariants).
- **Mainnet**: Deploy via Hiro CLI; costs ~0.01 STX per contract.

## Getting Started
1. Clone repo: `git clone <repo-url> && cd green-vault`.
2. Install Clarinet: `cargo install clarinet`.
3. Run tests: `clarinet test`.
4. Deploy locally: `clarinet deploy --initialize`.
5. Frontend: `npm install && npm start` (integrates via Stacks Connect).

## Contributing
Fork, PRs welcome. Focus on security audits (e.g., via Sec3).

## License
MIT. See [LICENSE](LICENSE).