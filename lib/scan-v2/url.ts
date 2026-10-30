import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
export function publicAddress(value:string) {
  const address=value.toLowerCase().replace(/^::ffff:/,"");
  if(isIP(address)===6)return address.startsWith("2") || address.startsWith("3");
  if(isIP(address)!==4)return false;
  const [a,b]=address.split('.').map(Number);
  return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&(b===168||b===0)||a===100&&b>=64&&b<=127||a===198&&(b===18||b===19));
}
export async function publicScanUrl(value:unknown) {
  if(typeof value!=="string"||value.length>2000)throw new Error("A public website URL is required.");
  const url=new URL(/^https?:\/\//i.test(value)?value:`https://${value}`);
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.port && !['80','443'].includes(url.port))throw new Error("Unsupported website URL.");
  const addresses=await lookup(url.hostname.replace(/^\[|\]$/g,''),{all:true});
  if(!addresses.length||addresses.some(item=>!publicAddress(item.address)))throw new Error("Private or non-public targets are not allowed.");
  url.hash='';return url.toString();
}
