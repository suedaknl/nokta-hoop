import { Canvas, useFrame } from '@react-three/fiber/native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as THREE from 'three';

export type MascotVisualState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'waiting' | 'error';
type MascotReaction = 'idle' | 'sleep' | 'tickle' | 'angry' | 'love';

export function NoktaAvatar({ state }: { state: MascotVisualState }) {
  const [reaction, setReaction] = useState<MascotReaction>('idle');
  const clickCount = useRef(0);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (state !== 'idle' && reaction === 'sleep') setReaction('idle');
    let timer: ReturnType<typeof setTimeout>;
    if (reaction === 'idle' && state === 'idle') {
      timer = setTimeout(() => setReaction('sleep'), 12000);
    } else if (reaction !== 'idle') {
      const duration = reaction === 'tickle' ? 900 : 2500;
      timer = setTimeout(() => setReaction('idle'), duration);
    }
    return () => clearTimeout(timer);
  }, [reaction, state]);

  const handlePress = () => {
    clickCount.current += 1;
    if (clickTimer.current) clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(() => { clickCount.current = 0; }, 800);
    if (clickCount.current >= 3) {
      setReaction('angry');
      clickCount.current = 0;
    } else {
      setReaction('tickle');
    }
  };

  return (
    <View style={styles.container}>
      {/* Kamerayı tam ortaladık ki sohbet kapalıyken ekranı doldursun */}
      <Canvas camera={{ position: [0, -0.2, 6.5], fov: 45 }} style={styles.canvas}>
        <color args={['#fafaf9']} attach="background" />
        <ambientLight intensity={1.2} />
        <directionalLight intensity={1.5} position={[5, 10, 5]} color="#ffffff" />
        <CuteRobotModel reaction={reaction} state={state} />
      </Canvas>

      {/* Emojiler */}
      {reaction !== 'idle' && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {reaction === 'sleep' ? '💤' : reaction === 'love' ? '💖' : reaction === 'angry' ? '💢' : '✨'}
          </Text>
        </View>
      )}

      <Pressable onPress={handlePress} onLongPress={() => setReaction('love')} style={StyleSheet.absoluteFill} />
    </View>
  );
}

function CuteRobotModel({ reaction, state }: { reaction: MascotReaction, state: MascotVisualState }) {
  const group = useRef<THREE.Group>(null);
  const leftEye = useRef<THREE.Mesh>(null);
  const rightEye = useRef<THREE.Mesh>(null);
  const antennaLight = useRef<THREE.Mesh>(null);
  const mouth = useRef<THREE.Mesh>(null);

  const isLoving = reaction === 'love';
  const isAngry = reaction === 'angry';
  const isTickled = reaction === 'tickle';
  const isSleeping = reaction === 'sleep';

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    if (group.current) {
      const baseY = 0.2; // Tam ortada durması için baz yüksekliği

      if (isAngry) {
        group.current.position.x = Math.sin(t * 40) * 0.04; // Titreme
        group.current.position.y = baseY;
      } else if (isLoving) {
        group.current.position.y = baseY + Math.abs(Math.sin(t * 8)) * 0.25; // Zıplama
        group.current.rotation.y = Math.sin(t * 3) * 0.15;
      } else {
        group.current.position.y = baseY + Math.sin(t * 2) * 0.12; // Tatlı süzülme
        group.current.rotation.y = Math.sin(t * 0.5) * 0.1;
        group.current.position.x = 0;
      }
    }

    // Göz Kırpma ve Mimikler
    if (leftEye.current && rightEye.current) {
      const blink = isSleeping ? 0.02 : isLoving ? 0.2 : isAngry ? 0.6 : (Math.sin(t * 0.5) > 0.98 ? 0.1 : 1);
      leftEye.current.scale.y = THREE.MathUtils.lerp(leftEye.current.scale.y, blink, 0.3);
      rightEye.current.scale.y = THREE.MathUtils.lerp(rightEye.current.scale.y, blink, 0.3);

      const eyeRot = isAngry ? 0.3 : isLoving ? -0.2 : 0;
      leftEye.current.rotation.z = THREE.MathUtils.lerp(leftEye.current.rotation.z, -eyeRot, 0.2);
      rightEye.current.rotation.z = THREE.MathUtils.lerp(rightEye.current.rotation.z, eyeRot, 0.2);
    }

    // Konuşurken antenin ışığı yanıp söner ve ağız hareket eder
    if (state === 'speaking' && !isAngry) {
      if (antennaLight.current) {
        const scale = 1 + Math.abs(Math.sin(t * 15)) * 0.5;
        antennaLight.current.scale.set(scale, scale, scale);
      }
      if (mouth.current) mouth.current.scale.set(1, 1 + Math.abs(Math.sin(t * 15)), 1);
    } else {
      if (antennaLight.current) antennaLight.current.scale.set(1, 1, 1);
      if (mouth.current) mouth.current.scale.set(1, 1, 1);
    }
  });

  // Renk Paleti: Pastel Mavi Gövde, Koyu Vizör, Parlayan Gözler
  const bodyColor = isAngry ? '#fca5a5' : '#bae6fd'; // Normalde bebek mavisi, kızınca pastel kırmızı
  const eyeColor = isAngry ? '#ef4444' : isLoving ? '#f472b6' : '#22d3ee'; // Dijital Camgöbeği/Pembe/Kırmızı

  return (
    <group ref={group}>

      {/* 1. Kafa Gövdesi (Yatay, Pofuduk Kapsül) */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <capsuleGeometry args={[0.7, 0.8, 32, 32]} />
        <meshStandardMaterial color={bodyColor} roughness={0.3} metalness={0.1} />
      </mesh>

      {/* 2. Siyah Dijital Vizör (Ekran) */}
      <mesh position={[0, 0, 0.5]} rotation={[0, 0, Math.PI / 2]}>
        <capsuleGeometry args={[0.55, 0.6, 32, 32]} />
        <meshStandardMaterial color="#0f172a" roughness={0.2} metalness={0.8} />
      </mesh>

      {/* 3. Dijital Gözler (Vizörün içinde parlayan LED'ler) */}
      <mesh ref={leftEye} position={[-0.35, 0.1, 1.05]}>
        <capsuleGeometry args={[0.08, 0.15, 16, 16]} />
        <meshStandardMaterial color={eyeColor} emissive={eyeColor} emissiveIntensity={0.8} />
      </mesh>
      <mesh ref={rightEye} position={[0.35, 0.1, 1.05]}>
        <capsuleGeometry args={[0.08, 0.15, 16, 16]} />
        <meshStandardMaterial color={eyeColor} emissive={eyeColor} emissiveIntensity={0.8} />
      </mesh>

      {/* 4. Tatlı Yanaklar */}
      <mesh position={[-0.6, -0.2, 1.02]}>
        <circleGeometry args={[0.12, 32]} />
        <meshBasicMaterial color="#f472b6" transparent opacity={0.6} />
      </mesh>
      <mesh position={[0.6, -0.2, 1.02]}>
        <circleGeometry args={[0.12, 32]} />
        <meshBasicMaterial color="#f472b6" transparent opacity={0.6} />
      </mesh>

      {/* 5. Küçük Dijital Ağız */}
      {!isAngry && (
        <mesh ref={mouth} position={[0, -0.15, 1.06]} rotation={[0, 0, Math.PI]}>
          <torusGeometry args={[0.08, 0.02, 16, 32, Math.PI]} />
          <meshBasicMaterial color={eyeColor} />
        </mesh>
      )}

      {/* 6. Şirin Anten Çubuğu */}
      <mesh position={[0, 0.8, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.4, 16]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.5} roughness={0.2} />
      </mesh>

      {/* 7. Anten Işığı (Konuşurken Parlar) */}
      <mesh ref={antennaLight} position={[0, 1.05, 0]}>
        <sphereGeometry args={[0.12, 32, 32]} />
        <meshStandardMaterial color={state === 'speaking' ? '#fde047' : '#fbbf24'} emissive={state === 'speaking' ? '#fde047' : '#fbbf24'} emissiveIntensity={state === 'speaking' ? 1.5 : 0.5} />
      </mesh>

      {/* 8. Uçan Minik Gövde (Kafanın Altında) */}
      <mesh position={[0, -1.1, 0]}>
        <capsuleGeometry args={[0.3, 0.2, 32, 32]} />
        <meshStandardMaterial color={bodyColor} roughness={0.4} />
      </mesh>

    </group>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 350 },
  canvas: { flex: 1 },
  badge: {
    position: 'absolute',
    top: '12%',
    right: '15%',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 3,
  },
  badgeText: { fontSize: 24, color: '#333' }
});