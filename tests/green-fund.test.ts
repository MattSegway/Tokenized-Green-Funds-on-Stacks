import { describe, it, expect, beforeEach } from "vitest";
import { uintCV, principalCV, bufferCV } from "@stacks/transactions";
import { Buffer } from "buffer";

const ERR_NOT_AUTHORIZED = BigInt(200);
const ERR_INSUFFICIENT_BALANCE = BigInt(202);
const ERR_INVALID_ALLOCATE = BigInt(203);
const ERR_INVALID_NAV = BigInt(205);
const ERR_INVALID_SHARE = BigInt(206);
const ERR_ORACLE_NOT_VERIFIED = BigInt(209);
const ERR_ASSET_NOT_VALID = BigInt(210);
const ERR_YIELD_NOT_ACCRUED = BigInt(211);
const ERR_MAX_INVESTMENT = BigInt(212);
const ERR_MIN_INVESTMENT = BigInt(213);
const ERR_LOCKED_FUNDS = BigInt(215);
const ERR_INVALID_ASSET_CONTRACT = BigInt(217);
const ERR_INVALID_USER = BigInt(221);

interface UserShares {
  shares: bigint;
}

interface UserClaims {
  lastClaim: bigint;
  claimed: bigint;
}

interface Allocation {
  assetContract: string;
  amount: bigint;
  timestamp: bigint;
  approvedBy: string;
}

interface Asset {
  tokenType: string;
  valuePerToken: bigint;
  verified: boolean;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class GreenFundMock {
  state: {
    totalNav: bigint;
    totalShares: bigint;
    manager: string;
    governanceContract: string | null;
    oracleContract: string | null;
    minInvestment: bigint;
    maxInvestment: bigint;
    withdrawalLock: bigint;
    yieldRate: bigint;
    slippageTolerance: bigint;
    nextClaimId: bigint;
    userShares: Map<string, UserShares>;
    userClaims: Map<string, UserClaims>;
    allocations: Map<bigint, Allocation>;
    assets: Map<string, Asset>;
  } = {
    totalNav: 0n,
    totalShares: 0n,
    manager: "ST1TEST",
    governanceContract: null,
    oracleContract: null,
    minInvestment: 1000000n,
    maxInvestment: 1000000000n,
    withdrawalLock: 144n,
    yieldRate: 5n,
    slippageTolerance: 100n,
    nextClaimId: 0n,
    userShares: new Map(),
    userClaims: new Map(),
    allocations: new Map(),
    assets: new Map([
      ["SP2ASSET1234567890ABCDEFGHJKMNPQRSTUVWX", { tokenType: "carbon-credit", valuePerToken: 100n, verified: true }],
    ]),
  };
  blockHeight: bigint = 0n;
  txSender: string = "ST1TEST";
  stxTransfers: Array<{ amount: bigint; from: string | null; to: string | null }> = [];
  ftMints: Array<{ token: string; amount: bigint; to: string }> = [];
  ftBurns: Array<{ token: string; amount: bigint; from: string }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      totalNav: 0n,
      totalShares: 0n,
      manager: "ST1TEST",
      governanceContract: null,
      oracleContract: null,
      minInvestment: 1000000n,
      maxInvestment: 1000000000n,
      withdrawalLock: 144n,
      yieldRate: 5n,
      slippageTolerance: 100n,
      nextClaimId: 0n,
      userShares: new Map(),
      userClaims: new Map(),
      allocations: new Map(),
      assets: new Map([
        ["SP2ASSET1234567890ABCDEFGHJKMNPQRSTUVWX", { tokenType: "carbon-credit", valuePerToken: 100n, verified: true }],
      ]),
    };
    this.blockHeight = 0n;
    this.txSender = "ST1TEST";
    this.stxTransfers = [];
    this.ftMints = [];
    this.ftBurns = [];
  }

  isGovernanceApproved(): boolean {
    return this.state.governanceContract !== null;
  }

  isOracleVerified(): boolean {
    return this.state.oracleContract !== null;
  }

  setGovernanceContract(contractPrincipal: string): Result<boolean> {
    if (contractPrincipal === "SP000000000000000000002Q6VF78") {
      return { ok: false, value: false };
    }
    if (this.state.governanceContract !== null) {
      return { ok: false, value: false };
    }
    this.state.governanceContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setOracleContract(contractPrincipal: string): Result<boolean> {
    if (contractPrincipal === "SP000000000000000000002Q6VF78") {
      return { ok: false, value: false };
    }
    if (this.state.oracleContract !== null) {
      return { ok: false, value: false };
    }
    this.state.oracleContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setMinInvestment(newMin: bigint): Result<boolean> {
    if (!this.state.governanceContract) return { ok: false, value: false };
    if (newMin <= 0n) return { ok: false, value: false };
    this.state.minInvestment = newMin;
    return { ok: true, value: true };
  }

  setMaxInvestment(newMax: bigint): Result<boolean> {
    if (!this.state.governanceContract) return { ok: false, value: false };
    if (newMax <= 0n) return { ok: false, value: false };
    this.state.maxInvestment = newMax;
    return { ok: true, value: true };
  }

  setYieldRate(newRate: bigint): Result<boolean> {
    if (!this.state.governanceContract) return { ok: false, value: false };
    if (newRate > 20n) return { ok: false, value: false };
    this.state.yieldRate = newRate;
    return { ok: true, value: true };
  }

  setManager(newManager: string): Result<boolean> {
    if (!this.state.governanceContract) return { ok: false, value: false };
    this.state.manager = newManager;
    return { ok: true, value: true };
  }

  invest(amount: bigint): Result<bigint> {
    if (amount < this.state.minInvestment || amount > this.state.maxInvestment) {
      return amount < this.state.minInvestment ? { ok: false, value: ERR_MIN_INVESTMENT } : { ok: false, value: ERR_MAX_INVESTMENT };
    }
    if (this.state.totalNav < 0n) return { ok: false, value: ERR_INVALID_NAV };
    const totalShares = this.state.totalShares;
    let newShares: bigint;
    if (totalShares === 0n) {
      newShares = amount * 1000000n;
    } else {
      newShares = (amount * totalShares) / this.state.totalNav;
    }
    this.stxTransfers.push({ amount, from: this.txSender, to: null });
    this.ftMints.push({ token: "fund-share", amount: newShares, to: this.txSender });
    const currentShares = this.state.userShares.get(this.txSender)?.shares || 0n;
    this.state.userShares.set(this.txSender, { shares: currentShares + newShares });
    this.state.totalNav += amount;
    this.state.totalShares += newShares;
    return { ok: true, value: newShares };
  }

  withdraw(shares: bigint): Result<bigint> {
    if (shares <= 0n) return { ok: false, value: ERR_INVALID_SHARE };
    const userBalance = this.state.userShares.get(this.txSender)?.shares || 0n;
    if (userBalance < shares) return { ok: false, value: ERR_INSUFFICIENT_BALANCE };
    const userClaim = this.state.userClaims.get(this.txSender) || { lastClaim: 0n, claimed: 0n };
    if (this.blockHeight < userClaim.lastClaim + this.state.withdrawalLock) return { ok: false, value: ERR_LOCKED_FUNDS };
    const payout = (shares * this.state.totalNav) / this.state.totalShares;
    const yieldAmount = (shares * this.state.yieldRate) / 100n;
    const totalPayout = payout + yieldAmount;
    this.ftBurns.push({ token: "fund-share", amount: shares, from: this.txSender });
    this.stxTransfers.push({ amount: totalPayout, from: null, to: this.txSender });
    const updatedShares = userBalance - shares;
    this.state.userShares.set(this.txSender, { shares: updatedShares });
    this.state.totalNav -= totalPayout;
    this.state.totalShares -= shares;
    this.state.userClaims.set(this.txSender, {
      lastClaim: this.blockHeight,
      claimed: (userClaim.claimed || 0n) + yieldAmount,
    });
    return { ok: true, value: totalPayout };
  }

  allocateFunds(assetContract: string, amount: bigint): Result<boolean> {
    if (this.txSender !== this.state.manager && !this.isGovernanceApproved()) return { ok: false, value: false };
    const asset = this.state.assets.get(assetContract);
    if (!asset || !asset.verified) return { ok: false, value: asset ? ERR_ASSET_NOT_VALID : ERR_INVALID_ASSET_CONTRACT };
    if (amount > this.state.totalNav) return { ok: false, value: ERR_INVALID_ALLOCATE };
    this.stxTransfers.push({ amount, from: null, to: assetContract });
    const id = this.state.nextClaimId;
    this.state.allocations.set(id, {
      assetContract,
      amount,
      timestamp: this.blockHeight,
      approvedBy: this.txSender,
    });
    this.state.nextClaimId++;
    this.state.totalNav -= amount;
    return { ok: true, value: true };
  }

  claimYield(user: string): Result<bigint> {
    if (this.txSender !== user) return { ok: false, value: ERR_INVALID_USER };
    const userClaim = this.state.userClaims.get(user) || { lastClaim: 0n, claimed: 0n };
    if (this.blockHeight <= userClaim.lastClaim) return { ok: false, value: ERR_YIELD_NOT_ACCRUED };
    const userShares = this.state.userShares.get(user)?.shares || 0n;
    const newClaim = (userShares * this.state.yieldRate) / 100n;
    this.stxTransfers.push({ amount: newClaim, from: null, to: user });
    this.state.userClaims.set(user, {
      lastClaim: this.blockHeight,
      claimed: (userClaim.claimed || 0n) + newClaim,
    });
    return { ok: true, value: newClaim };
  }

  updateNav(newNav: bigint, _proof: Buffer): Result<boolean> {
    if (!this.state.oracleContract) return { ok: false, value: false };
    if (!this.isOracleVerified()) return { ok: false, value: false };
    if (newNav < 0n) return { ok: false, value: ERR_INVALID_NAV };
    this.state.totalNav = newNav;
    return { ok: true, value: true };
  }

  getNav(): bigint {
    return this.state.totalNav;
  }

  getUserShares(user: string): bigint {
    return this.state.userShares.get(user)?.shares || 0n;
  }

  getUserClaims(user: string): UserClaims | null {
    return this.state.userClaims.get(user) || null;
  }

  getAllocation(id: bigint): Allocation | null {
    return this.state.allocations.get(id) || null;
  }

  getAsset(contract: string): Asset | null {
    return this.state.assets.get(contract) || null;
  }
}

describe("GreenFund", () => {
  let contract: GreenFundMock;

  beforeEach(() => {
    contract = new GreenFundMock();
    contract.reset();
  });

  it("invests successfully", () => {
    contract.setGovernanceContract("SP2GOV1234567890ABCDEFGHJKMNPQRSTUVWX");
    const result = contract.invest(5000000n);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(5000000n * 1000000n);
    expect(contract.getNav()).toBe(5000000n);
    expect(contract.getUserShares("ST1TEST")).toBe(5000000n * 1000000n);
    expect(contract.stxTransfers).toEqual([{ amount: 5000000n, from: "ST1TEST", to: null }]);
    expect(contract.ftMints).toEqual([{ token: "fund-share", amount: 5000000n * 1000000n, to: "ST1TEST" }]);
  });

  it("rejects investment below min", () => {
    const result = contract.invest(500000n);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_MIN_INVESTMENT);
  });

  it("rejects investment above max", () => {
    const result = contract.invest(2000000000n);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_MAX_INVESTMENT);
  });

  it("withdraws successfully", () => {
    contract.setGovernanceContract("SP2GOV1234567890ABCDEFGHJKMNPQRSTUVWX");
    contract.invest(5000000n);
    contract.blockHeight = 150n;
    const result = contract.withdraw(2500000n * 1000000n);
    expect(result.ok).toBe(true);
    const expectedPayout = (2500000n * 5000000n) / 5000000n + (2500000n * 1000000n * 5n) / 100n;
    expect(result.value).toBe(expectedPayout);
    expect(contract.getUserShares("ST1TEST")).toBe(2500000n * 1000000n);
    expect(contract.getNav()).toBe(5000000n - expectedPayout);
    expect(contract.ftBurns).toEqual([{ token: "fund-share", amount: 2500000n * 1000000n, from: "ST1TEST" }]);
    expect(contract.stxTransfers).toEqual([
      { amount: 5000000n, from: "ST1TEST", to: null },
      { amount: expectedPayout, from: null, to: "ST1TEST" },
    ]);
  });

  it("rejects withdrawal with insufficient balance", () => {
    contract.setGovernanceContract("SP2GOV1234567890ABCDEFGHJKMNPQRSTUVWX");
    contract.invest(5000000n);
    const result = contract.withdraw(6000000n * 1000000n);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INSUFFICIENT_BALANCE);
  });

  it("rejects withdrawal during lock", () => {
    contract.setGovernanceContract("SP2GOV1234567890ABCDEFGHJKMNPQRSTUVWX");
    contract.invest(5000000n);
    contract.blockHeight = 10n;
    contract.state.userClaims.set("ST1TEST", { lastClaim: 10n, claimed: 0n });
    const result = contract.withdraw(2500000n * 1000000n);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_LOCKED_FUNDS);
  });

  it("allocates funds successfully", () => {
    contract.setGovernanceContract("SP2GOV1234567890ABCDEFGHJKMNPQRSTUVWX");
    contract.state.manager = "ST1TEST";
    contract.invest(5000000n);
    const result = contract.allocateFunds("SP2ASSET1234567890ABCDEFGHJKMNPQRSTUVWX", 2000000n);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.getAllocation(0n)?.assetContract).toBe("SP2ASSET1234567890ABCDEFGHJKMNPQRSTUVWX");
    expect(contract.getNav()).toBe(3000000n);
    expect(contract.stxTransfers).toEqual([
      { amount: 5000000n, from: "ST1TEST", to: null },
      { amount: 2000000n, from: null, to: "SP2ASSET1234567890ABCDEFGHJKMNPQRSTUVWX" },
    ]);
  });

  it("rejects allocation by non-manager", () => {
    contract.txSender = "ST3FAKE";
    const result = contract.allocateFunds("SP2ASSET1234567890ABCDEFGHJKMNPQRSTUVWX", 1000000n);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("rejects allocation for invalid asset", () => {
    contract.setGovernanceContract("SP2GOV1234567890ABCDEFGHJKMNPQRSTUVWX");
    contract.state.manager = "ST1TEST";
    contract.invest(5000000n);
    const result = contract.allocateFunds("SP3INVALID", 1000000n);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_ASSET_CONTRACT);
  });

  it("claims yield successfully", () => {
    contract.setGovernanceContract("SP2GOV1234567890ABCDEFGHJKMNPQRSTUVWX");
    contract.invest(5000000n);
    contract.blockHeight = 10n;
    const result = contract.claimYield("ST1TEST");
    expect(result.ok).toBe(true);
    const expectedYield = (5000000n * 1000000n * 5n) / 100n;
    expect(result.value).toBe(expectedYield);
    const claims = contract.getUserClaims("ST1TEST");
    expect(claims?.claimed).toBe(expectedYield);
    expect(claims?.lastClaim).toBe(10n);
    expect(contract.stxTransfers).toEqual([
      { amount: 5000000n, from: "ST1TEST", to: null },
      { amount: expectedYield, from: null, to: "ST1TEST" },
    ]);
  });

  it("rejects yield claim by wrong user", () => {
    contract.txSender = "ST2FAKE";
    const result = contract.claimYield("ST1TEST");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_USER);
  });

  it("rejects yield claim without accrual", () => {
    contract.setGovernanceContract("SP2GOV1234567890ABCDEFGHJKMNPQRSTUVWX");
    contract.invest(5000000n);
    contract.blockHeight = 0n;
    contract.state.userClaims.set("ST1TEST", { lastClaim: 0n, claimed: 0n });
    const result = contract.claimYield("ST1TEST");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_YIELD_NOT_ACCRUED);
  });

  it("updates NAV successfully", () => {
    contract.setOracleContract("SP2ORACLE1234567890ABCDEFGHJKMNPQRSTUVWX");
    const result = contract.updateNav(6000000n, bufferCV(Buffer.from("mockproof")).value);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.getNav()).toBe(6000000n);
  });

  it("rejects NAV update without oracle", () => {
    const result = contract.updateNav(6000000n, bufferCV(Buffer.from("mockproof")).value);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("sets yield rate successfully", () => {
    contract.setGovernanceContract("SP2GOV1234567890ABCDEFGHJKMNPQRSTUVWX");
    const result = contract.setYieldRate(10n);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.yieldRate).toBe(10n);
  });

  it("rejects invalid yield rate", () => {
    contract.setGovernanceContract("SP2GOV1234567890ABCDEFGHJKMNPQRSTUVWX");
    const result = contract.setYieldRate(25n);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });
});