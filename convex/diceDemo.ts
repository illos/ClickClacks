// SPDX-License-Identifier: MIT
/** App-facing transport only. All persisted state and behavior lives in the isolated component. */
import {v,type Infer} from "convex/values";
import {query,mutation,action,internalMutation,internalQuery} from "./_generated/server";
import {components} from "./_generated/api";
import {demoMotion,demoReceipt,demoRoll,demoStyle,demoViewer,demoParticipantStyle} from "../component/diceDemoTables";
import {diceConfiguration,roomPolicy,participant,participantRoll} from "../component/diceDemoV2Tables";

const sampleFacesReturns=v.array(v.number());
export const sampleFaces=action({args:{
    key: v.optional(v.string()),
    viewer: v.optional(v.string()),
    credential: v.optional(v.string()),
    id: v.optional(v.string()),
    dice: v.optional(diceConfiguration),
  },returns:sampleFacesReturns,handler:async(ctx,args):Promise<Infer<typeof sampleFacesReturns>>=>ctx.runAction(components.powerroller.diceDemo.sampleFaces,args)});
const clockReturns=v.number();
export const clock=action({args:{},returns:clockReturns,handler:async(ctx,args):Promise<Infer<typeof clockReturns>>=>Date.now()});
const viewReturns=v.union(
    v.null(),
    v.object({
      viewers: v.array(demoViewer),
      roll: v.union(v.null(), demoRoll),
      receipts: v.array(demoReceipt),
    }),
  );
export const view=query({args:{ key: v.string() },returns:viewReturns,handler:async(ctx,args):Promise<Infer<typeof viewReturns>>=>ctx.runQuery(components.powerroller.diceDemo.view,args)});
const joinReturns=v.null();
export const join=mutation({args:{
    key: v.string(),
    viewer: v.string(),
    name: v.string(),
    ready: v.boolean(),
    uncertainty: v.number(),
  },returns:joinReturns,handler:async(ctx,args):Promise<Infer<typeof joinReturns>>=>ctx.runMutation(components.powerroller.diceDemo.join,args)});
const throwDiceReturns=demoRoll;
export const throwDice=mutation({args:{
    key: v.string(),
    viewer: v.string(),
    id: v.string(),
    faces: v.array(v.number()),
    styles: v.array(demoStyle),
    motion: v.optional(demoMotion),
  },returns:throwDiceReturns,handler:async(ctx,args):Promise<Infer<typeof throwDiceReturns>>=>ctx.runMutation(components.powerroller.diceDemo.throwDice,args)});
const receiptReturns=v.null();
export const receipt=mutation({args:{ key: v.string(), sample: demoReceipt },returns:receiptReturns,handler:async(ctx,args):Promise<Infer<typeof receiptReturns>>=>ctx.runMutation(components.powerroller.diceDemo.receipt,args)});
