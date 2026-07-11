import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import SocialScreen from "@/screens/SocialScreen";
import StreamViewerScreen from "@/screens/StreamViewerScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type SocialStackParamList = {
  Social: undefined;
  StreamViewer: { channel: string; name: string };
};

const Stack = createNativeStackNavigator<SocialStackParamList>();

export default function SocialStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Social"
        component={SocialScreen}
        options={{ headerTitle: "Network" }}
      />
      <Stack.Screen
        name="StreamViewer"
        component={StreamViewerScreen}
        options={({ route }) => ({ headerTitle: route.params.name })}
      />
    </Stack.Navigator>
  );
}
