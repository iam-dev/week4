import detectEthereumProvider from "@metamask/detect-provider"
import { Strategy, ZkIdentity } from "@zk-kit/identity"
import { generateMerkleProof, Semaphore } from "@zk-kit/protocols"
import { providers, Contract, utils } from "ethers"
import Head from "next/head"
import React, { useState, useEffect } from "react"
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as Yup from 'yup';
import { Button } from "@mui/material";
import styles from "../styles/Home.module.css"
import TextBox from "./component/TextBox"; 
import Greeter from "artifacts/contracts/Greeters.sol/Greeters.json";

type UserInput = {
    name: string
    age: number
    address: string
    greet: string
}

export default function Home() {
    const [logs, setLogs] = React.useState("Connect your wallet and greet!")
    const [greeting, setGreeting] = useState<string>()
    const [greetingEvents, setGreetingEvents] = useState<string[]>([])

    useEffect(() => {
        const newGreeting = async () => {
          const provider = (await detectEthereumProvider()) as any;
          const ethersProvider = new providers.Web3Provider(provider);
    
          const contract = new Contract(
            "0xf4AE7E15B1012edceD8103510eeB560a9343AFd3",
            Greeter.abi,
            ethersProvider
          );
    
          contract.on("NewGreeting", (greeting: string) => {
            setGreetingEvents(prevState => [...prevState, utils.parseBytes32String(greeting)]);
          });
        };
    
        newGreeting().catch(console.error);
    }, []);
    

    // form validation rules 
    const validationSchema = Yup.object().shape({
        name: Yup.string()
            .required('Name is required'),
        age: Yup.number()
            .required('Age is required')
            .positive('Age must be a positive number'),
        address: Yup.string()
            .required('Address is required'),    
        greet: Yup.string()
            .required('Greeting is required')  
            .max(32, 'Greeting must be less than 32 characters')
    });

    const formOptions = { 
        resolver: yupResolver(validationSchema),
        defaultValues: {
            name: "Tester",
            age: 18,
            address: "Blockstreet 20",
            greet: "Hello World!",
        }
    };
    // get functions to build form with useForm() hook
    const { register, handleSubmit, reset, formState } = useForm<UserInput>(formOptions)
    const { errors } = formState;


    const onSubmitHandler = (userInput: UserInput) => {
        console.log(userInput)
        greet(userInput.greet)
        reset()
    }


    async function greet(greet: string) {
        setLogs("Creating your Semaphore identity...")

        const provider = (await detectEthereumProvider()) as any

        await provider.request({ method: "eth_requestAccounts" })

        const ethersProvider = new providers.Web3Provider(provider)
        const signer = ethersProvider.getSigner()
        const message = await signer.signMessage("Sign this message to create your identity!")

        const identity = new ZkIdentity(Strategy.MESSAGE, message)
        const identityCommitment = identity.genIdentityCommitment()
        const identityCommitments = await (await fetch("./identityCommitments.json")).json()

        const merkleProof = generateMerkleProof(20, BigInt(0), identityCommitments, identityCommitment)

        setLogs("Creating your Semaphore proof...")

        const greeting = greet

        const witness = Semaphore.genWitness(
            identity.getTrapdoor(),
            identity.getNullifier(),
            merkleProof,
            merkleProof.root,
            greeting
        )

        const { proof, publicSignals } = await Semaphore.genProof(witness, "./semaphore.wasm", "./semaphore_final.zkey")
        const solidityProof = Semaphore.packToSolidityProof(proof)

        const response = await fetch("/api/greet", {
            method: "POST",
            body: JSON.stringify({
                greeting,
                nullifierHash: publicSignals.nullifierHash,
                solidityProof: solidityProof
            })
        })

        if (response.status === 500) {
            const errorMessage = await response.text()

            setLogs(errorMessage)
        } else {
            const data = await response.json()
            console.log(data)
            setGreeting(data.message)
            setLogs("Your anonymous greeting is onchain :)")
        }
    }

    return (
        <div className={styles.container}>
            <Head>
                <title>Greetings</title>
                <meta name="description" content="A simple Next.js/Hardhat privacy application with Semaphore." />
                <link rel="icon" href="/favicon.ico" />
            </Head>

            <main className={styles.main}>
                <h1 className={styles.title}>Greetings</h1>

                <p className={styles.description}>A simple Next.js/Hardhat privacy application with Semaphore.</p>

                <div className={styles.logs}>{logs}</div>

                <form onSubmit={handleSubmit(onSubmitHandler)}>
                    <div className="form-group">
                        <input  type="text"
                                placeholder="Name"
                                id="inputName"
                                {...register("name")} 
                                className={`form-control ${errors.name ? 'is-invalid' : ''}`}
                        />
                        <div className={styles.invalid}>{errors.name?.message}</div>
                    </div>
                    <input  type="number"
                            placeholder="Age"
                            id="inputAge"
                            {...register("age")}
                            className={`form-control ${errors.age ? 'is-invalid' : ''}`}
                    />
                    <input  type="text"
                            placeholder="Address"
                            id="inputAddress"
                            {...register("address")} 
                            className={`form-control ${errors.address ? 'is-invalid' : ''}`}
                    />
                    <input  type="text"
                            placeholder="Your Greet"
                            id="inputGreet"
                            {...register("greet")}
                            color="primary"
                            className={`form-control ${errors.greet ? 'is-invalid' : ''}`}
                    />
                    <div className={styles.invalid}>{errors.name?.message}</div>
                    <div className={styles.invalid}>{errors.address?.message}</div>
                    <div className={styles.invalid}>{errors.age?.message}</div>
                    <div className={styles.invalid}>{errors.greet?.message}</div>
                    <div className="form-group">
                        <Button variant="contained" className={styles.button} type="submit" >Sign Identity</Button>
                        <Button variant="contained" className={styles.button} type="button" onClick={() => reset()} >Reset Form</Button>
                    </div>
                </form>
                <div style={{ marginTop: "5em" }}>
                    <div className={styles.logs}>Your Onchain data:</div>
                    <TextBox value={greeting} />
                </div>
                <div style={{ marginTop: "5em" }}>
                    <div className={styles.logs}>Others Onchain data:</div>
                    {/* {greetingEvents.map((greetingEvents) => {
                        return <TextBox value={greetingEvents} />
                    })} */}
                    <TextBox value={greetingEvents} />
                </div>
            </main>
        </div>
    )
}
