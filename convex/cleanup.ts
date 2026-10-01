// SPDX-License-Identifier: MIT
/** App-facing transport only. All persisted state and behavior lives in the isolated component. */
import {v,type Infer} from "convex/values";
import {query,mutation,action,internalMutation,internalQuery} from "./_generated/server";
import {components} from "./_generated/api";
import {demoMotion,demoReceipt,demoRoll,demoViewer,demoParticipantStyle} from "../component/diceDemoTables";
import {diceConfiguration,roomPolicy,participant,participantRoll} from "../component/diceDemoV2Tables";

const expiredReturns=v.number();
export const expired=internalMutation({args:{},returns:expiredReturns,handler:async(ctx,args):Promise<Infer<typeof expiredReturns>>=>ctx.runMutation(components.powerroller.cleanup.expired,args)});
