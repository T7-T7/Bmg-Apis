export const MAX_IMAGE_BYTES: number;
export function isPublicAddress(address: string): boolean;
export function validateRemoteImageUrl(value: string): URL;
export function isTrustedPhotoRoomHost(value: string): boolean;
export function fetchRemoteImage(
  value: string,
  headers?: Record<string, string>
): Promise<{ buffer: Buffer; contentType: string; size: number; url: string }>;
