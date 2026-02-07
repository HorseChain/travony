export enum MeshMessageType {
  RIDE_REQUEST = 0x01,
  DRIVER_AVAILABLE = 0x02,
  RIDE_ACCEPT = 0x03,
  RIDE_DECLINE = 0x04,
  CHAT_MESSAGE = 0x05,
  LOCATION_SHARE = 0x06,
  RIDE_START = 0x07,
  RIDE_COMPLETE = 0x08,
  FARE_PROPOSE = 0x09,
  FARE_AGREE = 0x0A,
  RIDE_CANCEL = 0x0B,
  PING = 0x0C,
  PONG = 0x0D,
}

export interface MeshPacket {
  type: MeshMessageType;
  ttl: number;
  id: string;
  senderPeerId: string;
  targetPeerId?: string;
  payload: Uint8Array;
  timestamp: number;
}

export interface RideRequestPayload {
  localId: string;
  riderPeerId: string;
  riderName: string;
  pickupLat: number;
  pickupLng: number;
  pickupAddress: string;
  dropoffLat?: number;
  dropoffLng?: number;
  dropoffAddress?: string;
  vehicleType: string;
  estimatedFare?: number;
  currency: string;
}

export interface DriverAvailablePayload {
  driverPeerId: string;
  driverName: string;
  vehicleType: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleColor: string;
  plateNumber: string;
  currentLat: number;
  currentLng: number;
  rating: number;
}

export interface RideAcceptPayload {
  rideLocalId: string;
  driverPeerId: string;
  driverName: string;
  vehicleInfo: string;
  plateNumber: string;
  estimatedArrivalMin: number;
  agreedFare?: number;
}

export interface ChatMessagePayload {
  rideLocalId: string;
  senderPeerId: string;
  senderRole: "rider" | "driver";
  content: string;
  messageLocalId: string;
}

export interface LocationSharePayload {
  rideLocalId: string;
  senderPeerId: string;
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
}

export interface FareProposePayload {
  rideLocalId: string;
  proposerPeerId: string;
  fare: number;
  currency: string;
}

export interface RideCompletePayload {
  rideLocalId: string;
  completedByPeerId: string;
  finalFare: number;
  distanceKm: number;
  durationMin: number;
  gpsTraceCompressed: string;
}

const MAX_TTL = 7;
const PACKET_HEADER_SIZE = 20;

export function serializePacket(packet: MeshPacket): Uint8Array {
  const payloadBytes = packet.payload;
  const idBytes = new TextEncoder().encode(packet.id.substring(0, 16).padEnd(16));
  const senderBytes = new TextEncoder().encode(packet.senderPeerId.substring(0, 16).padEnd(16));

  const buffer = new Uint8Array(1 + 1 + 16 + 16 + 8 + payloadBytes.length);
  let offset = 0;

  buffer[offset++] = packet.type;
  buffer[offset++] = Math.min(packet.ttl, MAX_TTL);

  buffer.set(idBytes, offset);
  offset += 16;

  buffer.set(senderBytes, offset);
  offset += 16;

  const timestampView = new DataView(new ArrayBuffer(8));
  timestampView.setFloat64(0, packet.timestamp);
  buffer.set(new Uint8Array(timestampView.buffer), offset);
  offset += 8;

  buffer.set(payloadBytes, offset);

  return buffer;
}

export function deserializePacket(data: Uint8Array): MeshPacket | null {
  if (data.length < 42) return null;

  let offset = 0;
  const type = data[offset++] as MeshMessageType;
  const ttl = data[offset++];

  const idBytes = data.slice(offset, offset + 16);
  const id = new TextDecoder().decode(idBytes).trim();
  offset += 16;

  const senderBytes = data.slice(offset, offset + 16);
  const senderPeerId = new TextDecoder().decode(senderBytes).trim();
  offset += 16;

  const timestampView = new DataView(data.buffer, data.byteOffset + offset, 8);
  const timestamp = timestampView.getFloat64(0);
  offset += 8;

  const payload = data.slice(offset);

  return { type, ttl, id, senderPeerId, payload, timestamp };
}

export function encodePayload(data: any): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(data));
}

export function decodePayload<T>(payload: Uint8Array): T {
  return JSON.parse(new TextDecoder().decode(payload));
}

export function createRideRequestPacket(
  senderPeerId: string,
  payload: RideRequestPayload
): MeshPacket {
  return {
    type: MeshMessageType.RIDE_REQUEST,
    ttl: MAX_TTL,
    id: generatePacketId(),
    senderPeerId,
    payload: encodePayload(payload),
    timestamp: Date.now(),
  };
}

export function createDriverAvailablePacket(
  senderPeerId: string,
  payload: DriverAvailablePayload
): MeshPacket {
  return {
    type: MeshMessageType.DRIVER_AVAILABLE,
    ttl: 3,
    id: generatePacketId(),
    senderPeerId,
    payload: encodePayload(payload),
    timestamp: Date.now(),
  };
}

export function createRideAcceptPacket(
  senderPeerId: string,
  targetPeerId: string,
  payload: RideAcceptPayload
): MeshPacket {
  return {
    type: MeshMessageType.RIDE_ACCEPT,
    ttl: MAX_TTL,
    id: generatePacketId(),
    senderPeerId,
    targetPeerId,
    payload: encodePayload(payload),
    timestamp: Date.now(),
  };
}

export function createChatPacket(
  senderPeerId: string,
  targetPeerId: string,
  payload: ChatMessagePayload
): MeshPacket {
  return {
    type: MeshMessageType.CHAT_MESSAGE,
    ttl: MAX_TTL,
    id: generatePacketId(),
    senderPeerId,
    targetPeerId,
    payload: encodePayload(payload),
    timestamp: Date.now(),
  };
}

export function createLocationPacket(
  senderPeerId: string,
  targetPeerId: string,
  payload: LocationSharePayload
): MeshPacket {
  return {
    type: MeshMessageType.LOCATION_SHARE,
    ttl: 2,
    id: generatePacketId(),
    senderPeerId,
    targetPeerId,
    payload: encodePayload(payload),
    timestamp: Date.now(),
  };
}

export function createRideCompletePacket(
  senderPeerId: string,
  targetPeerId: string,
  payload: RideCompletePayload
): MeshPacket {
  return {
    type: MeshMessageType.RIDE_COMPLETE,
    ttl: MAX_TTL,
    id: generatePacketId(),
    senderPeerId,
    targetPeerId,
    payload: encodePayload(payload),
    timestamp: Date.now(),
  };
}

function generatePacketId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 16; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

export const MESH_CONFIG = {
  maxTTL: MAX_TTL,
  bleRange: 30,
  maxHopRange: 210,
  scanIntervalMs: 2000,
  advertiseIntervalMs: 1000,
  messageTimeoutMs: 30000,
  maxPayloadSize: 512,
  deduplicationWindowMs: 60000,
  maxPeers: 8,
};

export interface NativeModuleInterface {
  startMesh(): Promise<void>;
  stopMesh(): Promise<void>;
  isActive(): Promise<boolean>;
  broadcast(packet: Uint8Array): Promise<void>;
  sendTo(peerId: string, packet: Uint8Array): Promise<void>;
  getPeers(): Promise<string[]>;
  onPacketReceived(callback: (data: Uint8Array) => void): void;
  onPeerDiscovered(callback: (peerId: string) => void): void;
  onPeerLost(callback: (peerId: string) => void): void;
}
