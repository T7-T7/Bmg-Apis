import type {Metadata} from "next";
import Playground from "@/components/api/playground";
export const metadata:Metadata={title:"Playground"};
export default function PlaygroundPage(){return <Playground/>}