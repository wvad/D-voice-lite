import { ConnectionOptions, Networking, NetworkingStatusCode } from ".";
import { BaseGuildVoiceChannel, Client, Intents } from "discord.js";
import { FFmpeg, opus } from "prism-media";
import { createReadStream } from "node:fs";

interface DiscordGatewayAdapter {
  sendPayload(payload: unknown): boolean;
  destroy(): void;
}

const client = new Client({
  intents: Object.values(Intents.FLAGS)
});

const audioStream = createReadStream("test.mp3")
  .pipe(new FFmpeg({ args: ["-analyzeduration", "0", "-loglevel", "0", "-f", "s16le", "-ar", "48000", "-ac", "2"] }))
  .pipe(new opus.Encoder({ rate: 48000, channels: 2, frameSize: 960 }));

const streamAwaiter = new Promise(r => audioStream.once("readable", r));

function fetchVoiceGatewayInfo(vc: BaseGuildVoiceChannel) {
  return new Promise<{ options: ConnectionOptions; adapter: DiscordGatewayAdapter }>((resolve, reject) => {
    let statePackets: any;
    const adapter = vc.guild.voiceAdapterCreator({
      onVoiceServerUpdate(data) {
        if (typeof data.endpoint !== "string") return reject(new Error("Invalid endpoint"));
        if (typeof statePackets?.session_id !== "string") return reject(new Error("Session ID is missing"));
        if (typeof statePackets?.user_id !== "string") return reject(new Error("User ID is missing"));
        resolve({
          options: {
            endpoint: data.endpoint,
            serverId: data.guild_id,
            token: data.token,
            sessionId: statePackets.session_id,
            userId: statePackets.user_id
          },
          adapter
        });
      },
      onVoiceStateUpdate: d => (statePackets = d),
      destroy() {}
    });
    adapter.sendPayload({
      op: 4,
      d: {
        guild_id: vc.guildId,
        channel_id: vc.id,
        self_deaf: false,
        self_mute: false
      }
    });
  });
}

console.time("[DEBUG] client ready");
client.once("ready", async () => {
  console.timeEnd("[DEBUG] client ready");

  // Get a voice channel
  const channel = client.channels.cache.get("854340921445711904");
  if (!channel?.isVoice()) throw new Error("The channel is not a voice channel");

  // Get authentication information for Discord Voice Gateway
  console.debug("[DEBUG] fetching auth info for Voice Gateway");
  console.time("[DEBUG] voice auth info");
  const { options, adapter } = await fetchVoiceGatewayInfo(channel);
  console.timeEnd("[DEBUG] voice auth info");

  // Connect to Discord Voice Gateway and RTP connection
  console.debug("[DEBUG] connecting to Voice Gateway");
  console.time("[DEBUG] voice gateway");
  const networking = new Networking(options);

  // Wait for the RTP connection to be ready
  if (networking.state.code !== NetworkingStatusCode.Ready) {
    await new Promise(r => networking.once(NetworkingStatusCode.Ready, r));
  }
  console.timeEnd("[DEBUG] voice gateway");

  // Wait for the opus stream to be readable
  console.time("[DEBUG] audio stream readable");
  await streamAwaiter;
  console.timeEnd("[DEBUG] audio stream readable");

  // Send an audio stream to Discord
  let missing = 0;
  let next = Date.now();
  let preparedPacket: Buffer | undefined;
  function audioCycleStep() {
    next += 20;
    if (preparedPacket) {
      networking.sendEncryptedPacket(preparedPacket);
      preparedPacket = undefined;
    }
    const packet = audioStream.read();
    if (packet || missing < 5) {
      if (packet) {
        preparedPacket = networking.encryptAudioPacket(packet);
        missing = 0;
      } else {
        missing++;
      }
      setTimeout(audioCycleStep, next - Date.now());
      return;
    }

    console.log("end");
    // Disconnect from the voice channel
    adapter.sendPayload({
      op: 4,
      d: {
        guild_id: options.serverId,
        channel_id: null,
        self_deaf: false,
        self_mute: false
      }
    });
    networking.destroy();
    adapter.destroy();
  }
  setImmediate(audioCycleStep);
});

client.login();
