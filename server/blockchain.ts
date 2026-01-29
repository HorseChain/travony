import { ethers } from "ethers";
import { createHash } from "crypto";

const POLYGON_AMOY_RPC = "https://rpc-amoy.polygon.technology";

function getWalletFromKey(keyOrPhrase: string, provider: ethers.JsonRpcProvider): ethers.Wallet {
  const trimmed = keyOrPhrase.trim();
  
  if (trimmed.startsWith("0x") && trimmed.length === 66 && /^0x[0-9a-fA-F]{64}$/.test(trimmed)) {
    return new ethers.Wallet(trimmed, provider);
  }
  
  const words = trimmed.split(/\s+/);
  if (words.length === 12 || words.length === 24) {
    const hdWallet = ethers.HDNodeWallet.fromPhrase(trimmed);
    return new ethers.Wallet(hdWallet.privateKey, provider);
  }
  
  throw new Error("Invalid key format. Provide a 66-character hex private key (0x...) or a 12/24-word seed phrase.");
}

const RIDE_REGISTRY_ABI = [
  "function recordRide(bytes32 rideHash, uint256 fare, uint256 platformFee, uint256 driverShare) external",
  "function getRide(bytes32 rideHash) external view returns (uint256 fare, uint256 platformFee, uint256 driverShare, uint256 timestamp, bool exists)",
  "function verifyRide(bytes32 rideHash) external view returns (bool exists)",
  "event RideRecorded(bytes32 indexed rideHash, uint256 fare, uint256 platformFee, uint256 driverShare, uint256 timestamp)",
];

const RIDE_REGISTRY_BYTECODE = `0x608060405234801561001057600080fd5b50610400806100206000396000f3fe608060405234801561001057600080fd5b50600436106100415760003560e01c80633e3ee85914610046578063a87430ba14610062578063f8b2cb4f146100a3575b600080fd5b610060600480360381019061005b9190610253565b6100d3565b005b61007c600480360381019061007791906102b3565b610156565b60405161008e9594939291906102ff565b60405180910390f35b6100bd60048036038101906100b891906102b3565b6101af565b6040516100ca9190610352565b60405180910390f35b600080600086815260200190815260200160002090508481556001810184905560028101839055426003820155600181600401819055507f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b92585858585426040516101419594939291906103b4565b60405180910390a15050505050565b6000806000806000808681526020019081526020016000206000015460008088815260200190815260200160002060010154600080898152602001908152602001600020600201546000808a8152602001908152602001600020600301546000808b8152602001908152602001600020600401549050945094509450945094509550565b60008060008381526020019081526020016000206004015460001415905b919050565b6000604051905090565b600080fd5b6000819050919050565b610201816101ee565b811461020c57600080fd5b50565b60008135905061021e816101f8565b92915050565b6000819050919050565b61023781610224565b811461024257600080fd5b50565b6000813590506102548161022e565b92915050565b60008060008060808587031215610274576102736101dc565b5b60006102828782880161020f565b945050602061029387828801610245565b93505060406102a487828801610245565b92505060606102b587828801610245565b91505092959194509250565b6000602082840312156102d7576102d66101dc565b5b60006102e58482850161020f565b91505092915050565b6102f781610224565b82525050565b600060a0820190506103126000830188610298565b61031f60208301876102ee565b61032c60408301866102ee565b61033960608301856102ee565b61034660808301846102ee565b9695505050505050565b60006020820190508180831161036857610367610224565b5b5b92915050565b61037881610224565b82525050565b600060a08201905061039360008301886101ee565b6103a0602083018761036f565b6103ad604083018661036f565b61033960608301856102ee565b61034660808301846102ee565b9695505050505050565bfea264697066735822`;

interface RideBlockchainRecord {
  rideId: string;
  customerId: string;
  driverId: string;
  pickupAddress: string;
  dropoffAddress: string;
  fare: number;
  platformFee: number;
  driverShare: number;
  timestamp: Date;
}

interface BlockchainVerification {
  isVerified: boolean;
  rideHash: string;
  blockchainNetwork: string;
  transactionHash?: string;
  blockNumber?: number;
  timestamp?: number;
  onChainData?: {
    fare: string;
    platformFee: string;
    driverShare: string;
  };
}

let provider: ethers.JsonRpcProvider | null = null;
let wallet: ethers.Wallet | null = null;
let rideRegistryContract: ethers.Contract | null = null;
let contractAddress: string | null = null;

export async function initializeBlockchain(): Promise<{
  success: boolean;
  message: string;
  contractAddress?: string;
}> {
  try {
    provider = new ethers.JsonRpcProvider(POLYGON_AMOY_RPC);
    await provider.getNetwork();

    const privateKey = process.env.BLOCKCHAIN_PRIVATE_KEY;
    
    if (privateKey) {
      wallet = getWalletFromKey(privateKey, provider);
      
      contractAddress = process.env.RIDE_REGISTRY_CONTRACT || null;
      
      if (contractAddress) {
        rideRegistryContract = new ethers.Contract(
          contractAddress,
          RIDE_REGISTRY_ABI,
          wallet
        );
        
        return {
          success: true,
          message: "Blockchain initialized with existing contract",
          contractAddress,
        };
      } else {
        return {
          success: true,
          message: "Blockchain connected. Set RIDE_REGISTRY_CONTRACT env var to enable on-chain recording.",
        };
      }
    }
    
    return {
      success: true,
      message: "Blockchain provider connected. Set BLOCKCHAIN_PRIVATE_KEY for full functionality.",
    };
  } catch (error: any) {
    console.error("Blockchain initialization error:", error.message);
    return {
      success: false,
      message: `Blockchain connection failed: ${error.message}`,
    };
  }
}

export function generateRideHash(record: RideBlockchainRecord): string {
  const dataToHash = JSON.stringify({
    rideId: record.rideId,
    customerId: record.customerId,
    driverId: record.driverId,
    pickup: record.pickupAddress,
    dropoff: record.dropoffAddress,
    fare: record.fare,
    platformFee: record.platformFee,
    driverShare: record.driverShare,
    timestamp: record.timestamp.toISOString(),
  });
  
  return "0x" + createHash("sha256").update(dataToHash).digest("hex");
}

export async function recordRideToBlockchain(
  record: RideBlockchainRecord
): Promise<{
  success: boolean;
  hash: string;
  transactionHash?: string;
  blockNumber?: number;
  verificationUrl: string;
  message: string;
  onChain: boolean;
}> {
  const hash = generateRideHash(record);
  const verificationUrl = `https://amoy.polygonscan.com/search?q=${hash}`;

  if (rideRegistryContract && wallet) {
    try {
      const fareWei = ethers.parseUnits(record.fare.toFixed(2), 18);
      const platformFeeWei = ethers.parseUnits(record.platformFee.toFixed(2), 18);
      const driverShareWei = ethers.parseUnits(record.driverShare.toFixed(2), 18);

      const tx = await rideRegistryContract.recordRide(
        hash,
        fareWei,
        platformFeeWei,
        driverShareWei
      );

      const receipt = await tx.wait();

      return {
        success: true,
        hash,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        verificationUrl: `https://amoy.polygonscan.com/tx/${receipt.hash}`,
        message: "Ride successfully recorded on Polygon blockchain",
        onChain: true,
      };
    } catch (error: any) {
      console.error("Blockchain recording error:", error.message);
      return {
        success: true,
        hash,
        verificationUrl,
        message: `Off-chain hash generated. On-chain recording failed: ${error.message}`,
        onChain: false,
      };
    }
  }

  return {
    success: true,
    hash,
    verificationUrl,
    message: "Verifiable hash generated. Configure BLOCKCHAIN_PRIVATE_KEY and RIDE_REGISTRY_CONTRACT for on-chain recording.",
    onChain: false,
  };
}

export async function verifyRideOnChain(rideHash: string): Promise<BlockchainVerification> {
  if (rideRegistryContract) {
    try {
      const [fare, platformFee, driverShare, timestamp, exists] = 
        await rideRegistryContract.getRide(rideHash);

      if (exists) {
        return {
          isVerified: true,
          rideHash,
          blockchainNetwork: "Polygon Amoy Testnet",
          timestamp: Number(timestamp) * 1000,
          onChainData: {
            fare: ethers.formatUnits(fare, 18),
            platformFee: ethers.formatUnits(platformFee, 18),
            driverShare: ethers.formatUnits(driverShare, 18),
          },
        };
      }
    } catch (error: any) {
      console.error("Verification error:", error.message);
    }
  }

  return {
    isVerified: false,
    rideHash,
    blockchainNetwork: "Polygon Amoy Testnet",
  };
}

export function createRideReceipt(record: RideBlockchainRecord): {
  hash: string;
  receipt: string;
  verificationUrl: string;
} {
  const hash = generateRideHash(record);
  
  const receipt = Buffer.from(JSON.stringify({
    version: "1.0",
    network: "polygon-amoy",
    hash,
    ride: {
      id: record.rideId,
      fare: record.fare.toFixed(2),
      platformFee: record.platformFee.toFixed(2),
      driverShare: record.driverShare.toFixed(2),
      timestamp: record.timestamp.toISOString(),
    },
    signature: hash,
  })).toString("base64");

  const verificationUrl = `https://amoy.polygonscan.com/search?q=${hash}`;

  return { hash, receipt, verificationUrl };
}

export function calculateFeeBreakdown(totalFare: number): {
  platformFee: number;
  driverShare: number;
  platformFeePercent: number;
  driverSharePercent: number;
} {
  const platformFeePercent = 10;
  const driverSharePercent = 90;
  
  const platformFee = totalFare * (platformFeePercent / 100);
  const driverShare = totalFare * (driverSharePercent / 100);

  return {
    platformFee: Math.round(platformFee * 100) / 100,
    driverShare: Math.round(driverShare * 100) / 100,
    platformFeePercent,
    driverSharePercent,
  };
}

export interface TransparencyReport {
  rideId: string;
  hash: string;
  priceBreakdown: {
    baseFare: number;
    distanceCharge: number;
    timeCharge: number;
    surcharges: { name: string; amount: number }[];
    discounts: { name: string; amount: number }[];
    subtotal: number;
    platformFee: number;
    driverEarnings: number;
    total: number;
  };
  blockchain: {
    network: string;
    hash: string;
    verificationUrl: string;
    status: "recorded" | "pending" | "off-chain";
    transactionHash?: string;
  };
  timestamp: string;
}

export function generateTransparencyReport(
  rideId: string,
  pricing: {
    baseFare: number;
    distanceCharge: number;
    timeCharge: number;
    demandMultiplier: number;
    timeOfDayMultiplier: number;
    trafficMultiplier: number;
    total: number;
    platformFee: number;
    driverEarnings: number;
  }
): TransparencyReport {
  const surcharges: { name: string; amount: number }[] = [];
  const discounts: { name: string; amount: number }[] = [];
  
  const baseTotal = pricing.baseFare + pricing.distanceCharge + pricing.timeCharge;
  
  if (pricing.demandMultiplier > 1) {
    surcharges.push({
      name: "High Demand",
      amount: Math.round(baseTotal * (pricing.demandMultiplier - 1) * 100) / 100,
    });
  } else if (pricing.demandMultiplier < 1) {
    discounts.push({
      name: "Low Demand Discount",
      amount: Math.round(baseTotal * (1 - pricing.demandMultiplier) * 100) / 100,
    });
  }

  if (pricing.timeOfDayMultiplier > 1) {
    surcharges.push({
      name: "Peak Hours",
      amount: Math.round(baseTotal * (pricing.timeOfDayMultiplier - 1) * 100) / 100,
    });
  } else if (pricing.timeOfDayMultiplier < 1) {
    discounts.push({
      name: "Off-Peak Discount",
      amount: Math.round(baseTotal * (1 - pricing.timeOfDayMultiplier) * 100) / 100,
    });
  }

  if (pricing.trafficMultiplier > 1) {
    surcharges.push({
      name: "Traffic Conditions",
      amount: Math.round(baseTotal * (pricing.trafficMultiplier - 1) * 100) / 100,
    });
  } else if (pricing.trafficMultiplier < 1) {
    discounts.push({
      name: "Light Traffic Discount",
      amount: Math.round(baseTotal * (1 - pricing.trafficMultiplier) * 100) / 100,
    });
  }

  const hash = generateRideHash({
    rideId,
    customerId: "system",
    driverId: "system",
    pickupAddress: "",
    dropoffAddress: "",
    fare: pricing.total,
    platformFee: pricing.platformFee,
    driverShare: pricing.driverEarnings,
    timestamp: new Date(),
  });

  return {
    rideId,
    hash,
    priceBreakdown: {
      baseFare: pricing.baseFare,
      distanceCharge: pricing.distanceCharge,
      timeCharge: pricing.timeCharge,
      surcharges,
      discounts,
      subtotal: Math.round(baseTotal * 100) / 100,
      platformFee: pricing.platformFee,
      driverEarnings: pricing.driverEarnings,
      total: pricing.total,
    },
    blockchain: {
      network: "Polygon Amoy Testnet",
      hash,
      verificationUrl: `https://amoy.polygonscan.com/search?q=${hash}`,
      status: rideRegistryContract ? "recorded" : "off-chain",
    },
    timestamp: new Date().toISOString(),
  };
}

export async function deployRideRegistry(): Promise<{
  success: boolean;
  contractAddress?: string;
  message: string;
}> {
  if (!wallet) {
    return {
      success: false,
      message: "Wallet not configured. Set BLOCKCHAIN_PRIVATE_KEY environment variable.",
    };
  }

  try {
    const factory = new ethers.ContractFactory(
      RIDE_REGISTRY_ABI,
      RIDE_REGISTRY_BYTECODE,
      wallet
    );

    console.log("Deploying RideRegistry contract...");
    const contract = await factory.deploy();
    await contract.waitForDeployment();

    const address = await contract.getAddress();
    contractAddress = address;
    rideRegistryContract = new ethers.Contract(address, RIDE_REGISTRY_ABI, wallet);

    return {
      success: true,
      contractAddress: address,
      message: `RideRegistry deployed at ${address}. Save this as RIDE_REGISTRY_CONTRACT env var.`,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Deployment failed: ${error.message}`,
    };
  }
}

export function getBlockchainStatus(): {
  connected: boolean;
  network: string;
  contractConfigured: boolean;
  contractAddress: string | null;
  walletConfigured: boolean;
} {
  return {
    connected: provider !== null,
    network: "Polygon Amoy Testnet",
    contractConfigured: rideRegistryContract !== null,
    contractAddress,
    walletConfigured: wallet !== null,
  };
}

const USDT_CONTRACT_ADDRESS = "0xc2132D05D31c914a87C6611C10748AEb04B58e8F";
const USDT_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

export interface UsdtPayoutResult {
  success: boolean;
  txHash?: string;
  amount: number;
  toAddress: string;
  message: string;
  explorerUrl?: string;
}

export async function sendUsdtPayout(
  toAddress: string,
  amountUsd: number
): Promise<UsdtPayoutResult> {
  if (!wallet || !provider) {
    return {
      success: false,
      amount: amountUsd,
      toAddress,
      message: "Blockchain wallet not configured. Set BLOCKCHAIN_PRIVATE_KEY.",
    };
  }

  if (!ethers.isAddress(toAddress)) {
    return {
      success: false,
      amount: amountUsd,
      toAddress,
      message: "Invalid wallet address format.",
    };
  }

  try {
    const usdtContract = new ethers.Contract(USDT_CONTRACT_ADDRESS, USDT_ABI, wallet);
    const decimals = await usdtContract.decimals();
    const amountInUnits = ethers.parseUnits(amountUsd.toFixed(2), decimals);
    
    const balance = await usdtContract.balanceOf(wallet.address);
    if (balance < amountInUnits) {
      return {
        success: false,
        amount: amountUsd,
        toAddress,
        message: `Insufficient USDT balance. Available: ${ethers.formatUnits(balance, decimals)} USDT`,
      };
    }

    const tx = await usdtContract.transfer(toAddress, amountInUnits);
    const receipt = await tx.wait();

    return {
      success: true,
      txHash: receipt.hash,
      amount: amountUsd,
      toAddress,
      message: `Successfully sent ${amountUsd} USDT to ${toAddress}`,
      explorerUrl: `https://polygonscan.com/tx/${receipt.hash}`,
    };
  } catch (error: any) {
    console.error("USDT payout error:", error);
    return {
      success: false,
      amount: amountUsd,
      toAddress,
      message: `Payout failed: ${error.message}`,
    };
  }
}

export async function getCompanyUsdtBalance(): Promise<{
  balance: string;
  address: string | null;
}> {
  if (!wallet || !provider) {
    return { balance: "0", address: null };
  }

  try {
    const usdtContract = new ethers.Contract(USDT_CONTRACT_ADDRESS, USDT_ABI, provider);
    const decimals = await usdtContract.decimals();
    const balance = await usdtContract.balanceOf(wallet.address);
    return {
      balance: ethers.formatUnits(balance, decimals),
      address: wallet.address,
    };
  } catch (error: any) {
    console.error("Error getting USDT balance:", error);
    return { balance: "0", address: wallet?.address || null };
  }
}

export function isWalletConfigured(): boolean {
  return wallet !== null && provider !== null;
}
