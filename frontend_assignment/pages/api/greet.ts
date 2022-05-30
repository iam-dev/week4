import Greeter from "artifacts/contracts/Greeters.sol/Greeters.json";
import { Contract, providers, utils, Wallet } from "ethers";
import type { NextApiRequest, NextApiResponse } from "next";

// This API can represent a backend.
// The contract owner is the only account that can call the `greet` function,
// However they will not be aware of the identity of the users generating the proofs.

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { greeting, nullifierHash, solidityProof } = JSON.parse(req.body);

  const provider = new providers.JsonRpcProvider(process.env.HARMONY_URL);

  const wallet = new Wallet(process.env.PRIVATE_KEY, provider);
  console.log("wallet", wallet.address);
  const contract = new Contract(
    "0xf4AE7E15B1012edceD8103510eeB560a9343AFd3", //"0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
    Greeter.abi,
    wallet
  );

  //@dev: connection check only call view function
  const trx = await contract.greeters();
  console.log("trx", trx);

  try {
    const tx = await contract.greet(
      utils.formatBytes32String(greeting),
      nullifierHash,
      solidityProof
    );
    const receipt = await tx.wait();
    // console.log(receipt);
    if (receipt.events.length > 0) {
      const resultGreeting = receipt.events[0].args.greeting;
      console.log(utils.parseBytes32String(resultGreeting));
      res.status(200).json({
        message: utils.parseBytes32String(resultGreeting),
      });
    } else {
      res.status(200).end();
    }
  } catch (error: any) {
    console.log("error ===>", error);
    const { message } = JSON.parse(error.body).error;
    const reason = message.substring(
      message.indexOf("'") + 1,
      message.lastIndexOf("'")
    );

    res.status(500).send(reason || "Unknown error!");
  }
}
