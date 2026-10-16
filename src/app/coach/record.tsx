import React, { useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Camera, CircleStop, Film, SwitchCamera, Upload } from 'lucide-react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Screen, SectionHeader } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip, } from '@/components/ui/Chip';
import { useColors } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/theme';
import { analyzeSwingVideo } from '@/lib/api/ai';
import { isClerkConfigured } from '@/lib/config';
import type { SwingCameraView } from '@/types/domain';

const CLUBS = ['Driver', 'Wood', 'Hybrid', 'Iron', 'Wedge', 'Putter'];

type Stage = 'setup' | 'record' | 'review' | 'uploading' | 'error';

export default function RecordSwingScreen() {
  const colors = useColors();
  const router = useRouter();
  const cameraRef = useRef<CameraView | null>(null);
  const [, requestCamPerm] = useCameraPermissions();
  const [, requestMicPerm] = useMicrophonePermissions();

  const [stage, setStage] = useState<Stage>('setup');
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [recording, setRecording] = useState(false);
  const [, setVideoUri] = useState<string | null>(null);
  const [cameraView, setCameraView] = useState<SwingCameraView>('down_the_line');
  const [clubType, setClubType] = useState('Iron');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState('');

  const startCamera = async () => {
    const cam = await requestCamPerm();
    const mic = await requestMicPerm();
    if (!cam.granted || !mic.granted) {
      Alert.alert(
        'Camera needed',
        'Arcfore records your swing video to analyze it. Enable camera + microphone in Settings → Arcfore.',
      );
      return;
    }
    setStage('record');
  };

  const pickFromLibrary = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      videoMaxDuration: 30,
      allowsEditing: false,
    });
    if (!res.canceled && res.assets[0]?.uri) {
      setVideoUri(res.assets[0].uri);
      submit(res.assets[0].uri);
    }
  };

  const startRecording = async () => {
    if (!cameraRef.current || recording) return;
    setRecording(true);
    try {
      const video = await cameraRef.current.recordAsync({ maxDuration: 30 });
      if (video?.uri) {
        setVideoUri(video.uri);
        submit(video.uri);
      } else {
        setStage('setup');
      }
    } catch {
      setError('Recording failed — try again.');
      setStage('setup');
    } finally {
      setRecording(false);
    }
  };

  const stopRecording = () => {
    cameraRef.current?.stopRecording();
  };

  const submit = async (uri: string) => {
    setStage('uploading');
    setError(null);
    try {
      setProgress('Uploading video…');
      const res = await analyzeSwingVideo({
        fileUri: uri,
        cameraView,
        clubType,
      });
      setProgress('');
      router.replace(`/coach/analysis/${res.analysisId}`);
    } catch (e) {
      setError(
        e instanceof Error && /fetch|network/i.test(e.message)
          ? 'Upload failed — check your connection and try again.'
          : 'Analysis could not be completed right now. Try again in a moment.',
      );
      setStage('error');
    }
  };

  if (stage === 'record') {
    return (
      <View style={styles.cameraWrap}>
        <Stack.Screen options={{ title: 'Record swing', headerTransparent: true }} />
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={facing}
          mode="video"
        />
        <View style={styles.cameraControls}>
          <Pressable onPress={() => setFacing(facing === 'back' ? 'front' : 'back')} style={styles.flipBtn}>
            <SwitchCamera size={22} color="#fff" />
          </Pressable>
          <Pressable
            onPress={recording ? stopRecording : startRecording}
            style={[styles.recordBtn, recording && { backgroundColor: '#B3402F' }]}
            accessibilityLabel={recording ? 'Stop recording' : 'Start recording'}
          >
            {recording ? <CircleStop size={30} color="#fff" /> : <View style={styles.recordDot} />}
          </Pressable>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.cameraHint}>
          <Text variant="caption" style={{ color: '#fff' }}>
            {recording
              ? 'Recording… tap stop when the swing finishes'
              : 'Frame the full swing — head to feet — then record. Max 30s.'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <Screen scroll>
      <Stack.Screen options={{ title: 'Analyze swing', headerBackTitle: 'Back' }} />
      <View style={styles.header}>
        <Text variant="title" style={{ color: colors.forest }}>
          Your swing, analyzed.
        </Text>
        <Text variant="body" secondary>
          Film one swing — Arcfore watches it and picks the single most useful thing to work on. Honest about
          what it can and can't see.
        </Text>
      </View>

      <SectionHeader title="Camera angle" />
      <View style={styles.chipRow}>
        <Chip
          label="Down the line"
          selected={cameraView === 'down_the_line'}
          onPress={() => setCameraView('down_the_line')}
        />
        <Chip
          label="Face on"
          selected={cameraView === 'face_on'}
          onPress={() => setCameraView('face_on')}
        />
        <Chip label="Not sure" selected={cameraView === 'unknown'} onPress={() => setCameraView('unknown')} />
      </View>

      <SectionHeader title="Club" />
      <View style={styles.chipRow}>
        {CLUBS.map((c) => (
          <Chip key={c} label={c} selected={clubType === c} onPress={() => setClubType(c)} />
        ))}
      </View>

      <Card style={styles.tipCard}>
        <Text variant="label">For the best result</Text>
        <Text variant="caption" secondary>
          · Keep the golfer fully in frame — head to feet{"\n"}· Good light, steady phone{"\n"}· One swing per
          video{"\n"}· 3–15 seconds is ideal (30 max)
        </Text>
      </Card>

      {stage === 'uploading' ? (
        <Animated.View entering={FadeIn} style={styles.uploadWrap}>
          <View style={styles.progressTrack}>
            <Animated.View
              entering={FadeIn}
              style={[styles.progressFill, { backgroundColor: colors.brass }]}
            />
          </View>
          <Text variant="bodyStrong" center>
            Analyzing your swing…
          </Text>
          <Text variant="caption" secondary center>
            {progress || 'Gemini is watching the video — this can take up to a minute.'}
          </Text>
        </Animated.View>
      ) : (
        <View style={styles.ctaRow}>
          <Button
            title="Record a swing"
            size="xl"
            fullWidth
            icon={<Camera size={20} color="#F7F4EC" />}
            onPress={startCamera}
            disabled={!isClerkConfigured()}
          />
          <Button
            title="Upload from library"
            variant="outline"
            size="lg"
            fullWidth
            icon={<Film size={18} color={colors.text} />}
            onPress={pickFromLibrary}
            disabled={!isClerkConfigured()}
          />
          {!isClerkConfigured() ? (
            <Card>
              <Text variant="caption" secondary>
                Swing analysis needs a signed-in account and the Arcfore API running. See README → env setup.
              </Text>
            </Card>
          ) : null}
        </View>
      )}

      {stage === 'error' && error ? (
        <Card style={{ borderColor: colors.danger }}>
          <Text variant="label" style={{ color: colors.danger }}>
            {error}
          </Text>
          <Button title="Try again" variant="outline" onPress={() => setStage('setup')} />
        </Card>
      ) : null}

      <Card>
        <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
          <Upload size={15} color={colors.textSecondary} style={{ marginTop: 2 }} />
          <Text variant="caption" secondary style={{ flex: 1 }}>
            Videos upload privately to your account, analyzed by Google Gemini, and are deletable any time.
            They're never shared or used for anything else.
          </Text>
        </View>
      </Card>
      <View style={{ height: spacing.xxxl }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: spacing.lg, marginBottom: spacing.md, gap: spacing.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  tipCard: { marginBottom: spacing.lg, gap: spacing.xs },
  ctaRow: { gap: spacing.sm, marginTop: spacing.sm },
  cameraWrap: { flex: 1, backgroundColor: '#000' },
  cameraControls: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
  },
  flipBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#00000088',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#C0392B44',
  },
  recordDot: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#E74C3C' },
  cameraHint: {
    position: 'absolute',
    top: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  uploadWrap: { gap: spacing.md, alignItems: 'center', paddingVertical: spacing.xl },
  progressTrack: {
    height: 4,
    width: '80%',
    borderRadius: 2,
    backgroundColor: '#00000018',
    overflow: 'hidden',
  },
  progressFill: { height: 4, width: '60%', borderRadius: 2 },
});
