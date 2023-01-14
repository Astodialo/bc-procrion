import type { NextApiRequest, NextApiResponse } from "next";
import {
  AppWallet,
  ForgeScript,
  Transaction,
  KoiosProvider,
  largestFirst,
  readPlutusData
} from "@meshsdk/core";
import { resolveDataHash } from '@meshsdk/core';
import type { Mint, Data, Asset } from "@meshsdk/core";
import { demoMnemonic } from "../../config/wallet";
import {
  assetsMetadata,
  idArray,
  bankWalletAddress,
  costLovelace,
} from "../../config/mint";


export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const recipientAddress = req.body.recipientAddress;
  const utxos = req.body.utxos;
  const assetName = req.body.assetName
  const mdAnswers = req.body.mdAnswers

  const scriptAddress = 'test'
  const policy = "test"

  const koios = new KoiosProvider('preview')

  const appWallet = new AppWallet({
    networkId: 0,
    fetcher: koios,
    submitter:  koios,
    key: {
      type: "mnemonic",
      words: demoMnemonic,
    },
  });


  const scriptUtxos = await koios.fetchAddressUTxOs(
    scriptAddress,
    policy + assetName
  );
  const utxo = scriptUtxos[0];
  const datumMetadataCBOR = utxo.output.plutusData;
  const datumMetadata = readPlutusData(datumMetadataCBOR);
  
  const [datumMD, datumState] = datumMetadata.fields;
  
  datumMD.set('answers', [mdAnswers]);

  datumState.set('state', 'VOTE');

  const appWalletAddress = appWallet.getPaymentAddress();
  const forgingScript = ForgeScript.withOneSignature(appWalletAddress);

  const burnerAss : Asset = {
    unit: policy + assetName.concat("_A") ,
    quantity: '1',
  };

  const tx = new Transaction({ initiator: appWallet });
  tx.redeemValue({
      value: utxo,
      script: {
        version: 'V1',
        code : '4e4d01000033222220051200120011'
    },
    datum: datumMetadataCBOR,
  });
  tx.sendValue(scriptAddress, utxo);
  tx.burnAsset(forgingScript, burnerAss);
  tx.setChangeAddress(scriptAddress);

 const unsignedTx = await tx.build(); 

 res.status(200).json({unsignedTx});
}
