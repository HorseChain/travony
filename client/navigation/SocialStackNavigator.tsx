import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import SocialScreen from "@/screens/SocialScreen";
import StreamViewerScreen from "@/screens/StreamViewerScreen";
import MemoriesScreen from "@/screens/MemoriesScreen";
import PostCommentsScreen from "@/screens/PostCommentsScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type SocialStackParamList = {
  Social: undefined;
  StreamViewer: { channel: string; name: string };
  Memories: undefined;
  PostComments: { postId: string };
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
      <Stack.Screen
        name="Memories"
        component={MemoriesScreen}
        options={{ headerTitle: "Ride Memories" }}
      />
      <Stack.Screen
        name="PostComments"
        component={PostCommentsScreen}
        options={{ headerTitle: "Comments" }}
      />
    </Stack.Navigator>
  );
}
