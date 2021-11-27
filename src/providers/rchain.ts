import {Provider} from '@loopback/core';
const rchainToolkit = require("rchain-toolkit");
import { ec } from 'elliptic';
const { masterTerm, deployBoxTerm, deployTerm, createPursesTerm, readBoxTerm } = require('rchain-token');

interface Demo {
    masterRegistryUri: string,
    publisherPrivKey: string,
    attestorPrivKey: string,
    alicePrivKey: string,
    bobPrivKey: string
}

const log = console.log;


const getDepth = () => {
    return undefined;
};
  
const getContractDepth = () => {
    return undefined;
};

const prepareDeploy = async (
    httpUrlReadOnly: string,
    publicKey: string,
    timestamp: number
  ) => {
    let prepareDeployResponse;
    try {
      prepareDeployResponse = await rchainToolkit.http.prepareDeploy(
        httpUrlReadOnly,
        {
          deployer: publicKey,
          timestamp: timestamp,
          nameQty: 1,
        }
      );
    } catch (err) {
      console.log(err);
      throw new Error('Unable to prepare deploy');
    }
  
    return prepareDeployResponse;
  };

const validAfterBlockNumber = async (httpUrlReadOnly: string) => {
    let validAfterBlockNumberResponse;
    try {
      validAfterBlockNumberResponse = JSON.parse(
        await rchainToolkit.http.blocks(httpUrlReadOnly, {
          position: 1,
        })
      )[0].blockNumber;
    } catch (err) {
      log('Unable to get last finalized block', 'error');
      console.log(err);
      throw new Error();
    }
    return validAfterBlockNumberResponse;
  };
  
  const secp256k1 = new ec('secp256k1');
  const escrowPrivKey = "6428f75c09db8b3a260fc1dcb1c93619bd3eecf6787b003ddc6ba5e87025c177";
  const escrowPubKey = "043d2800b8d261797f81a64c96ee80774c2e2b54990fe6740baae593927c0df5f1abb13d10799c691910b22a230252f1f2b5a71da992c456d82ca037ad7daac4f9";
  const escrowRevAddr = "11112mRAo9XhffmTDvWnqTMAqBoQJzuFqjzChY1R2nkC3f2KvCA96g";
  
  const READ_ONLY_HOST = "https://gracious-pare-6c4c99.netlify.app";
  const VALIDATOR_HOST = "https://gracious-pare-6c4c99.netlify.app";

  const waitForUnforgeable = (name: string) => {
    try {
      return new Promise((resolve, reject) => {
        const interval = setInterval(() => {
          try {
            let resp: string | undefined = undefined;
            rchainToolkit.http
              .dataAtName(READ_ONLY_HOST, {
                name: {
                  UnforgPrivate: { data: name },
                },
                depth: 3,
              })
              .then((dataAtNameResponse: string) => {
                resp = dataAtNameResponse;
                if (
                  resp &&
                  JSON.parse(resp) &&
                  JSON.parse(resp).exprs &&
                  JSON.parse(resp).exprs.length
                ) {
                  resolve(resp);
                  clearInterval(interval);
                } else {
                  console.log('  .');
                }
              })
              .catch((err: string) => {
                console.log(resp);
                console.log(err);
                throw new Error('wait for unforgeable name');
              });
          } catch (err) {
            console.log(err);
            throw new Error('wait for unforgeable name');
          }
        }, 4000);
      });
    } catch (err) {
      console.log(err);
      throw new Error('wait for unforgeable name');
    }
  };
  
  /**
   * Rholang code to transfer REVs
   * https://github.com/rchain/rchain/blob/3eca061/rholang/examples/vault_demo/3.transfer_funds.rho
   *
   * NOTE: Leading whitespaces are removed to fix strange bug in Trezor<->Metamask communication.
   * https://github.com/tgrospic/rnode-client-js/issues/22
   */
  const transferFundsTerm = (revAddrFrom: string, revAddrTo: string, amount: number) => `
   new basket, rl(\`rho:registry:lookup\`), RevVaultCh in {
   rl!(\`rho:rchain:revVault\`, *RevVaultCh) |
   for (@(_, RevVault) <- RevVaultCh) {
   new vaultCh, vaultTo, revVaultkeyCh,
   deployerId(\`rho:rchain:deployerId\`)
   in {
   match ("${revAddrFrom}", "${revAddrTo}", ${amount}) {
   (revAddrFrom, revAddrTo, amount) => {
   @RevVault!("findOrCreate", revAddrFrom, *vaultCh) |
   @RevVault!("findOrCreate", revAddrTo, *vaultTo) |
   @RevVault!("deployerAuthKey", *deployerId, *revVaultkeyCh) |
   for (@vault <- vaultCh; key <- revVaultkeyCh; _ <- vaultTo) {
   match vault {
   (true, vault) => {
   new resultCh in {
   @vault!("transfer", revAddrTo, amount, *key, *resultCh) |
   for (@result <- resultCh) {
   match result {
   (true , _  ) => basket!({ "status": "completed", "message": "Transfer successful (not yet finalized)." }) 
   (false, err) => basket!({ "status": "failed", "message": err }) 
   }
   }
   }
   }
   err => {
   basket!({ "status": "failed", "message": "REV vault cannot be found or created." }) 
   }
   }
   }
   }
   }
   }
   }
   }
   `
  
  const fundWallet = async (revAddrFrom: string, revAddrTo: string, amount: number) => {
    const timestamp = new Date().getTime();
    const vab = await validAfterBlockNumber(READ_ONLY_HOST);
    const pd = await prepareDeploy(
      READ_ONLY_HOST,
      escrowPubKey,
      timestamp
    );
  
    const term = transferFundsTerm(revAddrFrom, revAddrTo, amount);
  
    const deployOptions = await rchainToolkit.utils.getDeployOptions(
      'secp256k1',
      timestamp,
      term,
      escrowPrivKey,
      escrowPubKey,
      1,
      10000000,
      vab || -1
    );
  
    try {
      const deployResponse = await rchainToolkit.http.deploy(
        VALIDATOR_HOST,
        deployOptions
      );
      if (!deployResponse.startsWith('"Success!')) {
        log('Unable to deploy');
        console.log(deployResponse);
      }
      if (deployResponse.startsWith('"Success!')) {
        console.info("funded successfully");
      }
  
      const dataAtNameResponse = await waitForUnforgeable(JSON.parse(pd).names[0]);
      if (typeof dataAtNameResponse === 'string') {
        const data = rchainToolkit.utils.rhoValToJs(
            JSON.parse(dataAtNameResponse).exprs[0].expr
        );
        if (data && data.status !== 'completed') {
            console.log(data);
        }
      }
  
    } catch (err) {
      log('Unable to deploy');
      console.log(err);
    }
  }
  
  const deployMaster = async (publisherPrivKey: string) => {
    const depth = getDepth() ?? 3;
    const contractDepth = getContractDepth() ?? 2;
  
    const publicKey = rchainToolkit.utils.publicKeyFromPrivateKey(
      publisherPrivKey
    );
  
    const timestamp = new Date().getTime();
    const vab = await validAfterBlockNumber(READ_ONLY_HOST);
    const pd = await prepareDeploy(
      READ_ONLY_HOST,
      publicKey,
      timestamp
    );
  
    const term = masterTerm({
      depth: depth,
      contractDepth: contractDepth,
    });
  
    //  .replace('/*DEFAULT_BAGS_IDS*/', defaultBagsIdsRholang)
    //   .replace('/*DEFAULT_BAGS*/', defaultBagsRholang)
    //   .replace('/*DEFAULT_BAGS_DATA*/', defaultBagsDataRholang);
  
    log('✓ prepare deploy');
  
    const deployOptions = await rchainToolkit.utils.getDeployOptions(
      'secp256k1',
      timestamp,
      term,
      publisherPrivKey,
      publicKey,
      1,
      10000000,
      vab || -1
    );
  
    try {
      const deployResponse = await rchainToolkit.http.deploy(
        VALIDATOR_HOST,
        deployOptions
      );
      if (!deployResponse.startsWith('"Success!')) {
        log('Unable to deploy');
        console.log(deployResponse);
      }
    } catch (err) {
      log('Unable to deploy');
      console.log(err);
    }
    log('✓ deploy');
  
    let dataAtNameResponse;
    try {
      dataAtNameResponse = await waitForUnforgeable(JSON.parse(pd).names[0]);
    } catch (err) {
      log('Failed to parse dataAtName response', 'error');
      console.log(err);
    }
    if (typeof dataAtNameResponse === 'string') {
        const data = rchainToolkit.utils.rhoValToJs(
        JSON.parse(dataAtNameResponse).exprs[0].expr
        );
    
        const masterRegistryUri = data.registryUri.replace('rho:id:', '');
        return masterRegistryUri;
    }
    return null;
  };
  
  
  
  const deployBox = async (
    privateKey: string,
    publicKey: string,
    masterRegistryUri: string,
    boxId: string
  ) => {
    const term = deployBoxTerm({
      publicKey: publicKey,
      boxId: boxId,
      masterRegistryUri: masterRegistryUri,
    });
    console.log(
      '  02 deploy box is ' + Buffer.from(term).length / 1000000 + 'mb'
    );
    const timestamp = new Date().getTime();
    const vab = await validAfterBlockNumber(READ_ONLY_HOST);
    const pd = await prepareDeploy(
      READ_ONLY_HOST,
      publicKey,
      timestamp
    );
  
    const deployOptions = await rchainToolkit.utils.getDeployOptions(
      'secp256k1',
      timestamp,
      term,
      privateKey,
      publicKey,
      1,
      1000000,
      vab || -1
    );
  
    try {
      const deployResponse = await rchainToolkit.http.deploy(
        VALIDATOR_HOST,
        deployOptions
      );
      if (!deployResponse.startsWith('"Success!')) {
        console.log(deployResponse);
        throw new Error('00_deployBox 01');
      }
    } catch (err) {
      console.log(err);
      throw new Error('00_deployBox 02');
    }
  
    let dataAtNameResponse;
    try {
      dataAtNameResponse = await waitForUnforgeable(JSON.parse(pd).names[0]);
    } catch (err) {
      console.log(err);
      throw new Error('00_deployBox 05');
    }

    if (typeof dataAtNameResponse === 'string') {
        const data = rchainToolkit.utils.rhoValToJs(
        JSON.parse(dataAtNameResponse).exprs[0].expr
        );
    
        if (data && data.status !== 'completed') {
        console.log(data);
        throw new Error('00_deployBox 06');
        }
    
        return data;
    }

    return null;
  };
  
  const deployContract = async (privateKey: string, masterRegistryUri: string, fungible: boolean, contractId: string, boxId: string, expires: number | undefined) => {
  
    console.log(
      `Will deploy a\x1b[36m`,
      fungible ? 'fungible' : 'non-fungible',
      '\x1b[0mtokens contract'
    );
    const publicKey = rchainToolkit.utils.publicKeyFromPrivateKey(
      privateKey
    );
  
    const timestamp = new Date().getTime();
    const vab = await validAfterBlockNumber(READ_ONLY_HOST);
    const pd = await prepareDeploy(
      READ_ONLY_HOST,
      publicKey,
      timestamp
    );
  
    const term = deployTerm({
      masterRegistryUri: masterRegistryUri,
      boxId: boxId,
      fungible: fungible,
      contractId: contractId,
      fee: null,
      expires: expires,
    });
  
    //  .replace('/*DEFAULT_BAGS_IDS*/', defaultBagsIdsRholang)
    //   .replace('/*DEFAULT_BAGS*/', defaultBagsRholang)
    //   .replace('/*DEFAULT_BAGS_DATA*/', defaultBagsDataRholang);
  
    log('✓ prepare deploy');
  
    const deployOptions = await rchainToolkit.utils.getDeployOptions(
      'secp256k1',
      timestamp,
      term,
      privateKey,
      publicKey,
      1,
      10000000,
      vab || -1
    );
  
    try {
      const deployResponse = await rchainToolkit.http.deploy(
        VALIDATOR_HOST,
        deployOptions
      );
      if (!deployResponse.startsWith('"Success!')) {
        log('Unable to deploy');
        console.log(deployResponse);
      }
    } catch (err) {
      log('Unable to deploy');
      console.log(err);
    }
    log('✓ deploy');
  
    let dataAtNameResponse;
    try {
      dataAtNameResponse = await waitForUnforgeable(JSON.parse(pd).names[0]);
    } catch (err) {
      log('Failed to parse dataAtName response', 'error');
      console.log(err);
    }

    if (typeof dataAtNameResponse === 'string') {
        const data = rchainToolkit.utils.rhoValToJs(
        JSON.parse(dataAtNameResponse).exprs[0].expr
        );
        if (data && data.status !== 'completed') {
        console.log(data);
        }
        return contractId;
    }
    return null;
  };
  
  
  const createPurse = async (privateKey: string, masterRegistryUri: string, contractId: string, boxId: string, type: string, newId: string, quantity: number, price: number) => {
    log(
      'Make sure the private key provided is the one of the contract'
    );
    log('Make sure the contract is not locked');
    const publicKey = rchainToolkit.utils.publicKeyFromPrivateKey(
      privateKey
    );
  
    const payload = {
      masterRegistryUri: masterRegistryUri,
      contractId: contractId,
      purses: {
        [newId]: {
          id: newId, // will be ignored if fungible = true
          type: type,
          price: price,
          boxId: boxId,
          quantity: quantity,
          //fees: []
        },
      },
      data: {
        [newId]: null,
      },
    };
  
    const timestamp = new Date().getTime();
    const vab = await validAfterBlockNumber(READ_ONLY_HOST);
    const pd = await prepareDeploy(
      READ_ONLY_HOST,
      publicKey,
      timestamp
    );
  
    const term = createPursesTerm(payload);
  
    //timestamp = new Date().getTime();
    //vab = await validAfterBlockNumber(READ_ONLY_HOST);
    const deployOptions = await rchainToolkit.utils.getDeployOptions(
      'secp256k1',
      timestamp,
      term,
      privateKey,
      publicKey,
      1,
      100000000,
      vab
    );
  
    try {
      const deployResponse = await rchainToolkit.http.deploy(
        VALIDATOR_HOST,
        deployOptions
      );
      if (!deployResponse.startsWith('"Success!')) {
        log('Unable to deploy');
        console.log(deployResponse);
      }
    } catch (err) {
      log('Unable to deploy');
      console.log(err);
    }
    log('✓ deployed');
  
  
    let dataAtNameResponse;
    try {
      dataAtNameResponse = await waitForUnforgeable(JSON.parse(pd).names[0]);
    } catch (err) {
      log('Failed to parse dataAtName response', 'error');
      console.log(err);
    }

    if (typeof dataAtNameResponse === 'string') {
        const data = rchainToolkit.utils.rhoValToJs(
        JSON.parse(dataAtNameResponse).exprs[0].expr
        );
        if (data && data.status !== 'completed') {
        console.log(data);
        }
    }
  };
  
  const checkPursesInBox = async (masterRegistryUri: string, boxId: string, contractId: string, ids: Array<string>) => {
      const term0 = readBoxTerm({ masterRegistryUri: masterRegistryUri, boxId: boxId});
      const result0 = await rchainToolkit.http.exploreDeploy(READ_ONLY_HOST, {
        term: term0,
      });
    
      const allData = rchainToolkit.utils.rhoValToJs(JSON.parse(result0).expr[0]);

      if (
        allData.purses[contractId].filter((bid: string) => !!ids.find((id) => id === bid))
          .length !== ids.length
      ) {
        console.log(JSON.stringify(allData.purses[contractId]));
        throw new Error('checkPursesInBox invalid purses');
      }
      return null;
  }


export class RChainProvider implements Provider<Demo> {
    async value() {
      try {
        console.info("prepareDemo()");
    
        let publisherPrivKey = secp256k1.genKeyPair().getPrivate().toString('hex')
        let attestorPrivKey = secp256k1.genKeyPair().getPrivate().toString('hex');
        let buyerPrivKey = secp256k1.genKeyPair().getPrivate().toString('hex');
        let buyer2PrivKey = secp256k1.genKeyPair().getPrivate().toString('hex');
      
        const publisherPubKey = rchainToolkit.utils.publicKeyFromPrivateKey(publisherPrivKey);
        const attestorPubKey = rchainToolkit.utils.publicKeyFromPrivateKey(attestorPrivKey);
        const buyerPubKey = rchainToolkit.utils.publicKeyFromPrivateKey(buyerPrivKey);
        const buyer2PubKey = rchainToolkit.utils.publicKeyFromPrivateKey(buyer2PrivKey);
      
        const publisherRevAddr = rchainToolkit.utils.revAddressFromPublicKey(publisherPubKey);
        const attestorRevAddr = rchainToolkit.utils.revAddressFromPublicKey(attestorPubKey);
        const buyerRevAddr = rchainToolkit.utils.revAddressFromPublicKey(buyerPubKey);
        const buyer2RevAddr = rchainToolkit.utils.revAddressFromPublicKey(buyer2PubKey);
      
        console.info("publisher: " + publisherRevAddr);
        console.info("attestor: " + attestorRevAddr);
        console.info("buyer: " + buyerRevAddr);
        console.info("buye2r: " + buyer2RevAddr);
        
        const fundingPromise1 = fundWallet(escrowRevAddr, publisherRevAddr, 10000000000);
        const fundingPromise2 =  fundWallet(escrowRevAddr, attestorRevAddr, 10000000000);
        const fundingPromise3 =  fundWallet(escrowRevAddr, buyerRevAddr, 10000000000);
        const fundingPromise4 =  fundWallet(escrowRevAddr, buyer2RevAddr, 10000000000);

        await Promise.all([fundingPromise1, fundingPromise2, fundingPromise3, fundingPromise4]);

        const masterRegistryUri = await deployMaster(publisherPrivKey);
        console.info("masterRegistryUri: " + masterRegistryUri);
      
        
        const boxPromise1 = deployBox(publisherPrivKey, publisherPubKey, masterRegistryUri, "publisher");
        const boxPromise2 = deployBox(attestorPrivKey, attestorPubKey, masterRegistryUri, "attestor");
        const boxPromise3 = deployBox(buyerPrivKey, buyerPubKey, masterRegistryUri, "buyer");
        const boxPromise4 = deployBox(buyer2PrivKey, buyer2PubKey, masterRegistryUri, "buyer2");
        
        await Promise.all([boxPromise1, boxPromise2, boxPromise3, boxPromise4]);
      
        const deployPromise1 = deployContract(publisherPrivKey, masterRegistryUri, false, "store", "publisher", undefined);
        const deployPromise2 = deployContract(publisherPrivKey, masterRegistryUri, false, "public_store", "publisher", undefined);
        
        await Promise.all([deployPromise1, deployPromise2]);
      

        await createPurse(publisherPrivKey, masterRegistryUri, "store", "publisher", "0", "0", 100000000, 1);

        await checkPursesInBox(
          masterRegistryUri,
          'publisher',
          'store',
          ['0']
        );

        while (publisherPrivKey.length < 64) {
          publisherPrivKey = "0" + publisherPrivKey;
        }
        while (attestorPrivKey.length < 64) {
          attestorPrivKey = "0" + attestorPrivKey;
        }
        while (buyerPrivKey.length < 64) {
          buyerPrivKey = "0" + buyerPrivKey;
        }
        while (buyer2PrivKey.length < 64) {
          buyer2PrivKey = "0" + buyer2PrivKey;
        }

        return {
          masterRegistryUri: masterRegistryUri,
          publisherPrivKey: publisherPrivKey,
          attestorPrivKey: attestorPrivKey,
          alicePrivKey: buyerPrivKey,
          bobPrivKey: buyer2PrivKey
        } as Demo;
      } catch (err) {
        console.error(err);
        return {
          masterRegistryUri: "",
          publisherPrivKey: "",
          attestorPrivKey: "",
          alicePrivKey: "",
          bobPrivKey: ""
        } as Demo;
      }
    }
  }