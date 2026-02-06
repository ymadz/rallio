import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography } from '@/constants/Colors';

export default function MapScreen() {
    return (
        <View style={styles.container}>
            <Text style={styles.text}>Map view is not available on web.</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.dark.background,
        alignItems: 'center',
        justifyContent: 'center',
    },
    text: {
        ...Typography.body,
        color: Colors.dark.text,
    },
});
