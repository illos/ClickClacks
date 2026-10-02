// SPDX-License-Identifier: MIT
export type RollerErrorCode = 'REQUEST_CONFLICT'|'CONFLICT'|'REQUEST_EXPIRED'|'EXPIRED'|'CURSOR_EXPIRED'|'ROOM_EXPIRED'|'UNAUTHORIZED'|'INVALID'|'INVALID_REQUEST'|'BACKEND_ERROR';
const knownCodes:readonly string[]=['REQUEST_CONFLICT','CONFLICT','REQUEST_EXPIRED','EXPIRED','CURSOR_EXPIRED','ROOM_EXPIRED','UNAUTHORIZED','INVALID','INVALID_REQUEST'];
/** Serializable public diagnostics; codes preserve explicit source codes rather than classifying prose. */
export class RollerError extends Error {
 readonly code:RollerErrorCode;
 constructor(code:RollerErrorCode,message:string){super(message);this.code=code;this.name='RollerError';}
 toJSON(){return{code:this.code,message:this.message};}
}
function sourceCode(value:unknown,message:string):RollerErrorCode{
 if(value instanceof RollerError)return value.code;
 const data=value&&typeof value==='object'&&'data' in value?value.data:undefined;
 if(data&&typeof data==='object'&&'code' in data&&knownCodes.includes(String(data.code)))return data.code as RollerErrorCode;
 for(const text of [typeof data==='string'?data:'',message]){
  const match=/(?:^|\bError:\s*)(REQUEST_CONFLICT|CONFLICT|REQUEST_EXPIRED|CURSOR_EXPIRED|ROOM_EXPIRED|UNAUTHORIZED|INVALID_REQUEST|EXPIRED|INVALID)(?=[:\s]|$)/.exec(text);
  if(match)return match[1] as RollerErrorCode;
 }
 return 'BACKEND_ERROR';
}
/** SDK validation messages can include request arguments. Never forward a raw private credential. */
export function redactError(value:unknown,secrets:readonly string[]):RollerError {
 const replace=(text:string)=>{
  for(const secret of secrets){if(!secret)continue;for(const encoded of new Set([secret,JSON.stringify(secret).slice(1,-1),encodeURIComponent(secret)]))text=text.replaceAll(encoded,'[private credential]');}
  return text;
 };
 const data=value&&typeof value==='object'&&'data' in value?value.data:undefined;
 const message=data&&typeof data==='object'&&'message' in data&&typeof data.message==='string'?data.message:value instanceof Error?value.message:String(value);
 return new RollerError(sourceCode(value,message),replace(message));
}

/** Display diagnostics safely even when the caller does not know the credential. */
export function displayError(error: unknown, credential?: string): string {
 const message = redactError(error, credential ? [credential] : []).message;
 return message.replace(/("?credential"?\s*:\s*")[^"]*(")/gi, '$1[private credential]$2');
}
