import { StatusBar } from "expo-status-bar";
import { Text, View } from "react-native";

export default function App() {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-xl font-bold">Expo + NativeWind</Text>
      <Text className="text-zinc-600 mt-2">Monorepo native app scaffold.</Text>
      <StatusBar style="auto" />
    </View>
  );
}

