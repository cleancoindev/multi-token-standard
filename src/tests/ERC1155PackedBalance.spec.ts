import * as ethers from 'ethers'

import { AbstractContract, expect, BigNumber, RevertError } from './utils'
import * as utils from './utils'

import { ERC1155MetaMintBurnPackedBalanceMock } from 'typings/contracts/ERC1155MetaMintBurnPackedBalanceMock'
import { ERC1155ReceiverMock } from 'typings/contracts/ERC1155ReceiverMock'
import { ERC1155OperatorMock } from 'typings/contracts/ERC1155OperatorMock'

// init test wallets from package.json mnemonic
const web3 = (global as any).web3

const {
  wallet: ownerWallet,
  provider: ownerProvider,
  signer: ownerSigner
} = utils.createTestWallet(web3, 0)

const {
  wallet: receiverWallet,
  provider: receiverProvider,
  signer: receiverSigner
} = utils.createTestWallet(web3, 2)

const {
  wallet: operatorWallet,
  provider: operatorProvider,
  signer: operatorSigner
} = utils.createTestWallet(web3, 4)


contract('ERC1155PackedBalance', (accounts: string[]) => {

  const LARGEVAL = new BigNumber(2).pow(256).sub(2) // 2**256 - 2
  const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

  let ownerAddress: string
  let receiverAddress: string
  let operatorAddress: string
  let erc1155Abstract: AbstractContract
  let operatorAbstract: AbstractContract

  let erc1155Contract: ERC1155MetaMintBurnPackedBalanceMock
  let operatorERC1155Contract: ERC1155MetaMintBurnPackedBalanceMock


  // load contract abi and deploy to test server
  before(async () => {
    ownerAddress = await ownerWallet.getAddress()
    receiverAddress = await receiverWallet.getAddress()
    operatorAddress = await operatorWallet.getAddress()

    erc1155Abstract = await AbstractContract.fromArtifactName('ERC1155MetaMintBurnPackedBalanceMock')
    operatorAbstract = await AbstractContract.fromArtifactName('ERC1155OperatorMock')
  })

  // deploy before each test, to reset state of contract
  beforeEach(async () => {
    erc1155Contract = await erc1155Abstract.deploy(ownerWallet) as ERC1155MetaMintBurnPackedBalanceMock 
    operatorERC1155Contract = await erc1155Contract.connect(operatorSigner) as ERC1155MetaMintBurnPackedBalanceMock
  })

  describe('Bitwise functions', () => {

    it('getValueInBin should return expected balance for given types', async () => {
      let expected = new BigNumber(2).pow(32).sub(2) // 2**32-2
      let balance = await erc1155Contract.functions.getValueInBin(LARGEVAL.toString(), 0)
      expect(balance).to.be.eql(expected)
    })

    // it('viewUpdateIDBalance should revert if overflow', async () => {
    //   let targetVal  = 666
    //   let tx = erc1155Contract.functions.viewUpdateIDBalance()
    //   await expect(tx).to.be.rejectedWith( RevertError("ERC1155PackedBalance#safeTransferFrom: INVALID_OPERATOR") )
    // })

    // it('writeValueInBin should throw if value is above 2**32-1', async () => {
    //   let targetVal  = new BigNumber(2).pow(32)
    //   let writtenBin = erc1155Contract.functions.writeValueInBin(LARGEVAL.toString(), 0, targetVal.toString())
    //   await expect(writtenBin).to.be.rejected
    // })

    it('getIDBinIndex should return the correct bin and respective index', async () => {
      const { bin: bin0, index: index0 } = await erc1155Contract.functions.getIDBinIndex(0)
      expect(bin0).to.be.eql(new BigNumber(0))
      expect(index0).to.be.eql(new BigNumber(0))

      const { bin: bin3, index: index3 } = await erc1155Contract.functions.getIDBinIndex(3)
      expect(bin3).to.be.eql(new BigNumber(0))
      expect(index3).to.be.eql(new BigNumber(3))

      const { bin: bin9, index: index9 } = await erc1155Contract.functions.getIDBinIndex(8)
      expect(bin9).to.be.eql(new BigNumber(1))
      expect(index9).to.be.eql(new BigNumber(0))

      const { bin: bin15, index: index15 } = await erc1155Contract.functions.getIDBinIndex(15)
      expect(bin15).to.be.eql(new BigNumber(1))
      expect(index15).to.be.eql(new BigNumber(7))
    })

  })


  describe('Getter functions', () => {

    beforeEach(async () => {
      await erc1155Contract.functions.mintMock(ownerAddress, 5, 256, [])
      await erc1155Contract.functions.mintMock(receiverAddress, 66, 133, [])
    })

    it('balanceOf() should return types balance for queried address', async () => {
      let balance5 = await erc1155Contract.functions.balanceOf(ownerAddress, 5)
      expect(balance5).to.be.eql(new BigNumber(256))

      let balance16 = await erc1155Contract.functions.balanceOf(ownerAddress, 16)
      expect(balance16).to.be.eql(new BigNumber(0))
    })

    it('balanceOfBatch() should return types balance for queried addresses', async () => {
      let balances = await erc1155Contract.functions.balanceOfBatch([ownerAddress, receiverAddress], [5, 66])
      expect(balances[0]).to.be.eql(new BigNumber(256))
      expect(balances[1]).to.be.eql(new BigNumber(133))

      let balancesNull = await erc1155Contract.functions.balanceOfBatch([ownerAddress, receiverAddress], [1337, 1337])
      expect(balancesNull[0]).to.be.eql(new BigNumber(0))
      expect(balancesNull[1]).to.be.eql(new BigNumber(0))
    })

  })


  describe('safeTransferFrom() function', () => {

    let receiverContract: ERC1155ReceiverMock
    let operatorContract: ERC1155OperatorMock

    beforeEach(async () => {
      let abstract = await AbstractContract.fromArtifactName('ERC1155ReceiverMock')
      receiverContract = await abstract.deploy(ownerWallet) as ERC1155ReceiverMock
      operatorContract = await operatorAbstract.deploy(operatorWallet) as ERC1155OperatorMock

      await erc1155Contract.functions.mintMock(ownerAddress, 0, 256, [])
    })

    it('should be able to transfer if sufficient balance', async () => {
      const tx = erc1155Contract.functions.safeTransferFrom(ownerAddress, receiverAddress, 0, 1, [])
      await expect(tx).to.be.fulfilled
    })

    it('should REVERT if insufficient balance', async () => {
      const tx = erc1155Contract.functions.safeTransferFrom(ownerAddress, receiverAddress, 0, 257, [])
      await expect(tx).to.be.rejectedWith( RevertError("ERC1155PackedBalance#_viewUpdateBinValue: UNDERFLOW") )
    })

    it('should REVERT if sending to 0x0', async () => {
      const tx = erc1155Contract.functions.safeTransferFrom(ownerAddress, ZERO_ADDRESS, 0, 1, [])
      await expect(tx).to.be.rejectedWith( RevertError("ERC1155PackedBalance#safeTransferFrom: INVALID_RECIPIENT") )
    })

    it('should REVERT if operator not approved', async () => {
      const tx = operatorERC1155Contract.functions.safeTransferFrom(ownerAddress, receiverAddress, 0, 1, [])
      await expect(tx).to.be.rejectedWith( RevertError("ERC1155PackedBalance#safeTransferFrom: INVALID_OPERATOR") )
    })

    it('should be able to transfer via operator if operator is approved', async () => {
      // owner first gives operatorWallet address approval permission
      await erc1155Contract.functions.setApprovalForAll(operatorAddress, true)

      // operator performs a transfer
      const tx = operatorERC1155Contract.functions.safeTransferFrom(ownerAddress, receiverAddress, 0, 1, [])
      await expect(tx).to.be.fulfilled
    })

    it('should REVERT if transfer leads to overflow', async () => {
      await erc1155Contract.functions.mintMock(receiverAddress, 0, new BigNumber(2).pow(32).sub(1), [])
      const tx = erc1155Contract.functions.safeTransferFrom(ownerAddress, receiverAddress, 0, 1, [])
      await expect(tx).to.be.rejectedWith( RevertError("ERC1155PackedBalance#_viewUpdateBinValue: OVERFLOW") )
    })

    it('should REVERT when sending to non-receiver contract', async () => {
      const tx = erc1155Contract.functions.safeTransferFrom(ownerAddress, erc1155Contract.address, 0, 1, [])
      await expect(tx).to.be.rejectedWith(RevertError("ERC1155MetaMintBurnPackedBalanceMock: INVALID_METHOD"));
    })

    it('should REVERT if invalid response from receiver contract', async () => {
      await receiverContract.functions.setShouldReject(true)

      const tx = erc1155Contract.functions.safeTransferFrom(ownerAddress, receiverContract.address, 0, 1, [])
      await expect(tx).to.be.rejectedWith( RevertError("ERC1155PackedBalance#_callonERC1155Received: INVALID_ON_RECEIVE_MESSAGE") )
    })

    it('should pass if valid response from receiver contract', async () => {
      const tx = erc1155Contract.functions.safeTransferFrom(ownerAddress, receiverContract.address, 0, 1, [])
      await expect(tx).to.be.fulfilled
    })

    it('should pass if data is not null from receiver contract', async () => {
      const data = ethers.utils.toUtf8Bytes('hello')

      // NOTE: typechain generates the wrong type for `bytes` type at this time
      // see https://github.com/ethereum-ts/TypeChain/issues/123
      // @ts-ignore
      const tx = erc1155Contract.functions.safeTransferFrom(ownerAddress, receiverContract.address, 0, 1, data)
      await expect(tx).to.be.fulfilled
    })

    it('should have balances updated before onERC1155Received is called', async () => {
      let filterFromReceiverContract: ethers.ethers.EventFilter

      const fromPreBalance = await erc1155Contract.functions.balanceOf(ownerAddress, 0);
      const toPreBalance = await erc1155Contract.functions.balanceOf(receiverContract.address, 0);

      // Get event filter to get internal tx event
      filterFromReceiverContract = receiverContract.filters.TransferSingleReceiver(null, null, null, null);

      await erc1155Contract.functions.safeTransferFrom(ownerAddress, receiverContract.address, 0, 1, [])

      // Get logs from internal transaction event
      // @ts-ignore (https://github.com/ethers-io/ethers.js/issues/204#issuecomment-427059031)
      filterFromReceiverContract.fromBlock = 0;
      
      let logs = await ownerProvider.getLogs(filterFromReceiverContract);
      let args = receiverContract.interface.events.TransferSingleReceiver.decode(logs[0].data, logs[0].topics)

      expect(args._from).to.be.eql(ownerAddress)
      expect(args._to).to.be.eql(receiverContract.address)
      expect(args._fromBalance).to.be.eql(fromPreBalance.sub(1))
      expect(args._toBalance).to.be.eql(toPreBalance.add(1))
    })

    it('should have TransferSingle event emitted before onERC1155Received is called', async () => {
      // Get event filter to get internal tx event
      let tx = await erc1155Contract.functions.safeTransferFrom(ownerAddress, receiverContract.address, 0, 1, [])
      const receipt = await tx.wait(1)

      const firstEventTopic = receipt.logs![0].topics[0]
      const secondEventTopic = receipt.logs![1].topics[0]

      expect(firstEventTopic).to.be.equal(erc1155Contract.interface.events.TransferSingle.topic)
      expect(secondEventTopic).to.be.equal(receiverContract.interface.events.TransferSingleReceiver.topic)
    })

    context('When successful transfer', () => {
      let tx: ethers.ContractTransaction

      beforeEach(async () => {
        tx = await erc1155Contract.functions.safeTransferFrom(ownerAddress, receiverAddress, 0, 1, [])
      })

      it('should correctly update balance of sender', async () => {
        const balance = await erc1155Contract.functions.balanceOf(ownerAddress, 0)
        expect(balance).to.be.eql(new BigNumber(255))
      })

      it('should correctly update balance of receiver', async () => {
        const balance = await erc1155Contract.functions.balanceOf(receiverAddress, 0)
        expect(balance).to.be.eql(new BigNumber(1))
      })

      describe('TransferSingle event', async () => {

        let filterFromOperatorContract: ethers.ethers.EventFilter

        it('should emit TransferSingle event', async () => {
          const receipt = await tx.wait(1)
          const ev = receipt.events!.pop()!
          expect(ev.event).to.be.eql('TransferSingle')
        })

        it('should have `msg.sender` as `_operator` field, not _from', async () => {
          await erc1155Contract.functions.setApprovalForAll(operatorAddress, true)

          tx = await operatorERC1155Contract.functions.safeTransferFrom(ownerAddress, receiverAddress, 0, 1, [])
          const receipt = await tx.wait(1)
          const ev = receipt.events!.pop()!

          const args = ev.args! as any
          expect(args._operator).to.be.eql(operatorAddress)
        })

        it('should have `msg.sender` as `_operator` field, not tx.origin', async () => {

          // Get event filter to get internal tx event
          filterFromOperatorContract = erc1155Contract.filters.TransferSingle(operatorContract.address, null, null, null, null);

          // Set approval to operator contract
          await erc1155Contract.functions.setApprovalForAll(operatorContract.address, true)

          // Execute transfer from operator contract
          // @ts-ignore (https://github.com/ethereum-ts/TypeChain/issues/118)
          await operatorContract.functions.safeTransferFrom(erc1155Contract.address, ownerAddress, receiverAddress, 0, 1, [],
            {gasLimit: 1000000} // INCORRECT GAS ESTIMATION
          )

          // Get logs from internal transaction event
          // @ts-ignore (https://github.com/ethers-io/ethers.js/issues/204#issuecomment-427059031)
          filterFromOperatorContract.fromBlock = 0;
          let logs = await operatorProvider.getLogs(filterFromOperatorContract);
          let args = erc1155Contract.interface.events.TransferSingle.decode(logs[0].data, logs[0].topics)

          // operator arg should be equal to msg.sender, not tx.origin
          expect(args._operator).to.be.eql(operatorContract.address)
        })

      })
    })
  })

  describe('safeBatchTransferFrom() function', () => {

    let types: any[], values: any[]
    let nTokenTypes    = 30 //2300 for 2**32 and 3200 for 2**8
    let nTokensPerType = 10

    let receiverContract: ERC1155ReceiverMock

    beforeEach(async () => {
      types  = [], values = []

      // Minting enough values for transfer for each types
      for (let i = 0; i < nTokenTypes; i++) {
        types.push(i)
        values.push(nTokensPerType)
      }
      await erc1155Contract.functions.batchMintMock(ownerAddress, types, values, [])

      const abstract = await AbstractContract.fromArtifactName('ERC1155ReceiverMock')
      receiverContract = await abstract.deploy(ownerWallet) as ERC1155ReceiverMock
    })

    it('should be able to transfer if sufficient balances', async () => {
      const tx = erc1155Contract.functions.safeBatchTransferFrom(ownerAddress, receiverAddress, types, values, [])
      await expect(tx).to.be.fulfilled
    })

    it('should PASS if arrays are empty', async () => {
      const tx = erc1155Contract.functions.safeBatchTransferFrom(ownerAddress, receiverAddress, [], [], [])
      await expect(tx).to.be.fulfilled
    })

    it('should REVERT if insufficient balance', async () => {
      let valuesPlusOne = values.map(value => value+1)
      const tx = erc1155Contract.functions.safeBatchTransferFrom(ownerAddress, receiverAddress, types, valuesPlusOne, [])
      await expect(tx).to.be.rejectedWith( RevertError("ERC1155PackedBalance#_viewUpdateBinValue: UNDERFLOW") )
    })

    it('should REVERT if single insufficient balance', async () => {
      let valuesPlusOne = values.slice(0)
      valuesPlusOne[0] = valuesPlusOne[0] + 1
      const tx = erc1155Contract.functions.safeBatchTransferFrom(ownerAddress, receiverAddress, types, valuesPlusOne, [])
      await expect(tx).to.be.rejectedWith( RevertError("ERC1155PackedBalance#_viewUpdateBinValue: UNDERFLOW") )
    })

    it('should REVERT if operator not approved', async () => {
      const tx = operatorERC1155Contract.functions.safeBatchTransferFrom(ownerAddress, receiverAddress, types, values, [])
      await expect(tx).to.be.rejectedWith( RevertError( "ERC1155PackedBalance#safeBatchTransferFrom: INVALID_OPERATOR") )
    })

    it('should REVERT if length of ids and values are not equal', async () => {
      const tx1 = erc1155Contract.functions.safeBatchTransferFrom(ownerAddress, receiverAddress, [0, 15, 30, 0], [1, 9, 10], [])
      await expect(tx1).to.be.rejectedWith( RevertError("ERC1155PackedBalance#_safeBatchTransferFrom: INVALID_ARRAYS_LENGTH") )

      const tx2 = erc1155Contract.functions.safeBatchTransferFrom(ownerAddress, receiverAddress, [0, 15, 30], [1, 9, 10, 0], [])
      await expect(tx2).to.be.rejectedWith( RevertError("ERC1155PackedBalance#_safeBatchTransferFrom: INVALID_ARRAYS_LENGTH") )
    })

    it('should REVERT if sending to 0x0', async () => {
      const tx = erc1155Contract.functions.safeBatchTransferFrom(ownerAddress, ZERO_ADDRESS, types, values, [])
      await expect(tx).to.be.rejectedWith( RevertError("ERC1155PackedBalance#safeBatchTransferFrom: INVALID_RECIPIENT") )
    })

    it('should be able to transfer via operator if operator is approved', async () => {
      await erc1155Contract.functions.setApprovalForAll(operatorAddress, true)

      const tx = operatorERC1155Contract.functions.safeBatchTransferFrom(ownerAddress, receiverAddress, types, values, [])
      await expect(tx).to.be.fulfilled
    })

    it('should REVERT if transfer leads to overflow', async () => {
      await erc1155Contract.functions.mintMock(receiverAddress, types[0], new BigNumber(2).pow(32).sub(1), [])
      
      const tx = erc1155Contract.functions.safeBatchTransferFrom(ownerAddress, receiverAddress, [types[0], types[2]], [1, 1], [])
      await expect(tx).to.be.rejectedWith( RevertError("ERC1155PackedBalance#_viewUpdateBinValue: OVERFLOW") )
    })

    it('should update balances of sender and receiver', async () => {
      await erc1155Contract.functions.safeBatchTransferFrom(ownerAddress, receiverAddress, types, values, [])
      let balanceFrom: ethers.utils.BigNumber
      let balanceTo: ethers.utils.BigNumber

      for (let i = 0; i < types.length; i++) {
        balanceFrom = await erc1155Contract.functions.balanceOf(ownerAddress, types[i])
        balanceTo   = await erc1155Contract.functions.balanceOf(receiverAddress, types[i])

        expect(balanceFrom).to.be.eql(new BigNumber(0))
        expect(balanceTo).to.be.eql(new BigNumber(values[i]))
      }
    })

    it('should REVERT when sending to non-receiver contract', async () => {
      const tx = erc1155Contract.functions.safeBatchTransferFrom(ownerAddress, erc1155Contract.address, types, values, [],
        {gasLimit: 2000000}
      )
      await expect(tx).to.be.rejectedWith(RevertError("ERC1155MetaMintBurnPackedBalanceMock: INVALID_METHOD"));
    })

    it('should REVERT if invalid response from receiver contract', async () => {
      await receiverContract.functions.setShouldReject(true)
      const tx = erc1155Contract.functions.safeBatchTransferFrom(ownerAddress, receiverContract.address, types, values, [],
        {gasLimit: 2000000}
      )
      await expect(tx).to.be.rejectedWith( RevertError("ERC1155PackedBalance#_callonERC1155BatchReceived: INVALID_ON_RECEIVE_MESSAGE") )
    })

    it('should pass if valid response from receiver contract', async () => {
      const tx = erc1155Contract.functions.safeBatchTransferFrom(ownerAddress, receiverContract.address, types, values, [],
        {gasLimit: 2000000}
      )
      await expect(tx).to.be.fulfilled
    })

    it('should pass if data is not null from receiver contract', async () => {
      const data = ethers.utils.toUtf8Bytes('hello')

      // TODO: remove ts-ignore when contract declaration is fixed
      // @ts-ignore
      const tx = erc1155Contract.functions.safeBatchTransferFrom(ownerAddress, receiverContract.address, types, values, data,
        {gasLimit: 2000000}
      )
      await expect(tx).to.be.fulfilled
    })

    it('should have balances updated before onERC1155BatchReceived is called', async () => {
      let filterFromReceiverContract: ethers.ethers.EventFilter

      let fromAddresses = Array(types.length).fill(ownerAddress)
      let toAddresses = Array(types.length).fill(receiverContract.address)

      const fromPreBalances = await erc1155Contract.functions.balanceOfBatch(fromAddresses, types);
      const toPreBalances = await erc1155Contract.functions.balanceOfBatch(toAddresses, types);

      // Get event filter to get internal tx event
      filterFromReceiverContract = receiverContract.filters.TransferBatchReceiver(null, null, null, null);

      await erc1155Contract.functions.safeBatchTransferFrom(ownerAddress, receiverContract.address, types, values, [],
        {gasLimit: 2000000}
      )

      // Get logs from internal transaction event
      // @ts-ignore (https://github.com/ethers-io/ethers.js/issues/204#issuecomment-427059031)
      filterFromReceiverContract.fromBlock = 0;
      
      let logs = await ownerProvider.getLogs(filterFromReceiverContract);
      let args = receiverContract.interface.events.TransferBatchReceiver.decode(logs[0].data, logs[0].topics)

      expect(args._from).to.be.eql(ownerAddress)
      expect(args._to).to.be.eql(receiverContract.address)
      for (let i = 0; i < types.length; i++) {
        expect(args._fromBalances[i]).to.be.eql(fromPreBalances[i].sub(values[i]))
        expect(args._toBalances[i]).to.be.eql(toPreBalances[i].add(values[i]))
      }
    })

    it('should have TransferBatch event emitted before onERC1155BatchReceived is called', async () => {
      // Get event filter to get internal tx event
      let tx = await erc1155Contract.functions.safeBatchTransferFrom(ownerAddress, receiverContract.address, types, values, [],
        {gasLimit: 2000000}
      )
      const receipt = await tx.wait(1)

      const firstEventTopic = receipt.logs![0].topics[0]
      const secondEventTopic = receipt.logs![1].topics[0]

      expect(firstEventTopic).to.be.equal(erc1155Contract.interface.events.TransferBatch.topic)
      expect(secondEventTopic).to.be.equal(receiverContract.interface.events.TransferBatchReceiver.topic)
    })

    describe('TransferBatch event', async () => {

      let tx: ethers.ContractTransaction
      let filterFromOperatorContract: ethers.ethers.EventFilter
      let operatorContract: ERC1155OperatorMock

      beforeEach(async () => {
        operatorContract = await operatorAbstract.deploy(operatorWallet) as ERC1155OperatorMock
      })

      it('should emit 1 TransferBatch events of N transfers', async () => {
        const tx = await erc1155Contract.functions.safeBatchTransferFrom(ownerAddress, receiverAddress, types, values, [])
        const receipt = await tx.wait(1)
        const ev = receipt.events!.pop()!
        expect(ev.event).to.be.eql('TransferBatch')

        const args = ev.args! as any
        expect(args._ids.length).to.be.eql(types.length)
      })

      it('should have `msg.sender` as `_operator` field, not _from', async () => {
        await erc1155Contract.functions.setApprovalForAll(operatorAddress, true)

        tx = await operatorERC1155Contract.functions.safeBatchTransferFrom(ownerAddress, receiverAddress, types, values, [])
        const receipt = await tx.wait(1)
        const ev = receipt.events!.pop()!

        const args = ev.args! as any
        expect(args._operator).to.be.eql(operatorAddress)
      })

      it('should have `msg.sender` as `_operator` field, not tx.origin', async () => {

        // Get event filter to get internal tx event
        filterFromOperatorContract = erc1155Contract.filters.TransferBatch(operatorContract.address, null, null, null, null);

        // Set approval to operator contract
        await erc1155Contract.functions.setApprovalForAll(operatorContract.address, true)

        // Execute transfer from operator contract
        // @ts-ignore (https://github.com/ethereum-ts/TypeChain/issues/118)
        await operatorContract.functions.safeBatchTransferFrom(erc1155Contract.address, ownerAddress, receiverAddress, types, values, [], 
          {gasLimit: 1000000} // INCORRECT GAS ESTIMATION
        )

        // Get logs from internal transaction event
        // @ts-ignore (https://github.com/ethers-io/ethers.js/issues/204#issuecomment-427059031)
        filterFromOperatorContract.fromBlock = 0;
        let logs = await operatorProvider.getLogs(filterFromOperatorContract);
        let args = erc1155Contract.interface.events.TransferBatch.decode(logs[0].data, logs[0].topics)


        // operator arg should be equal to msg.sender, not tx.origin
        expect(args._operator).to.be.eql(operatorContract.address)
      })
    })

    describe('self-transfers', async () => {
      let selfID = 918273123
      let selfAmount = new BigNumber(1000);
      let tx;

      beforeEach(async () => {
        await erc1155Contract.functions.mintMock(ownerAddress, selfID, selfAmount, [])
        tx = await erc1155Contract.functions.safeBatchTransferFrom(ownerAddress, ownerAddress, [selfID, selfID], [0, selfAmount], [])
      })

      it('should not inflate supply when transfering to self', async () => {
        const balance = await erc1155Contract.functions.balanceOf(ownerAddress, selfID);
        expect(balance).to.be.eql(selfAmount)
      })

      it('should REVERT if insufficient funds', async () => {
        let tx1 = erc1155Contract.functions.safeBatchTransferFrom(ownerAddress, ownerAddress, [selfID, selfID], [0, selfAmount.add(1)], [])
        await expect(tx1).to.be.rejectedWith( RevertError("ERC1155PackedBalance#_safeBatchTransferFrom: UNDERFLOW") )

        let tx2 = erc1155Contract.functions.safeBatchTransferFrom(ownerAddress, ownerAddress, [selfID, selfID + 1], [selfAmount, 1], [])
        await expect(tx2).to.be.rejectedWith( RevertError("ERC1155PackedBalance#_safeBatchTransferFrom: UNDERFLOW") )
      })

      it('should emit 1 TransferBatch events of N transfers', async () => {
        const receipt = await tx.wait(1)
        const ev = receipt.events!.pop()!
        expect(ev.event).to.be.eql('TransferBatch')

        const args = ev.args! as any
        expect(args._ids.length).to.be.eql(2)
      })

      it('should emit 1 TransferBatch events of N transfers of same ID', async () => {
        const receipt = await tx.wait(1)
        const ev = receipt.events!.pop()!
        expect(ev.event).to.be.eql('TransferBatch')

        const args = ev.args! as any
        expect(args._ids.length).to.be.eql(2)
      })

    })
  })


  describe('setApprovalForAll() function', () => {

    it('should emit an ApprovalForAll event', async () => {
      const tx = await erc1155Contract.functions.setApprovalForAll(operatorAddress, true)
      const receipt = await tx.wait(1)

      expect(receipt.events![0].event).to.be.eql('ApprovalForAll')
    })

    it('should set the operator status to _status argument', async () => {
      const tx = erc1155Contract.functions.setApprovalForAll(operatorAddress, true)
      await expect(tx).to.be.fulfilled

      const status = await erc1155Contract.functions.isApprovedForAll(ownerAddress, operatorAddress)
      expect(status).to.be.eql(true)
    })


    context('When the operator was already an operator', () => {
      beforeEach(async () => {
        await erc1155Contract.functions.setApprovalForAll(operatorAddress, true)
      })

      it('should leave the operator status to set to true again', async () => {
        const tx = erc1155Contract.functions.setApprovalForAll(operatorAddress, true)
        await expect(tx).to.be.fulfilled

        const status = await erc1155Contract.functions.isApprovedForAll(ownerAddress, operatorAddress)
        expect(status).to.be.eql(true)
      })

      it('should allow the operator status to be set to false', async () => {
        const tx = erc1155Contract.functions.setApprovalForAll(operatorAddress, false)
        await expect(tx).to.be.fulfilled

        const status = await erc1155Contract.functions.isApprovedForAll(operatorAddress, ownerAddress)
        expect(status).to.be.eql(false)
      })
    })

  })

  describe('Supports ERC165', () => {
    describe('supportsInterface()', () => {
      it('should return true for 0x01ffc9a7', async () => {
        const support = await erc1155Contract.functions.supportsInterface('0x01ffc9a7')
        expect(support).to.be.eql(true)
      })

      it('should return true for 0xd9b67a26', async () => {
        const support = await erc1155Contract.functions.supportsInterface('0xd9b67a26')
        expect(support).to.be.eql(true)
      })
    })
  })

})
