import React, { useEffect } from "react";
import { useNavigation } from "@react-navigation/native";

export default function StreamViewerScreen() {
  const navigation = useNavigation<any>();
  useEffect(() => {
    navigation.goBack();
  }, [navigation]);
  return null;
}
