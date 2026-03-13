import { processContract } from "./cliContractParser.js";
import { CliContractSchema } from "./cliContractSchema.js";
import { xorGate } from "./xorGate.js";


export const cliToOject = (contract:CliContractSchema)=>{
    processContract
    .transforme((params)=>{
        const new xorGate()
    })
    .safeParse(contract)
}