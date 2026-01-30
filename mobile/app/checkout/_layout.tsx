import { Stack } from 'expo-router';
import { Colors } from '@/constants/Colors';

export default function CheckoutLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: Colors.dark.background },
            }}
        >
            <Stack.Screen name="index" />
        </Stack>
    );
}
