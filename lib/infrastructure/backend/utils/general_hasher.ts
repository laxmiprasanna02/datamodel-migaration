export function generateGeneralHash(region:string, stage:string):string {
  const code = stage+region;
  const hashCode = hash(code)
  return hashCode.toString().substring(0,3);
}

function hash(str:string):number {
  var hash = 0, i, chr;
  if (str.length === 0) return hash;
  for (i = 0; i < str.length; i++) {
    chr   = str.charCodeAt(i);
    hash  = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
};