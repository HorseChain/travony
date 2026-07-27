// Twitch integration removed — all live streaming is now Agora in-app only.
export async function verifyTwitchChannel(_channel: string): Promise<null> { return null; }
export async function getLiveChannels(_channels: string[]): Promise<Set<string>> { return new Set(); }
