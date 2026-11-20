import type {Metadata,Viewport} from "next";
import type {ReactNode} from "react";
import "./globals.css";
import AppShell from "@/components/layout/app-shell";
export const metadata:Metadata={metadataBase:new URL("https://bmg-apis-b2-902b.vercel.app"),title:{default:"Bmg-Apis — Nexus Of Xperience",template:"%s | Bmg-Apis"},description:"منصة مصرية للمطورين — واجهات برمجية موثقة وخدمات عملية للذكاء الاصطناعي والبيانات.",applicationName:"Bmg-Apis",keywords:["Bmg-Apis","Egyptian API Platform","REST API","Gemini","Currency API"],icons:{icon:"/bmg-apis-mark.svg"},openGraph:{title:"Bmg-Apis — Nexus Of Xperience",description:"منصة مصرية للمطورين، من مصر إلى العالم.",locale:"ar_EG",type:"website"}};
export const viewport:Viewport={width:"device-width",initialScale:1,themeColor:"#000000",colorScheme:"dark"};
export default function RootLayout({children}:Readonly<{children:ReactNode}>){return <html lang="ar" dir="rtl" data-theme="dark"><body><AppShell>{children}</AppShell></body></html>}