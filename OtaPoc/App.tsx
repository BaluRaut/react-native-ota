import React, { useState } from 'react';
import { View, Text, Button, Alert, StyleSheet, ActivityIndicator } from 'react-native';
import { HotUpdater } from '@hot-updater/react-native';

const App = () => {
  const [status, setStatus] = useState('Idle');
  const [loading, setLoading] = useState(false);

  // -------------------------------------------------
  // CHANGE THIS TEXT TO TEST UPDATE (e.g., "Version 2.0.0")
  const CURRENT_VERSION_TEXT = "Version 9.0.0"; 
  // -------------------------------------------------

  const checkUpdate = async () => {
    setLoading(true);
    setStatus('Checking API...');
    
    try {
      // 1. Check for update (Pass config directly here)
      const update = await HotUpdater.checkForUpdate({
        source: "http://10.0.2.2:3000/check", 
        requestHeaders: {
          Authorization: "Bearer my-secret-user"
        }
      });
      
      if (update) {
        setStatus(`Found update! Downloading...`);
        
        // 2. Download and Apply Bundle
        await update.updateBundle();
        
        Alert.alert("Update Ready", "The app will now restart to apply the update.", [
            { text: "OK", onPress: () => HotUpdater.reload() }
        ]);
        setStatus('Update applied. Restarting...');
      } else {
        setStatus('No update available on server.');
      }
    } catch (e: any) {
      setStatus('Error: ' + e.message);
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>OTA POC App</Text>
      
      <View style={styles.card}>
        <Text style={styles.label}>Current Bundle Version:</Text>
        <Text style={styles.version}>{CURRENT_VERSION_TEXT}</Text>
      </View>

      <View style={styles.statusBox}>
        <Text style={styles.statusText}>{status}</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#0000ff" />
      ) : (
        <Button title="Check for Secure Update" onPress={checkUpdate} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#f5f5f5' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 30, textAlign: 'center' },
  card: { backgroundColor: 'white', padding: 20, borderRadius: 10, marginBottom: 20, elevation: 2 },
  label: { fontSize: 14, color: '#666' },
  version: { fontSize: 28, fontWeight: 'bold', color: '#2563eb', marginTop: 5 },
  statusBox: { backgroundColor: '#e0e7ff', padding: 15, borderRadius: 8, marginBottom: 20 },
  statusText: { color: '#1e40af', textAlign: 'center' }
});

export default App;
