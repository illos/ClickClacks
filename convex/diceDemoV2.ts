// SPDX-License-Identifier: MIT
/** App-facing transport only. All persisted state and behavior lives in the isolated component. */
import {v,type Infer} from "convex/values";
import {query,mutation,action,internalMutation,internalQuery} from "./_generated/server";
import {components} from "./_generated/api";
import {demoMotion,demoReceipt,demoRoll,demoViewer,demoParticipantStyle} from "../component/diceDemoTables";
import {diceConfiguration,roomPolicy,participant,participantRoll} from "../component/diceDemoV2Tables";
const demoStyle = demoParticipantStyle;
const randomNameReturns=v.string();
export const randomName=mutation({args:{},returns:randomNameReturns,handler:async(ctx,args):Promise<Infer<typeof randomNameReturns>>=>ctx.runMutation(components.powerroller.diceDemoV2.randomName,args)});
const viewReturns=v.object({
    expired: v.boolean(),
    participants: v.array(participant),
    code: v.union(v.string(), v.null()),
    cursor: v.optional(v.number()),
  });
export const view=query({args:{ key: v.string() },returns:viewReturns,handler:async(ctx,args):Promise<Infer<typeof viewReturns>>=>ctx.runQuery(components.powerroller.diceDemoV2.view,args)});
const trackReturns=v.union(
    v.null(),
    v.object({ roll: participantRoll, receipts: v.array(demoReceipt) }),
  );
export const track=query({args:{ key: v.string(), viewer: v.string() },returns:trackReturns,handler:async(ctx,args):Promise<Infer<typeof trackReturns>>=>ctx.runQuery(components.powerroller.diceDemoV2.track,args)});
const joinReturns=v.null();
export const join=mutation({args:{
    key: v.string(),
    viewer: v.string(),
    credential: v.string(),
    name: v.string(),
    style: demoStyle,
    ready: v.boolean(),
    uncertainty: v.number(),
  },returns:joinReturns,handler:async(ctx,args):Promise<Infer<typeof joinReturns>>=>ctx.runMutation(components.powerroller.diceDemoV2.join,args)});
const customizeReturns=v.null();
export const customize=mutation({args:{
    key: v.string(),
    viewer: v.string(),
    credential: v.string(),
    name: v.string(),
    style: demoStyle,
  },returns:customizeReturns,handler:async(ctx,args):Promise<Infer<typeof customizeReturns>>=>ctx.runMutation(components.powerroller.diceDemoV2.customize,args)});
const sampleReceiptReturns=v.union(v.null(), v.array(v.number()));
export const sampleReceipt=internalQuery({args:{
    key: v.string(),
    viewer: v.string(),
    credential: v.string(),
    id: v.string(),
    dice: v.optional(diceConfiguration),
  },returns:sampleReceiptReturns,handler:async(ctx,args):Promise<Infer<typeof sampleReceiptReturns>>=>ctx.runQuery(components.powerroller.diceDemoV2.sampleReceipt,args)});
const recordSampleReturns=v.array(v.number());
export const recordSample=internalMutation({args:{
    key: v.string(),
    viewer: v.string(),
    credential: v.string(),
    id: v.string(),
    dice: v.optional(diceConfiguration),
    faces: v.array(v.number()),
  },returns:recordSampleReturns,handler:async(ctx,args):Promise<Infer<typeof recordSampleReturns>>=>ctx.runMutation(components.powerroller.diceDemoV2.recordSample,args)});
const throwDiceReturns=participantRoll;
export const throwDice=mutation({args:{
    key: v.string(),
    viewer: v.string(),
    credential: v.string(),
    id: v.string(),
    dice: v.optional(diceConfiguration),
    faces: v.array(v.number()),
    motion: v.optional(demoMotion),
    edges: v.optional(v.number()),
    banes: v.optional(v.number()),
  },returns:throwDiceReturns,handler:async(ctx,args):Promise<Infer<typeof throwDiceReturns>>=>ctx.runMutation(components.powerroller.diceDemoV2.throwDice,args)});
const acceptSuppliedReturns=participantRoll;
export const acceptSupplied=internalMutation({args:{
    key: v.string(),
    viewer: v.string(),
    credential: v.string(),
    id: v.string(),
    dice: v.optional(diceConfiguration),
    faces: v.array(v.number()),
    motion: v.optional(demoMotion),
    edges: v.optional(v.number()),
    banes: v.optional(v.number()),
  },returns:acceptSuppliedReturns,handler:async(ctx,args):Promise<Infer<typeof acceptSuppliedReturns>>=>ctx.runMutation(components.powerroller.diceDemoV2.acceptSupplied,args)});
const receiptReturns=v.null();
export const receipt=mutation({args:{
    key: v.string(),
    credential: v.string(),
    roller: v.string(),
    sample: demoReceipt,
  },returns:receiptReturns,handler:async(ctx,args):Promise<Infer<typeof receiptReturns>>=>ctx.runMutation(components.powerroller.diceDemoV2.receipt,args)});
const clearTrayReturns=v.null();
export const clearTray=mutation({args:{ key: v.string(), viewer: v.string(), credential: v.string() },returns:clearTrayReturns,handler:async(ctx,args):Promise<Infer<typeof clearTrayReturns>>=>ctx.runMutation(components.powerroller.diceDemoV2.clearTray,args)});
const eventsReturns=v.object({
    rolls: v.array(participantRoll),
    cursor: v.number(),
    hasMore: v.boolean(),
  });
export const events=query({args:{
    key: v.string(),
    viewer: v.string(),
    credential: v.string(),
    after: v.number(),
    limit: v.optional(v.number()),
  },returns:eventsReturns,handler:async(ctx,args):Promise<Infer<typeof eventsReturns>>=>ctx.runQuery(components.powerroller.diceDemoV2.events,args)});
const setPolicyReturns=v.null();
export const setPolicy=internalMutation({args:{ key: v.string(), policy: roomPolicy },returns:setPolicyReturns,handler:async(ctx,args):Promise<Infer<typeof setPolicyReturns>>=>ctx.runMutation(components.powerroller.diceDemoV2.setPolicy,args)});
const leaveReturns=v.null();
export const leave=mutation({args:{key:v.string(),viewer:v.string(),credential:v.string()},returns:leaveReturns,handler:async(ctx,args):Promise<Infer<typeof leaveReturns>>=>ctx.runMutation(components.powerroller.diceDemoV2.leave,args)});
