// Optional remote access without a website login screen. Treat the resulting
// bookmark as a password. It expires after 12 hours and contains no provider keys.
import dotenv from 'dotenv';import {createHmac} from 'node:crypto';
dotenv.config({quiet:true});
if((process.env.SESSION_SECRET?.length??0)<32)throw new Error('Configure SESSION_SECRET before creating a private link');
const url=new URL(process.argv[2]??process.env.FRONTEND_URL??'http://localhost:5173');
if(url.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(url.hostname))throw new Error('Remote workspace links require HTTPS');
const expiry=String(Date.now()+12*3600000),signature=createHmac('sha256',process.env.SESSION_SECRET).update(expiry).digest('hex');
url.hash=new URLSearchParams({access:`${expiry}.${signature}`}).toString();console.log(url.toString());
