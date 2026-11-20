export type ApiMethod="GET"|"POST";
export type ApiStatus="live"|"planned";
export type ApiDefinition={slug:string;name:string;category:string;description:string;method:ApiMethod;path:string;status:ApiStatus;body?:Record<string,unknown>;query?:Record<string,string>};
