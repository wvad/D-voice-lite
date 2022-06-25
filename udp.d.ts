import EventEmitter from "node:events";

export default class VoiceUDPSocket extends EventEmitter {
  public constructor(remoteIp: string, remotePort: number);
  public ping: number;
  public readonly remoteIp: string;
  public readonly remotePort: number;
  public send(buffer: Uint8Array | string | ReadonlyArray<any>): void;
  public destroy(): void;
  private performIPDiscovery(ssrc: number): Promise<{
    readonly ip: string;
    readonly port: number;
  }>;
}
