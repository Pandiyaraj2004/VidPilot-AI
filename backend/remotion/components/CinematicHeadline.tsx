import React from "react";
import {interpolate, useCurrentFrame, useVideoConfig} from "remotion";
import {fitSubtitleLayout} from "../layout/subtitleLayout";

/** A single short-lived editorial headline, leaving footage and narration room. */
export const CinematicHeadline: React.FC<{text:string;accent:string;fontFamily:string;hook:boolean}> = ({text,accent,fontFamily,hook}) => {
 const frame=useCurrentFrame();const {fps,width,height}=useVideoConfig();
 const opacity=interpolate(frame,[0,Math.round(fps*.2),Math.round(fps*2.5),Math.round(fps*3)],[0,1,1,0],{extrapolateLeft:"clamp",extrapolateRight:"clamp"});
 const rise=interpolate(frame,[0,Math.round(fps*.35)],[24,0],{extrapolateRight:"clamp"});
 if(!text)return null;
 const layout=fitSubtitleLayout(text,width*.72,height*.24,fontFamily,width*(hook?.075:.06));
 return <div style={{position:"absolute",left:width*.1,right:width*.18,top:height*.16,opacity,transform:`translateY(${rise}px)`,fontFamily,pointerEvents:"none"}}>
  <div style={{width:width*.065,height:5,background:accent,marginBottom:20}}/>
  <div style={{fontSize:layout.fontSizePx,lineHeight:1.12,fontWeight:850,color:"white",letterSpacing:-1.5,textShadow:"0 3px 16px #000, 0 0 50px #000"}}>{layout.lines.map((line,i)=><div key={i}>{line}</div>)}</div>
 </div>;
};
