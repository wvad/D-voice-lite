import EventEmitter from "node:events";

export default class VoiceWebSocket extends EventEmitter {
  public constructor(address: string);
  public ping: number;
  public sendPacket(packet: {
    op: number;
    d: unknown;
  }): void;
  public destroy(): void;
}
