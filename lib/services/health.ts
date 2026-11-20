export type HealthPayload={success:boolean;service:string;status:"online";timestamp:string;checks:{application:"ok"}};

export function getHealthPayload():HealthPayload{
  return {
    success:true,
    service:"NOX APIS — NEXUS OF XPERIENCE",
    status:"online",
    timestamp:new Date().toISOString(),
    checks:{application:"ok"}
  };
}
