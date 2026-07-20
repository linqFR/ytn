
export const FN_fCount = "fCount=s=>{let i=s.length,c=0;while(i--){if((s.charCodeAt(i)&0xFC00)!==0xDC00)c++}return c}";
export const FN_dEq = 'dEq=(a,b)=>{const s=[[a, b]];while(s.length){const [c,d]=s.pop();let i;if(c===d)continue;if(c&&d&&"object"===typeof c&&"object"===typeof d){if(c.constructor!==d.constructor)return !1;if(Array.isArray(c)){if(c.length!==d.length)return !1;i=c.length;for(;i--;)s.push([c[i], d[i]]);}else{const k=Object.keys(c);if(k.length!==Object.keys(d).length)return !1;i=k.length;for(;i--;){const f=k[i];if(!Object.hasOwn(d,f))return !1;s.push([c[f],d[f]]);}}}else if(c!==d)return !1;}return !0;};';


export const FN_cidrV6 = "cV6=s=>{const p=s.split('/');if(p.length!==2)return !1;const n=+p[1];if(''+n!==p[1]||n<0||n>128)return !1;try{new URL('http://['+p[0]+']');return !0}catch(e){return !1}}";
