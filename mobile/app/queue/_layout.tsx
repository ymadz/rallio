import { Stack } from 'expo-router';
import { Colors } from '@/constants/Colors';

export default function QueueLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: Colors.dark.background },
            }}
        >
            <Stack.Screen name="[id]" />
        </Stack>
    );
}
