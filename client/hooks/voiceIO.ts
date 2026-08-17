/**
 * Voice I/O — WEB implementation (Metro picks voiceIO.native.ts on iOS/Android).
 * Recording via MediaRecorder, playback via an HTMLAudioElement. No new deps.
 */
import { useEffect, useRef } from "react";

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

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = String(reader.result || "");
      resolve(dataUrl.substring(dataUrl.indexOf(",") + 1));
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function useVoiceIO(): VoiceIO {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ioRef = useRef<VoiceIO | null>(null);

  if (!ioRef.current) {
    const supported =
      typeof navigator !== "undefined" &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof MediaRecorder !== "undefined";

    ioRef.current = {
      supported,

      async requestPermission() {
        if (!supported) return false;
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          streamRef.current = stream;
          return true;
        } catch {
          return false;
        }
      },

      async start() {
        if (!streamRef.current || !streamRef.current.active) {
          streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
        }
        chunksRef.current = [];
        const preferred = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
        const mimeType = preferred.find((m) => MediaRecorder.isTypeSupported?.(m));
        const mr = new MediaRecorder(streamRef.current, mimeType ? { mimeType } : undefined);
        mr.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
        };
        recorderRef.current = mr;
        mr.start();
      },

      stop() {
        return new Promise<VoiceRecording | null>((resolve) => {
          const mr = recorderRef.current;
          if (!mr || mr.state === "inactive") return resolve(null);
          mr.onstop = async () => {
            try {
              const type = mr.mimeType || "audio/webm";
              const blob = new Blob(chunksRef.current, { type });
              chunksRef.current = [];
              streamRef.current?.getTracks().forEach((t) => t.stop());
              streamRef.current = null;
              if (blob.size < 200) return resolve(null);
              resolve({ base64: await blobToBase64(blob), mime: type });
            } catch {
              resolve(null);
            }
          };
          mr.stop();
          recorderRef.current = null;
        });
      },

      async play(base64: string, mime: string, onDone: () => void) {
        ioRef.current?.stopPlayback();
        const el = new Audio(`data:${mime || "audio/mpeg"};base64,${base64}`);
        audioRef.current = el;
        const done = () => {
          if (audioRef.current === el) audioRef.current = null;
          onDone();
        };
        el.onended = done;
        el.onerror = done;
        try {
          await el.play();
        } catch {
          done();
        }
      },

      stopPlayback() {
        const el = audioRef.current;
        if (el) {
          try {
            el.pause();
            el.src = "";
          } catch {}
          audioRef.current = null;
        }
      },
    };
  }

  // Never leave the mic capturing or audio playing after the screen unmounts.
  useEffect(() => {
    return () => {
      try {
        if (recorderRef.current && recorderRef.current.state !== "inactive") {
          recorderRef.current.stop();
        }
      } catch {}
      recorderRef.current = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      ioRef.current?.stopPlayback();
    };
  }, []);

  return ioRef.current;
}
