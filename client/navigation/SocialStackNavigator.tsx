import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import SocialScreen from "@/screens/SocialScreen";
import AgoraStreamViewerScreen from "@/screens/AgoraStreamViewerScreen";
import MemoriesScreen from "@/screens/MemoriesScreen";
import PostCommentsScreen from "@/screens/PostCommentsScreen";
import DiscoverScreen from "@/screens/DiscoverScreen";
import HubDetailScreen from "@/screens/HubDetailScreen";
import ClipPlayerScreen from "@/screens/ClipPlayerScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type SocialStackParamList = {
  Social: undefined;
  AgoraStreamViewer: { postId: string; name?: string };
  Memories: undefined;
  PostComments: { postId: string };
  Discover: { initialQuery?: string } | undefined;
  HubDetail: { hubId: string; hubName: string };
  ClipPlayer: { clipId?: string; feedPostId?: string; title?: string; previewToken?: string };
};

const Stack = createNativeStackNavigator<SocialStackParamList>();

export default function SocialStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Social"
        component={SocialScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AgoraStreamViewer"
        component={AgoraStreamViewerScreen}
        options={{ headerShown: false }}
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
      <Stack.Screen
        name="Discover"
        component={DiscoverScreen}
        options={{ headerTitle: "Discover" }}
      />
      <Stack.Screen
        name="HubDetail"
        component={HubDetailScreen}
        options={({ route }) => ({ headerTitle: route.params.hubName })}
      />
      <Stack.Screen
        name="ClipPlayer"
        component={ClipPlayerScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
