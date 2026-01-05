import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerTitleAlign: 'center' }}>
      <Tabs.Screen
        name="calculator"
        options={{ title: 'Calculadora' }}
      />
      <Tabs.Screen
        name="comparison"
        options={{ title: 'Comparar' }}
      />
    </Tabs>
  );
}
