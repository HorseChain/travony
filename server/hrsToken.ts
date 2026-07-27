import { ethers } from "ethers";

const ETH_MAINNET_RPCS = [
  "https://ethereum.publicnode.com",
  "https://1rpc.io/eth",
  "https://eth.drpc.org",
];

export const HRS_CONTRACT_ADDRESS = "0xe0bb2ba6abfe69eef1b0828e090a3abd5863c7ad";
export const HRS_DECIMALS = 6;
export const HRS_SYMBOL = "HRS";
export const HRS_NAME = "HorseChain";
export const HRS_TOTAL_SUPPLY = 250_000_000;

const HRS_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
];

let provider: ethers.JsonRpcProvider | null = null;
let hrsContract: ethers.Contract | null = null;
let platformWallet: ethers.Wallet | null = null;
let platformAddress: string | null = null;
let initialized = false;

async function getProvider(): Promise<ethers.JsonRpcProvider> {
  if (provider) return provider;
  for (const rpc of ETH_MAINNET_RPCS) {
    try {
      const p = new ethers.JsonRpcProvider(rpc);
      await p.getNetwork();
      provider = p;
      return p;
    } catch {
      continue;
    }
  }
  throw new Error("All Ethereum RPC endpoints unavailable");
}

export async function initializeHrs(): Promise<{ success: boolean; message: string }> {
  try {
    const p = await getProvider();
    hrsContract = new ethers.Contract(HRS_CONTRACT_ADDRESS, HRS_ABI, p);
    initialized = true;

    const privateKey = process.env.HRS_PRIVATE_KEY || process.env.HRS_PRIVATE;
    if (privateKey) {
      try {
        const trimmed = privateKey.trim();
        const words = trimmed.split(/\s+/).filter(Boolean);
        // Only treat as mnemonic if it's exactly 12 or 24 words
        const isMnemonic = words.length === 12 || words.length === 24;
        if (isMnemonic) {
          // BIP44 ETH derivation path (Trust Wallet / standard)
          const hdWallet = ethers.HDNodeWallet.fromPhrase(
            words.join(" "),
            undefined,
            "m/44'/60'/0'/0/0"
          );
          platformWallet = hdWallet.connect(p) as unknown as ethers.Wallet;
        } else {
          // Raw private key — strip all whitespace in case of accidental spaces
          const raw = trimmed.replace(/\s+/g, "");
          const key = raw.startsWith("0x") ? raw : `0x${raw}`;
          platformWallet = new ethers.Wallet(key, p);
        }
        platformAddress = await platformWallet.getAddress();
        console.log(`HRS: Platform wallet loaded — ${platformAddress}`);
      } catch (e: any) {
        console.warn("HRS: HRS_PRIVATE key invalid —", e.message);
        platformWallet = null;
        platformAddress = null;
      }
    } else {
      console.warn("HRS: HRS_PRIVATE not set — on-chain payouts disabled");
    }

    console.log(`HRS: HorseChain token connected on Ethereum mainnet (${HRS_CONTRACT_ADDRESS})`);
    return { success: true, message: "HorseChain (HRS) token connected on Ethereum mainnet" };
  } catch (error: any) {
    console.warn("HRS: Could not connect to Ethereum mainnet:", error.message);
    return { success: false, message: `HRS connection failed: ${error.message}` };
  }
}

export function getHrsTokenInfo() {
  return {
    name: HRS_NAME,
    symbol: HRS_SYMBOL,
    contractAddress: HRS_CONTRACT_ADDRESS,
    decimals: HRS_DECIMALS,
    totalSupply: HRS_TOTAL_SUPPLY,
    network: "Ethereum Mainnet",
    etherscanUrl: `https://etherscan.io/token/${HRS_CONTRACT_ADDRESS}`,
    platformAddress: platformAddress ?? null,
    payoutsEnabled: platformWallet !== null,
  };
}

export async function getHrsBalance(walletAddress: string): Promise<{
  success: boolean;
  balance: string;
  balanceFormatted: string;
  walletAddress: string;
  error?: string;
}> {
  if (!ethers.isAddress(walletAddress)) {
    return {
      success: false,
      balance: "0",
      balanceFormatted: "0.00",
      walletAddress,
      error: "Invalid Ethereum address format",
    };
  }

  try {
    if (!hrsContract) {
      const p = await getProvider();
      hrsContract = new ethers.Contract(HRS_CONTRACT_ADDRESS, HRS_ABI, p);
    }
    const raw: bigint = await hrsContract.balanceOf(walletAddress);
    const balance = ethers.formatUnits(raw, HRS_DECIMALS);
    const formatted = parseFloat(balance).toLocaleString("en-US", { maximumFractionDigits: 4 });
    return { success: true, balance, balanceFormatted: formatted, walletAddress };
  } catch (error: any) {
    return {
      success: false,
      balance: "0",
      balanceFormatted: "0.00",
      walletAddress,
      error: error.message,
    };
  }
}

export async function getPlatformHrsBalance(): Promise<{
  success: boolean;
  address: string | null;
  balance: string;
  balanceFormatted: string;
  ethBalance: string;
  error?: string;
}> {
  if (!platformAddress || !platformWallet) {
    return {
      success: false,
      address: null,
      balance: "0",
      balanceFormatted: "0.00",
      ethBalance: "0",
      error: "Platform wallet not configured (HRS_PRIVATE missing or invalid)",
    };
  }
  try {
    const p = await getProvider();
    if (!hrsContract) {
      hrsContract = new ethers.Contract(HRS_CONTRACT_ADDRESS, HRS_ABI, p);
    }
    const [hrsRaw, ethRaw] = await Promise.all([
      hrsContract.balanceOf(platformAddress),
      p.getBalance(platformAddress),
    ]);
    const balance = ethers.formatUnits(hrsRaw, HRS_DECIMALS);
    const formatted = parseFloat(balance).toLocaleString("en-US", { maximumFractionDigits: 4 });
    const ethBalance = parseFloat(ethers.formatEther(ethRaw)).toFixed(6);
    return { success: true, address: platformAddress, balance, balanceFormatted: formatted, ethBalance };
  } catch (error: any) {
    return {
      success: false,
      address: platformAddress,
      balance: "0",
      balanceFormatted: "0.00",
      ethBalance: "0",
      error: error.message,
    };
  }
}

export async function sendHrsPayout(
  toAddress: string,
  amountHrs: number
): Promise<{ success: boolean; txHash?: string; message: string; explorerUrl?: string }> {
  if (!platformWallet) {
    return {
      success: false,
      message: "Platform wallet not configured — HRS_PRIVATE missing or invalid",
    };
  }
  if (!ethers.isAddress(toAddress)) {
    return { success: false, message: "Invalid destination Ethereum address" };
  }
  if (amountHrs <= 0) {
    return { success: false, message: "Amount must be greater than zero" };
  }
  try {
    const p = await getProvider();
    const contractWithSigner = new ethers.Contract(HRS_CONTRACT_ADDRESS, HRS_ABI, platformWallet.connect(p));
    const amountWei = ethers.parseUnits(amountHrs.toFixed(6), HRS_DECIMALS);
    const tx = await contractWithSigner.transfer(toAddress, amountWei);
    const receipt = await tx.wait();
    return {
      success: true,
      txHash: receipt.hash,
      message: `Sent ${amountHrs} HRS to ${toAddress}`,
      explorerUrl: `https://etherscan.io/tx/${receipt.hash}`,
    };
  } catch (error: any) {
    return { success: false, message: `HRS transfer failed: ${error.message}` };
  }
}

export function getPlatformAddress(): string | null {
  return platformAddress;
}

export async function verifyHrsTransfer(
  fromAddress: string,
  toAddress: string,
  requiredHrs: number,
  lookbackBlocks = 1000,
): Promise<{ found: boolean; txHash?: string; amount?: string }> {
  try {
    const p = await getProvider();
    if (!hrsContract) {
      hrsContract = new ethers.Contract(HRS_CONTRACT_ADDRESS, HRS_ABI, p);
    }
    const latestBlock = await p.getBlockNumber();
    const fromBlock = Math.max(0, latestBlock - lookbackBlocks);
    const filter = hrsContract.filters.Transfer(fromAddress, toAddress);
    const events = await hrsContract.queryFilter(filter, fromBlock, latestBlock);
    const requiredRaw = ethers.parseUnits(requiredHrs.toFixed(6), HRS_DECIMALS);
    for (const event of events) {
      const log = event as any;
      const amount: bigint = log.args?.[2] ?? log.args?.value;
      if (amount !== undefined && amount >= requiredRaw) {
        return {
          found: true,
          txHash: event.transactionHash,
          amount: ethers.formatUnits(amount, HRS_DECIMALS),
        };
      }
    }
    return { found: false };
  } catch (error: any) {
    console.warn("[HRS] Transfer scan failed:", error.message);
    return { found: false };
  }
}

export function isValidEthAddress(address: string): boolean {
  try {
    return ethers.isAddress(address);
  } catch {
    return false;
  }
}

export function isHrsInitialized(): boolean {
  return initialized;
}
