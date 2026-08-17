/**
 * Voice assistant state machine shared by the rider assistant home.
 * Wraps the platform voice I/O (voiceIO / voiceIO.native) with the
 * idle → recording → processing → speaking loop, plus tap-to-interrupt
 * barge-in: tapping the mic while the assistant speaks stops playback
 * and starts a new recording immediately.
 */
import { useCallback, useRef, useState } from "react";
import { useVoiceIO, type VoiceRecording } from "./voiceIO";

export type VoiceState = "idle" | "recording" | "processing" | "speaking";

export function useVoiceAssistant() {
  const io = useVoiceIO();
  const [state, setState] = useState<VoiceState>("idle");
  const [micDenied, setMicDenied] = useState(false);
  const stateRef = useRef<VoiceState>("idle");

  const update = useCallback((next: VoiceState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const startRecording = useCallback(async (): Promise<boolean> => {
    if (stateRef.current === "recording" || stateRef.current === "processing") return false;
    if (stateRef.current === "speaking") io.stopPlayback(); // barge-in
    const ok = await io.requestPermission();
    if (!ok) {
      setMicDenied(true);
      update("idle");
      return false;
    }
    setMicDenied(false);
    try {
      await io.start();
      update("recording");
      return true;
    } catch {
      update("idle");
      return false;
    }
  }, [io, update]);

  /** Stops recording and returns the clip; leaves state at "processing". */
  const stopRecording = useCallback(async (): Promise<VoiceRecording | null> => {
    if (stateRef.current !== "recording") return null;
    update("processing");
    const rec = await io.stop();
    if (!rec) update("idle");
    return rec;
  }, [io, update]);

  const playReply = useCallback(
    async (base64: string, mime: string) => {
      update("speaking");
      await io.play(base64, mime || "audio/mpeg", () => {
        if (stateRef.current === "speaking") update("idle");
      });
    },
    [io, update]
  );

  const stopPlayback = useCallback(() => {
    io.stopPlayback();
    if (stateRef.current === "speaking") update("idle");
  }, [io, update]);

  const finishTurn = useCallback(() => {
    if (stateRef.current === "processing") update("idle");
  }, [update]);

  return {
    supported: io.supported,
    state,
    micDenied,
    startRecording,
    stopRecording,
    playReply,
    stopPlayback,
    finishTurn,
  };
}
