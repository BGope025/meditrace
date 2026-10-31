/// <reference path="../../node_modules/@algorandfoundation/tealscript/types/global.d.ts" />

export abstract class Contract {
  programVersion: uint64;
  itxn: any;
  txn: ThisTxnParams;
  txnGroup: Txn[];
  lastInnerGroup: Txn[];
  app: AppID;
  pendingGroup: any;
  createApplication(...args: any[]): void;
  updateApplication(...args: any[]): void;
  deleteApplication(...args: any[]): void;
  optInToApplication(...args: any[]): void;
  closeOutOfApplication(...args: any[]): void;
  clearState(): void;
}

export default Contract;
