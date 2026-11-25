export type HealthPayload = {
  success: boolean;
  service: string;
  shortName: "Nox";
  owner: "Bmg, Inc.";
  copyright: "© 2026 Bmg, Inc.";
  status: "online";
  timestamp: string;
  checks: { application: "ok" };
};

export function getHealthPayload(): HealthPayload {
  return {
    success: true,
    service: "NEXUS OF XPERIENCE",
    shortName: "Nox",
    owner: "Bmg, Inc.",
    copyright: "© 2026 Bmg, Inc.",
    status: "online",
    timestamp: new Date().toISOString(),
    checks: { application: "ok" },
  };
}
