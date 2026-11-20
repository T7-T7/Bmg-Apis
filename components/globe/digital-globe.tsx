"use client";
import {useEffect,useRef} from "react";
type Dot={x:number;y:number;z:number};
export default function DigitalGlobe(){
 const ref=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  const canvas=ref.current;if(!canvas)return;const ctx=canvas.getContext("2d");if(!ctx)return;
  let w=0,h=0,angle=0,frame=0,stopped=false;const points:Dot[]=[];const n=920,golden=Math.PI*(3-Math.sqrt(5));
  for(let i=0;i<n;i++){const y=1-(i/(n-1))*2,r=Math.sqrt(1-y*y),t=golden*i;points.push({x:Math.cos(t)*r,y,z:Math.sin(t)*r})}
  const resize=()=>{const r=canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);w=r.width;h=r.height;canvas.width=Math.round(w*d);canvas.height=Math.round(h*d);ctx.setTransform(d,0,0,d,0,0)};
  const draw=()=>{if(stopped)return;ctx.clearRect(0,0,w,h);angle+=.0027;const radius=Math.min(w,h)*.405,cx=w/2,cy=h/2,c=Math.cos(angle),s=Math.sin(angle);const projected=points.map(p=>({x:p.x*c-p.z*s,y:p.y,z:p.x*s+p.z*c})).sort((a,b)=>a.z-b.z);for(const p of projected){const depth=(p.z+1)/2;ctx.beginPath();ctx.fillStyle="rgba(212,255,0,"+(.12+depth*.82)+")";ctx.arc(cx+p.x*radius,cy+p.y*radius,.65+depth*1.45,0,Math.PI*2);ctx.fill()}ctx.beginPath();ctx.strokeStyle="rgba(212,255,0,.12)";ctx.lineWidth=1;ctx.ellipse(cx,cy,radius*1.23,radius*.34,-.32,0,Math.PI*2);ctx.stroke();frame=requestAnimationFrame(draw)};
  resize();draw();const observer=new ResizeObserver(resize);observer.observe(canvas);const visibility=()=>{if(document.hidden)cancelAnimationFrame(frame);else if(!stopped)draw()};document.addEventListener("visibilitychange",visibility);
  return()=>{stopped=true;cancelAnimationFrame(frame);observer.disconnect();document.removeEventListener("visibilitychange",visibility)};
 },[]);
 return <div className="source-globe"><canvas ref={ref} role="img" aria-label="كرة أرضية رقمية متحركة"/><span className="globe-coordinate">30°02′N · 31°14′E</span><span className="globe-caption">EGYPT / CONNECTED GLOBALLY</span></div>;
}