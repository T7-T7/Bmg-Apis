declare module "@/services/photoroom.mjs" {
  type PhotoRoomImageResult = {
    status: true;
    toolId: string;
    imageId: string | null;
    imageUrl: string;
    buffer: Buffer;
    size: number;
    contentType: string;
  };
  export function aiScenes(input: string | Buffer, prompt: string, options?: { timeoutMs?: number }): Promise<PhotoRoomImageResult>;
  export function text2image(prompt: string, options?: { seed?: number; timeoutMs?: number }): Promise<PhotoRoomImageResult>;
  export function aiBackground(input: string | Buffer, prompt: string, options?: { mask?: Buffer; seed?: number; timeoutMs?: number }): Promise<PhotoRoomImageResult>;
  export function aiShadows(input: string | Buffer, options?: { timeoutMs?: number }): Promise<PhotoRoomImageResult>;
}
