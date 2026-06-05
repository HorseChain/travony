import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";

export type LitePreference = "auto" | "on" | "off";

const STORAGE_KEY = "@travony_lite_mode";

/**
 * How much to slow polling/refresh when Lite mode is active. Heavy live queries
 * (driver telemetry, ride status, chat) fetch this many times less often so the
 * app uses far less mobile data on slow/expensive connections.
 */
const LITE_POLL_MULTIPLIER = 3;

interface LiteModeContextValue {
  /** Effective state: true when the app should run light (manual on, or auto + slow). */
  liteMode: boolean;
  /** The user's stored choice. "auto" follows connection detection. */
  preference: LitePreference;
  setPreference: (p: LitePreference) => void;
  /** Auto-detected: the current connection looks slow or expensive. */
  slowConnection: boolean;
  /** Whether we currently have a usable internet connection. */
  isOnline: boolean;
}

const LiteModeContext = createContext<LiteModeContextValue>({
  liteMode: false,
  preference: "auto",
  setPreference: () => {},
  slowConnection: false,
  isOnline: true,
});

function detectSlow(state: NetInfoState): boolean {
  if (state.type === "cellular") {
    const gen = (state.details as any)?.cellularGeneration;
    if (gen === "2g" || gen === "3g") return true;
  }
  if ((state.details as any)?.isConnectionExpensive === true) return true;
  return false;
}

function detectOnline(state: NetInfoState): boolean {
  // isInternetReachable can be null while NetInfo is still probing — treat
  // unknown as online so we don't flash a false "reconnecting" banner.
  return state.isConnected !== false && state.isInternetReachable !== false;
}

export function LiteModeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<LitePreference>("auto");
  const [slowConnection, setSlowConnection] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const loadedRef = useRef(false);

  // Load the remembered choice once on mount.
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (cancelled) return;
        if (v === "on" || v === "off" || v === "auto") {
          setPreferenceState(v);
        }
      })
      .catch(() => {})
      .finally(() => {
        loadedRef.current = true;
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Watch connectivity for online status + slow-connection auto detection.
  useEffect(() => {
    const apply = (state: NetInfoState) => {
      setIsOnline(detectOnline(state));
      setSlowConnection(detectSlow(state));
    };
    NetInfo.fetch().then(apply).catch(() => {});
    const unsubscribe = NetInfo.addEventListener(apply);
    return () => unsubscribe();
  }, []);

  const setPreference = useCallback((p: LitePreference) => {
    setPreferenceState(p);
    AsyncStorage.setItem(STORAGE_KEY, p).catch(() => {});
  }, []);

  const liteMode = useMemo(() => {
    if (preference === "on") return true;
    if (preference === "off") return false;
    return slowConnection; // auto
  }, [preference, slowConnection]);

  const value = useMemo(
    () => ({ liteMode, preference, setPreference, slowConnection, isOnline }),
    [liteMode, preference, setPreference, slowConnection, isOnline],
  );

  return <LiteModeContext.Provider value={value}>{children}</LiteModeContext.Provider>;
}

export function useLiteMode(): LiteModeContextValue {
  return useContext(LiteModeContext);
}

/**
 * Resolve a polling interval that respects Lite mode. Pass the normal interval
 * (or false to disable); in Lite mode active intervals are stretched out so the
 * app fetches less often and uses less data.
 */
export function litePollMs(base: number | false, liteMode: boolean): number | false {
  if (base === false) return false;
  return liteMode ? Math.round(base * LITE_POLL_MULTIPLIER) : base;
}
