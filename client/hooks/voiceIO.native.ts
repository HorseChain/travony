/**
 * Voice I/O — NATIVE implementation (iOS/Android). Recording and playback via
 * expo-audio; base64 transport via the legacy expo-file-system API.
 */
import { useEffect, useRef } from "react";
import {
  AudioModule,
  RecordingPresets,
  createAudioPlayer,
  setAudioModeAsync,
  useAudioRecorder,
  type AudioPlayer,
} from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";

export interface VoiceRecording {
  base64: string;
  mime: string;
}

export interface VoiceIO {
  supported: boolean;
  requestPermission(): Promise<boolean>;
  start(): Promise<void>;
  stop(): Promise<VoiceRecording | null>;
  play(base64: string, mime: string, onDone: () => void): Promise<void>;
  stopPlayback(): void;
}

export function useVoiceIO(): VoiceIO {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const playerRef = useRef<AudioPlayer | null>(null);
  const ioRef = useRef<VoiceIO | null>(null);
  const recorderRef = useRef(recorder);
  recorderRef.current = recorder;

  if (!ioRef.current) {
    const cleanupPlayer = () => {
      const p = playerRef.current;
      if (p) {
        try {
          p.pause();
          p.remove();
        } catch {}
        playerRef.current = null;
      }
    };

    ioRef.current = {
      supported: true,

      async requestPermission() {
        try {
          const res = await AudioModule.requestRecordingPermissionsAsync();
          return !!res.granted;
        } catch {
          return false;
        }
      },

      async start() {
        cleanupPlayer();
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await recorderRef.current.prepareToRecordAsync();
        recorderRef.current.record();
      },

      async stop() {
        try {
          await recorderRef.current.stop();
        } catch {
          return null;
        }
        // Recording done — route audio back to the speaker for playback.
        try {
          await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
        } catch {}
        const uri = recorderRef.current.uri;
        if (!uri) return null;
        try {
          const base64 = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          if (!base64 || base64.length < 300) return null;
          return { base64, mime: "audio/mp4" };
        } catch {
          return null;
        }
      },

      async play(base64: string, _mime: string, onDone: () => void) {
        cleanupPlayer();
        try {
          const path = `${FileSystem.cacheDirectory}voice-reply-${Date.now()}.mp3`;
          await FileSystem.writeAsStringAsync(path, base64, {
            encoding: FileSystem.EncodingType.Base64,
          });
          const player = createAudioPlayer({ uri: path });
          playerRef.current = player;
          let finished = false;
          const done = () => {
            if (finished) return;
            finished = true;
            if (playerRef.current === player) cleanupPlayer();
            FileSystem.deleteAsync(path, { idempotent: true }).catch(() => {});
            onDone();
          };
          player.addListener("playbackStatusUpdate", (status: any) => {
            if (status?.didJustFinish) done();
          });
          player.play();
        } catch {
          onDone();
        }
      },

      stopPlayback() {
        cleanupPlayer();
      },
    };
  }

  // Never leave the mic capturing or audio playing after the screen unmounts.
  useEffect(() => {
    return () => {
      try {
        if (recorderRef.current?.isRecording) {
          recorderRef.current.stop().catch(() => {});
        }
      } catch {}
      ioRef.current?.stopPlayback();
      setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
    };
  }, []);

  return ioRef.current;
}
