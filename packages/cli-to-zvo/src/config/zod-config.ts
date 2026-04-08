import {z} from "zod";


// export const TARGET_FALLBACK_NAME = "czvoFallback";


export const setZodConfig = ()=>{

    z.config({
        jitless:false,
        customError:(iss)=>{
            return iss?.message
        }
    })
}
