import { Wallet } from 'ethers'
import { BigNumber } from 'ethers/utils'

export type GasReceipt = {
  gasLimit: number | string | BigNumber;
  baseGas: number | string | BigNumber;
  gasPrice: number | string | BigNumber;
  feeRecipient: string;
  feeTokenData: string | Uint8Array;
};

export type TransferSignature = {
  contractAddress: string;
  signerWallet: Wallet;
  from?: string;
  receiver: string;
  id: number | string | BigNumber;
  amount: number | string | BigNumber;
  isGasFee: boolean;
  transferData: Uint8Array | null;
  nonce: BigNumber;
}

export type BatchTransferSignature = {
  contractAddress: string;
  signerWallet: Wallet;
  from?: string;
  receiver: string;
  ids: number[] | string[] | BigNumber[];
  amounts: number[] | string[] | BigNumber[];
  isGasFee: boolean;
  transferData: Uint8Array | null;
  nonce: BigNumber;
}


export type ApprovalSignature = {
  contractAddress: string;
  signerWallet: Wallet;
  owner?: string;
  operator: string;
  approved: boolean;
  isGasFee: boolean;
  nonce: BigNumber;
}