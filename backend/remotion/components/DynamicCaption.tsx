import {useCurrentFrame,useVideoConfig,interpolate} from "remotion";
import {getHorizontalSafeWidth,getSubtitleSafeBottom} from "../layout/safeZones";
import {fitSubtitleLayout} from "../layout/subtitleLayout";

export interface SubtitleCueProp {index:number;text:string;startSeconds:number;endSeconds:number}
interface DynamicCaptionProps {
 subtitles:SubtitleCueProp[];highlightWords:string[]|null;captionStyle:string|null;
 accentColor:string;fontFamily:string;isHookScene:boolean;emotion:string|null;
 energy:number|null;sceneRole?:string|null;
}
/** Quiet phrase captions: no emoji stickers, bouncing words or guessed karaoke. */
export function DynamicCaption({subtitles,fontFamily}:DynamicCaptionProps){
 const frame=useCurrentFrame();const {fps,width,height}=useVideoConfig();
 const cue=subtitles.find(c=>frame/fps>=c.startSeconds&&frame/fps<c.endSeconds);
 if(!cue)return null;
 const safeWidth=getHorizontalSafeWidth(width)*.9;
 const layout=fitSubtitleLayout(cue.text,safeWidth-32,height*.15,fontFamily,width*.045);
 const opacity=interpolate(frame,[cue.startSeconds*fps,cue.startSeconds*fps+4],[0,1],{extrapolateLeft:"clamp",extrapolateRight:"clamp"});
 return <div style={{position:"absolute",left:"46%",top:getSubtitleSafeBottom(height)-layout.boxHeightPx-24,transform:"translateX(-50%)",width:layout.boxWidthPx,maxWidth:safeWidth,padding:"12px 16px",borderRadius:8,background:"rgba(8,12,18,.38)",color:"white",fontFamily,fontSize:layout.fontSizePx,lineHeight:1.35,fontWeight:600,textAlign:"center",textShadow:"0 2px 8px #000",opacity,pointerEvents:"none"}}>{layout.lines.map((line,i)=><div key={i}>{line}</div>)}</div>;
}
