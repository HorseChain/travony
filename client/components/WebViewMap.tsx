import React, { useRef, useEffect, useCallback, useState } from "react";
import { View, StyleSheet, Platform, ActivityIndicator } from "react-native";
import { WebView } from "react-native-webview";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing } from "@/constants/theme";
import type { DimensionValue } from "react-native";

interface MapLocation {
  lat: number;
  lng: number;
  heading?: number;
}

interface WebViewMapProps {
  pickupLocation?: MapLocation | null;
  dropoffLocation?: MapLocation | null;
  driverLocation?: MapLocation | null;
  currentLocation?: MapLocation | null;
  routeCoordinates?: Array<{ latitude: number; longitude: number }>;
  showDriverMarker?: boolean;
  interactive?: boolean;
  onMapReady?: () => void;
  height?: DimensionValue;
  isDark?: boolean;
  eta?: number;
  distance?: number;
  rideStatus?: string;
}

const TRAVONY_GREEN = Colors.travonyGreen;

function generateMapHTML(isDark: boolean): string {
  const tileUrl = isDark
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body,#map{width:100%;height:100%;overflow:hidden}
.leaflet-control-attribution{display:none!important}
.leaflet-control-zoom{display:none!important}
.pickup-marker{width:24px;height:24px;border-radius:50%;background:#fff;border:3px solid ${TRAVONY_GREEN};display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.3)}
.pickup-dot{width:10px;height:10px;border-radius:50%;background:${TRAVONY_GREEN}}
.pickup-pulse{position:absolute;width:24px;height:24px;border-radius:50%;background:${TRAVONY_GREEN};opacity:0.4;animation:pulse 2s infinite}
@keyframes pulse{0%{transform:scale(1);opacity:0.4}100%{transform:scale(2.5);opacity:0}}
.dropoff-marker{width:28px;height:28px;border-radius:6px;background:#1a1a1a;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.3)}
.dropoff-inner{width:10px;height:10px;background:#fff}
.dropoff-pin{width:4px;height:10px;background:#1a1a1a;margin:-2px auto 0}
.driver-marker{width:40px;height:40px;border-radius:50%;background:#008B3D;border:3px solid #fff;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.4);position:relative}
.driver-marker svg{fill:#fff;width:20px;height:20px}
.driver-pulse{position:absolute;width:40px;height:40px;border-radius:50%;background:${TRAVONY_GREEN};opacity:0.3;animation:pulse 1.5s infinite}
</style>
</head><body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var map,pickupMarker,dropoffMarker,driverMarker,routeLine;
var mapReady=false;

function init(){
  try{
    map=L.map('map',{zoomControl:false,attributionControl:false}).setView([25.2048,55.2708],14);
    L.tileLayer('${tileUrl}',{maxZoom:19,subdomains:'abcd'}).addTo(map);
    mapReady=true;
    sendMsg({type:'ready'});
  }catch(e){
    sendMsg({type:'error',message:e.message});
  }
}

function sendMsg(d){
  try{window.ReactNativeWebView.postMessage(JSON.stringify(d))}catch(e){}
}

function makePickupIcon(){
  return L.divIcon({
    className:'',
    html:'<div style="position:relative;display:flex;align-items:center;justify-content:center;width:48px;height:48px"><div class="pickup-pulse"></div><div class="pickup-marker"><div class="pickup-dot"></div></div></div>',
    iconSize:[48,48],iconAnchor:[24,24]
  });
}

function makeDropoffIcon(){
  return L.divIcon({
    className:'',
    html:'<div style="display:flex;flex-direction:column;align-items:center"><div class="dropoff-marker"><div class="dropoff-inner"></div></div><div class="dropoff-pin"></div></div>',
    iconSize:[28,42],iconAnchor:[14,42]
  });
}

function makeDriverIcon(heading){
  return L.divIcon({
    className:'',
    html:'<div style="position:relative;display:flex;align-items:center;justify-content:center;width:56px;height:56px"><div class="driver-pulse"></div><div class="driver-marker" style="transform:rotate('+(heading||0)+'deg)"><svg viewBox="0 0 24 24"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg></div></div>',
    iconSize:[56,56],iconAnchor:[28,28]
  });
}

function handleMessage(e){
  try{
    var d=JSON.parse(e.data);
    if(!mapReady)return;

    if(d.type==='setPickup'){
      if(pickupMarker)map.removeLayer(pickupMarker);
      if(d.lat&&d.lng){
        pickupMarker=L.marker([d.lat,d.lng],{icon:makePickupIcon()}).addTo(map);
      }
    }
    else if(d.type==='setDropoff'){
      if(dropoffMarker)map.removeLayer(dropoffMarker);
      if(d.lat&&d.lng){
        dropoffMarker=L.marker([d.lat,d.lng],{icon:makeDropoffIcon()}).addTo(map);
      }
    }
    else if(d.type==='setDriver'){
      if(driverMarker)map.removeLayer(driverMarker);
      if(d.lat&&d.lng){
        driverMarker=L.marker([d.lat,d.lng],{icon:makeDriverIcon(d.heading)}).addTo(map);
      }
    }
    else if(d.type==='setRoute'){
      if(routeLine)map.removeLayer(routeLine);
      if(d.coords&&d.coords.length>1){
        var shadowLine=L.polyline(d.coords,{color:'#e0e0e0',weight:6,opacity:1,lineCap:'round',lineJoin:'round'}).addTo(map);
        routeLine=L.layerGroup([shadowLine,L.polyline(d.coords,{color:'#4285F4',weight:4,opacity:1,lineCap:'round',lineJoin:'round'})]).addTo(map);
      }
    }
    else if(d.type==='fitBounds'){
      if(d.bounds&&d.bounds.length>=2){
        map.fitBounds(d.bounds,{padding:[60,40],maxZoom:16,animate:true});
      }
    }
    else if(d.type==='setCenter'){
      map.setView([d.lat,d.lng],d.zoom||14,{animate:true});
    }
    else if(d.type==='setInteractive'){
      if(d.value){
        map.dragging.enable();map.touchZoom.enable();map.doubleClickZoom.enable();
      }else{
        map.dragging.disable();map.touchZoom.disable();map.doubleClickZoom.disable();
      }
    }
  }catch(err){
    sendMsg({type:'error',message:err.message});
  }
}

document.addEventListener('message',handleMessage);
window.addEventListener('message',handleMessage);

init();
</script>
</body></html>`;
}

export default function WebViewMap({
  pickupLocation,
  dropoffLocation,
  driverLocation,
  currentLocation,
  routeCoordinates,
  showDriverMarker = false,
  interactive = true,
  onMapReady,
  height = "100%",
  isDark = false,
  eta,
  distance,
  rideStatus,
}: WebViewMapProps) {
  const webViewRef = useRef<WebView>(null);
  const [isReady, setIsReady] = useState(false);
  const [hasError, setHasError] = useState(false);
  const { theme } = useTheme();
  const pendingMessages = useRef<string[]>([]);

  const sendToMap = useCallback((msg: any) => {
    const str = JSON.stringify(msg);
    if (isReady && webViewRef.current) {
      webViewRef.current.postMessage(str);
    } else {
      pendingMessages.current.push(str);
    }
  }, [isReady]);

  const flushPending = useCallback(() => {
    if (webViewRef.current && pendingMessages.current.length > 0) {
      pendingMessages.current.forEach(msg => {
        webViewRef.current?.postMessage(msg);
      });
      pendingMessages.current = [];
    }
  }, []);

  const handleMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "ready") {
        setIsReady(true);
        onMapReady?.();
        setTimeout(flushPending, 100);
      }
    } catch (e) {}
  }, [onMapReady, flushPending]);

  useEffect(() => {
    if (!isReady) return;
    const center = currentLocation || pickupLocation;
    if (center) {
      sendToMap({ type: "setCenter", lat: center.lat, lng: center.lng, zoom: 14 });
    }
  }, [isReady, currentLocation?.lat, currentLocation?.lng]);

  useEffect(() => {
    if (!isReady) return;
    if (pickupLocation) {
      sendToMap({ type: "setPickup", lat: pickupLocation.lat, lng: pickupLocation.lng });
    }
  }, [isReady, pickupLocation?.lat, pickupLocation?.lng]);

  useEffect(() => {
    if (!isReady) return;
    if (dropoffLocation) {
      sendToMap({ type: "setDropoff", lat: dropoffLocation.lat, lng: dropoffLocation.lng });
    }
  }, [isReady, dropoffLocation?.lat, dropoffLocation?.lng]);

  useEffect(() => {
    if (!isReady) return;
    if (showDriverMarker && driverLocation) {
      sendToMap({
        type: "setDriver",
        lat: driverLocation.lat,
        lng: driverLocation.lng,
        heading: driverLocation.heading || 0,
      });
    }
  }, [isReady, showDriverMarker, driverLocation?.lat, driverLocation?.lng, driverLocation?.heading]);

  useEffect(() => {
    if (!isReady) return;
    if (routeCoordinates && routeCoordinates.length > 1) {
      sendToMap({
        type: "setRoute",
        coords: routeCoordinates.map(c => [c.latitude, c.longitude]),
      });
    }
  }, [isReady, routeCoordinates]);

  useEffect(() => {
    if (!isReady) return;
    const bounds: Array<[number, number]> = [];
    if (pickupLocation) bounds.push([pickupLocation.lat, pickupLocation.lng]);
    if (dropoffLocation) bounds.push([dropoffLocation.lat, dropoffLocation.lng]);
    if (showDriverMarker && driverLocation) bounds.push([driverLocation.lat, driverLocation.lng]);
    if (bounds.length >= 2) {
      sendToMap({ type: "fitBounds", bounds });
    }
  }, [isReady, pickupLocation?.lat, dropoffLocation?.lat, driverLocation?.lat]);

  useEffect(() => {
    if (isReady) {
      sendToMap({ type: "setInteractive", value: interactive });
    }
  }, [isReady, interactive]);

  const htmlContent = React.useMemo(() => generateMapHTML(isDark), [isDark]);

  if (hasError) {
    return (
      <View style={[styles.container, { height, backgroundColor: theme.backgroundDefault }]}>
        <View style={styles.errorContainer}>
          <ThemedText style={[styles.errorText, { color: theme.textSecondary }]}>
            Map loading...
          </ThemedText>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { height }]}>
      <WebView
        ref={webViewRef}
        source={{ html: htmlContent }}
        style={styles.webview}
        onMessage={handleMessage}
        onError={() => setHasError(true)}
        onHttpError={() => {}}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        renderLoading={() => (
          <View style={[styles.loadingOverlay, { backgroundColor: isDark ? "#1d1d1d" : "#f5f5f5" }]}>
            <ActivityIndicator size="large" color={TRAVONY_GREEN} />
            <ThemedText style={[styles.loadingText, { color: theme.textSecondary }]}>
              Loading map...
            </ThemedText>
          </View>
        )}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        cacheEnabled={true}
        cacheMode="LOAD_CACHE_ELSE_NETWORK"
        mixedContentMode="always"
        androidLayerType="hardware"
        originWhitelist={["*"]}
        setSupportMultipleWindows={false}
      />

      {eta && rideStatus !== "completed" ? (
        <View style={[styles.etaContainer, { backgroundColor: theme.card }]}>
          <View style={styles.etaContent}>
            <View style={[styles.etaIndicator, { backgroundColor: TRAVONY_GREEN }]} />
            <View style={styles.etaInfo}>
              <ThemedText style={[styles.etaLabel, { color: theme.textMuted }]}>
                {rideStatus === "arriving" ? "Driver arriving" : rideStatus === "in_progress" ? "Arriving" : "ETA"}
              </ThemedText>
              <View style={styles.etaValueRow}>
                <ThemedText style={[styles.etaValue, { color: theme.text }]}>
                  {eta}
                </ThemedText>
                <ThemedText style={[styles.etaUnit, { color: theme.textSecondary }]}>
                  min
                </ThemedText>
                {distance ? (
                  <>
                    <View style={[styles.etaSeparator, { backgroundColor: theme.border }]} />
                    <ThemedText style={[styles.etaDistance, { color: theme.textSecondary }]}>
                      {distance.toFixed(1)} km
                    </ThemedText>
                  </>
                ) : null}
              </View>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: "hidden",
  },
  webview: {
    flex: 1,
    backgroundColor: "transparent",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    fontSize: 14,
  },
  etaContainer: {
    position: "absolute",
    bottom: 16,
    left: 16,
    right: 16,
    borderRadius: 16,
    padding: 12,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
      default: {},
    }),
  },
  etaContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  etaIndicator: {
    width: 4,
    height: 32,
    borderRadius: 2,
    marginRight: 12,
  },
  etaInfo: {
    flex: 1,
  },
  etaLabel: {
    fontSize: 11,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  etaValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: 2,
  },
  etaValue: {
    fontSize: 24,
    fontWeight: "700",
  },
  etaUnit: {
    fontSize: 14,
    fontWeight: "500",
    marginLeft: 4,
  },
  etaSeparator: {
    width: 1,
    height: 16,
    marginHorizontal: 8,
  },
  etaDistance: {
    fontSize: 14,
    fontWeight: "500",
  },
});
