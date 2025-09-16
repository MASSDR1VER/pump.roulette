/**
 * LiveKit Audio Helper Functions
 *
 * Utilities for managing LiveKit audio connections and tracks
 */

import {
  Room,
  RoomEvent,
  Track,
  RemoteTrack,
  createLocalAudioTrack,
  LocalAudioTrack,
  RoomOptions
} from 'livekit-client'

export interface AudioRoomConfig {
  endpoint: string
  token: string
  roomId: string
}

export interface AudioTrackOptions {
  echoCancellation?: boolean
  noiseSuppression?: boolean
  autoGainControl?: boolean
  channelCount?: number
}

/**
 * Create a LiveKit room instance
 * @returns Room instance
 */
export function createRoom(): Room {
  const room = new Room({
    adaptiveStream: true,
    dynacast: true,
    videoCaptureDefaults: {
      resolution: { width: 0, height: 0 } // Audio only
    }
  } as RoomOptions)

  return room
}

/**
 * Connect to a LiveKit room
 * @param room - Room instance
 * @param endpoint - LiveKit server endpoint
 * @param token - Access token
 * @returns Promise that resolves when connected
 */
export async function connectToRoom(
  room: Room,
  endpoint: string,
  token: string
): Promise<void> {
  await room.connect(endpoint, token)
}

/**
 * Create and configure a local audio track
 * @param options - Audio track configuration
 * @returns LocalAudioTrack instance
 */
export async function createAudioTrack(
  options: AudioTrackOptions = {}
): Promise<LocalAudioTrack> {
  const track = await createLocalAudioTrack({
    echoCancellation: options.echoCancellation ?? true,
    noiseSuppression: options.noiseSuppression ?? true,
    autoGainControl: options.autoGainControl ?? true,
    channelCount: options.channelCount ?? 1
  })

  return track
}

/**
 * Publish an audio track to the room
 * @param room - Room instance
 * @param track - Audio track to publish
 */
export async function publishAudioTrack(
  room: Room,
  track: LocalAudioTrack
): Promise<void> {
  await room.localParticipant.publishTrack(track)
}

/**
 * Set up listeners for remote audio tracks
 * @param room - Room instance
 * @param onTrackSubscribed - Callback when a track is subscribed
 * @param onTrackUnsubscribed - Callback when a track is unsubscribed
 */
export function setupAudioListeners(
  room: Room,
  onTrackSubscribed?: (track: RemoteTrack) => void,
  onTrackUnsubscribed?: (track: RemoteTrack) => void
): void {
  room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
    if (track instanceof RemoteTrack && track.kind === Track.Kind.Audio) {
      // Attach audio element
      const audioElement = track.attach()
      audioElement.autoplay = true
      audioElement.playsInline = true
      audioElement.hidden = true
      document.body.appendChild(audioElement)

      if (onTrackSubscribed) {
        onTrackSubscribed(track)
      }
    }
  })

  room.on(RoomEvent.TrackUnsubscribed, (track) => {
    if (track instanceof RemoteTrack && track.kind === Track.Kind.Audio) {
      track.detach()

      if (onTrackUnsubscribed) {
        onTrackUnsubscribed(track)
      }
    }
  })
}

/**
 * Disconnect from room and clean up
 * @param room - Room instance
 * @param localTrack - Local audio track to stop
 */
export async function disconnectFromRoom(
  room: Room,
  localTrack?: LocalAudioTrack
): Promise<void> {
  if (localTrack) {
    localTrack.stop()
    room.localParticipant.unpublishTrack(localTrack)
  }

  await room.disconnect()
  room.removeAllListeners()

  // Clean up audio elements
  const audioElements = document.querySelectorAll('audio[data-lk-audio]')
  audioElements.forEach(el => el.remove())
}

/**
 * Mute/unmute local audio track
 * @param track - Local audio track
 * @param muted - Whether to mute or unmute
 */
export function setTrackMuted(track: LocalAudioTrack, muted: boolean): void {
  track.mute = muted
}

/**
 * Get room connection status
 * @param room - Room instance
 * @returns Connection status
 */
export function isRoomConnected(room: Room): boolean {
  return room.state === 'connected'
}

/**
 * Get participant count
 * @param room - Room instance
 * @returns Number of participants
 */
export function getParticipantCount(room: Room): number {
  return room.participants.size + 1 // Include local participant
}

/**
 * Handle connection errors
 * @param room - Room instance
 * @param onError - Error callback
 */
export function handleConnectionErrors(
  room: Room,
  onError: (error: Error) => void
): void {
  room.on(RoomEvent.Disconnected, (reason) => {
    onError(new Error(`Disconnected: ${reason}`))
  })

  room.on(RoomEvent.ConnectionQualityChanged, (quality, participant) => {
    if (quality === 'poor') {
      console.warn(`Poor connection quality for ${participant.identity}`)
    }
  })
}