import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const AnimeMascot3D = ({ 
  isSpeaking = false, 
  isListening = false, 
  isTyping = false, 
  spokenText = '', 
  modelUrl = null,
  actionOverride = null, 
  speechMuted = false,
  lang = 'en-IN',
  onSpeechEnd = () => {} 
}) => {
  const containerRef = useRef(null);
  const [currentAction, setCurrentAction] = useState('idle');
  const [useGltfAvatar, setUseGltfAvatar] = useState(false);

  const mouthMeshRef = useRef(null);
  const headGroupRef = useRef(null);
  const bodyGroupRef = useRef(null);
  const tailMeshRef = useRef(null);
  const gemLightRef = useRef(null);
  const leftArmRef = useRef(null);
  const rightArmRef = useRef(null);
  const gltfModelRef = useRef(null);
  const morphMeshesRef = useRef([]);

  const mousePos = useRef({ x: 0, y: 0 });
  const utteranceRef = useRef(null);

  // Sync action state
  useEffect(() => {
    if (actionOverride) {
      setCurrentAction(actionOverride);
    } else if (isSpeaking) {
      setCurrentAction('talking');
    } else if (isTyping) {
      setCurrentAction('thinking');
    } else if (isListening) {
      setCurrentAction('listening');
    } else {
      setCurrentAction('idle');
    }
  }, [isSpeaking, isTyping, isListening, actionOverride]);

  // Microsoft Edge-TTS Neural Speech with Web Speech Synthesis Fallback
  useEffect(() => {
    let audioInstance = null;
    let isCancelled = false;

    if (speechMuted) {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      return;
    }

    if (spokenText && isSpeaking && !speechMuted) {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();

      // Clean text for speech
      const cleanText = spokenText
        .replace(/[*#_~`>]/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/\n+/g, '. ')
        .trim();

      if (!cleanText) return;

      const playFallbackWebSpeech = () => {
        if (!('speechSynthesis' in window) || isCancelled) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.rate = lang.startsWith('ta') ? 0.95 : 1.05;
        utterance.pitch = 1.05;

        const assignVoice = () => {
          const voices = window.speechSynthesis.getVoices();
          if (voices.length > 0) {
            if (lang.startsWith('ta')) {
              const tamilVoice = voices.find(v => v.lang.startsWith('ta') || v.name.toLowerCase().includes('tamil'));
              if (tamilVoice) utterance.voice = tamilVoice;
            } else if (lang.startsWith('hi')) {
              const hindiVoice = voices.find(v => v.lang.startsWith('hi') || v.name.toLowerCase().includes('hindi'));
              if (hindiVoice) utterance.voice = hindiVoice;
            } else if (lang.startsWith('ml')) {
              const malayalamVoice = voices.find(v => v.lang.startsWith('ml') || v.name.toLowerCase().includes('malayalam'));
              if (malayalamVoice) utterance.voice = malayalamVoice;
            } else {
              const englishVoice = voices.find(v => (v.lang === 'en-IN' || v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Zira') || v.lang.startsWith('en')));
              if (englishVoice) utterance.voice = englishVoice;
            }
          }
        };

        assignVoice();
        if ('onvoiceschanged' in window.speechSynthesis) {
          window.speechSynthesis.onvoiceschanged = assignVoice;
        }

        utterance.onend = () => onSpeechEnd();
        utterance.onerror = () => onSpeechEnd();
        utteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);
      };

      // Fetch high quality Edge-TTS audio from backend
      const targetLang = lang.startsWith('ta') ? 'ta' : (lang.startsWith('hi') ? 'hi' : (lang.startsWith('ml') ? 'ml' : 'en'));
      fetch('/api/voice/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: cleanText.slice(0, 800), // optimal speech chunk
          language: targetLang
        })
      })
      .then(res => res.json())
      .then(data => {
        if (isCancelled) return;
        if (data.success && data.audio_base64) {
          audioInstance = new Audio(`data:audio/mp3;base64,${data.audio_base64}`);
          audioInstance.onended = () => onSpeechEnd();
          audioInstance.onerror = () => playFallbackWebSpeech();
          audioInstance.play().catch(() => playFallbackWebSpeech());
        } else {
          playFallbackWebSpeech();
        }
      })
      .catch(() => {
        if (!isCancelled) playFallbackWebSpeech();
      });
    }

    return () => {
      isCancelled = true;
      if (audioInstance) {
        audioInstance.pause();
        audioInstance = null;
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [spokenText, isSpeaking, speechMuted, lang]);

  // Three.js 3D WebGL Canvas Engine Initialization
  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth || 320;
    const height = containerRef.current.clientHeight || 400;

    // 1. Scene
    const scene = new THREE.Scene();

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0.5, 7.5);

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;

    // Clear existing canvas
    while (containerRef.current.firstChild) {
      containerRef.current.removeChild(containerRef.current.firstChild);
    }
    containerRef.current.appendChild(renderer.domElement);

    // 4. 3D Lighting Setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x00f2fe, 1.3);
    dirLight.position.set(5, 8, 5);
    scene.add(dirLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.9);
    rimLight.position.set(-5, 5, -5);
    scene.add(rimLight);

    const gemLight = new THREE.PointLight(0x00f2fe, 2.5, 10);
    gemLight.position.set(0, 0.4, 0.8);
    scene.add(gemLight);
    gemLightRef.current = gemLight;

    // 5. Materials
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0xf0f9ff,
      roughness: 0.25,
      metalness: 0.1,
    });

    const armorMaterial = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.2,
      metalness: 0.4,
    });

    const gemMaterial = new THREE.MeshStandardMaterial({
      color: 0x00f2fe,
      emissive: 0x00f2fe,
      emissiveIntensity: 0.8,
      roughness: 0.1,
    });

    const eyeMaterial = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      roughness: 0.1,
      metalness: 0.2,
    });

    const pupilMaterial = new THREE.MeshBasicMaterial({ color: 0x090d16 });
    const highlightMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

    // 6. Character 3D Assembly Groups
    const characterGroup = new THREE.Group();
    scene.add(characterGroup);
    bodyGroupRef.current = characterGroup;

    // --- 3D STAGE PODIUM ---
    const podiumGeo = new THREE.CylinderGeometry(2.0, 2.2, 0.12, 32);
    const podiumMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      emissive: 0x00f2fe,
      emissiveIntensity: 0.3,
      roughness: 0.3,
    });
    const podium = new THREE.Mesh(podiumGeo, podiumMat);
    podium.position.y = -2.2;
    scene.add(podium);

    // --- 3D TORSO ---
    const torsoGeo = new THREE.CylinderGeometry(0.8, 0.95, 1.8, 32);
    const torso = new THREE.Mesh(torsoGeo, bodyMaterial);
    torso.position.y = -0.2;
    characterGroup.add(torso);

    // 3D Chest Vest Armor
    const vestGeo = new THREE.CylinderGeometry(0.82, 0.88, 1.0, 32);
    const vest = new THREE.Mesh(vestGeo, armorMaterial);
    vest.position.y = 0.2;
    characterGroup.add(vest);

    // 3D Glowing Core Gem
    const gemGeo = new THREE.OctahedronGeometry(0.24);
    const gem = new THREE.Mesh(gemGeo, gemMaterial);
    gem.position.set(0, 0.4, 0.82);
    characterGroup.add(gem);

    // --- 3D LEGS ---
    const legGeo = new THREE.CapsuleGeometry(0.22, 1.0, 16, 16);
    const leftLeg = new THREE.Mesh(legGeo, armorMaterial);
    leftLeg.position.set(-0.5, -1.5, 0);
    characterGroup.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, armorMaterial);
    rightLeg.position.set(0.5, -1.5, 0);
    characterGroup.add(rightLeg);

    // --- 3D ARMS ---
    const armGeo = new THREE.CapsuleGeometry(0.18, 0.9, 16, 16);
    const leftArm = new THREE.Mesh(armGeo, bodyMaterial);
    leftArm.position.set(-1.0, 0.2, 0);
    leftArm.rotation.z = 0.2;
    characterGroup.add(leftArm);
    leftArmRef.current = leftArm;

    const rightArm = new THREE.Mesh(armGeo, bodyMaterial);
    rightArm.position.set(1.0, 0.2, 0);
    rightArm.rotation.z = -0.2;
    characterGroup.add(rightArm);
    rightArmRef.current = rightArm;

    // --- 3D TAIL ---
    const tailGroup = new THREE.Group();
    tailGroup.position.set(0, -0.6, -0.8);
    characterGroup.add(tailGroup);
    tailMeshRef.current = tailGroup;

    const tailPart1 = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.2, 16), armorMaterial);
    tailPart1.rotation.x = -Math.PI / 3;
    tailGroup.add(tailPart1);

    const tailPart2 = new THREE.Mesh(new THREE.ConeGeometry(0.25, 1.0, 16), gemMaterial);
    tailPart2.position.set(0, 0.6, -0.4);
    tailPart2.rotation.x = -Math.PI / 4;
    tailGroup.add(tailPart2);

    // --- 3D HEAD GROUP ---
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 1.2, 0);
    characterGroup.add(headGroup);
    headGroupRef.current = headGroup;

    // 3D Head Base
    const headGeo = new THREE.SphereGeometry(1.0, 32, 32);
    const head = new THREE.Mesh(headGeo, bodyMaterial);
    headGroup.add(head);

    // 3D Anime Ears
    const earGeo = new THREE.ConeGeometry(0.32, 1.4, 16);
    const leftEar = new THREE.Mesh(earGeo, bodyMaterial);
    leftEar.position.set(-0.6, 1.0, -0.1);
    leftEar.rotation.z = 0.35;
    leftEar.rotation.x = -0.1;
    headGroup.add(leftEar);

    const leftEarInner = new THREE.Mesh(new THREE.ConeGeometry(0.24, 1.1, 16), armorMaterial);
    leftEarInner.position.set(-0.6, 1.0, 0.02);
    leftEarInner.rotation.z = 0.35;
    headGroup.add(leftEarInner);

    const rightEar = new THREE.Mesh(earGeo, bodyMaterial);
    rightEar.position.set(0.6, 1.0, -0.1);
    rightEar.rotation.z = -0.35;
    rightEar.rotation.x = -0.1;
    headGroup.add(rightEar);

    const rightEarInner = new THREE.Mesh(new THREE.ConeGeometry(0.24, 1.1, 16), armorMaterial);
    rightEarInner.position.set(0.6, 1.0, 0.02);
    rightEarInner.rotation.z = -0.35;
    headGroup.add(rightEarInner);

    // 3D Eyes
    const eyeGeo = new THREE.SphereGeometry(0.22, 16, 16);
    const leftEye = new THREE.Mesh(eyeGeo, eyeMaterial);
    leftEye.position.set(-0.36, 0.15, 0.88);
    leftEye.scale.set(1.0, 1.3, 0.4);
    headGroup.add(leftEye);

    const leftPupil = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 16), pupilMaterial);
    leftPupil.position.set(-0.36, 0.15, 0.96);
    headGroup.add(leftPupil);

    const leftHighlight = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 16), highlightMaterial);
    leftHighlight.position.set(-0.32, 0.22, 1.0);
    headGroup.add(leftHighlight);

    const rightEye = new THREE.Mesh(eyeGeo, eyeMaterial);
    rightEye.position.set(0.36, 0.15, 0.88);
    rightEye.scale.set(1.0, 1.3, 0.4);
    headGroup.add(rightEye);

    const rightPupil = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 16), pupilMaterial);
    rightPupil.position.set(0.36, 0.15, 0.96);
    headGroup.add(rightPupil);

    const rightHighlight = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 16), highlightMaterial);
    rightHighlight.position.set(0.4, 0.22, 1.0);
    headGroup.add(rightHighlight);

    // 3D Mouth
    const mouthGeo = new THREE.TorusGeometry(0.12, 0.03, 16, 32);
    const mouthMat = new THREE.MeshBasicMaterial({ color: 0x090d16 });
    const mouth = new THREE.Mesh(mouthGeo, mouthMat);
    mouth.position.set(0, -0.22, 0.94);
    headGroup.add(mouth);
    mouthMeshRef.current = mouth;

    // 7. Mouse Movement Handler (3D Pointer Tracking)
    const handleMouseMove = (e) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      mousePos.current = { x, y };
    };

    window.addEventListener('mousemove', handleMouseMove);

    // Attempt loading custom GLTF GLB Avatar model (e.g. Ready Player Me or custom model)
    const targetGltfPath = modelUrl || '/avatar.glb';
    const loader = new GLTFLoader();
    loader.load(
      targetGltfPath,
      (gltf) => {
        const model = gltf.scene;
        model.position.set(0, -1.8, 0);
        model.scale.set(1.5, 1.5, 1.5);
        scene.add(model);
        gltfModelRef.current = model;
        setUseGltfAvatar(true);

        // Hide procedural model if GLTF loaded
        if (characterGroup) characterGroup.visible = false;

        // Traverse for morph targets (Visemes)
        morphMeshesRef.current = [];
        model.traverse((child) => {
          if (child.isMesh && child.morphTargetDictionary) {
            morphMeshesRef.current.push(child);
          }
        });
      },
      undefined,
      (err) => {
        // Fallback gracefully to procedural 3D Lucario mascot if no GLB avatar present
        setUseGltfAvatar(false);
      }
    );

    // 8. 3D Animation Loop
    let animationFrameId;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // 3D Mouse Tracking Head Gaze
      if (headGroupRef.current) {
        headGroupRef.current.rotation.y = THREE.MathUtils.lerp(
          headGroupRef.current.rotation.y,
          mousePos.current.x * 0.45,
          0.08
        );
        headGroupRef.current.rotation.x = THREE.MathUtils.lerp(
          headGroupRef.current.rotation.x,
          -mousePos.current.y * 0.3,
          0.08
        );
      }

      if (gltfModelRef.current) {
        gltfModelRef.current.rotation.y = THREE.MathUtils.lerp(
          gltfModelRef.current.rotation.y,
          mousePos.current.x * 0.3,
          0.08
        );
      }

      // 3D Idle Breathing & Floating Motion
      if (bodyGroupRef.current) {
        bodyGroupRef.current.position.y = Math.sin(elapsedTime * 2) * 0.08;
      }

      // 3D Tail Swaying
      if (tailMeshRef.current) {
        tailMeshRef.current.rotation.y = Math.sin(elapsedTime * 3) * 0.25;
      }

      // 3D Gem Pulse
      if (gemLightRef.current) {
        gemLightRef.current.intensity = 2.0 + Math.sin(elapsedTime * 4) * 0.8;
      }

      // 3D Mouth Lip Sync Morphing when speaking
      if (mouthMeshRef.current) {
        if (isSpeaking) {
          const mouthScale = 1.0 + Math.abs(Math.sin(elapsedTime * 15)) * 1.5;
          mouthMeshRef.current.scale.set(1.2, mouthScale, 1.0);
        } else {
          mouthMeshRef.current.scale.set(1.0, 0.4, 1.0);
        }
      }

      // GLTF Viseme / Morph Target Lip Syncing
      if (morphMeshesRef.current.length > 0) {
        const visemeVal = isSpeaking ? Math.abs(Math.sin(elapsedTime * 14)) * 0.8 : 0;
        morphMeshesRef.current.forEach((mesh) => {
          const dict = mesh.morphTargetDictionary;
          const infl = mesh.morphTargetInfluences;
          if (dict && infl) {
            ['viseme_aa', 'viseme_E', 'viseme_I', 'viseme_O', 'viseme_U', 'mouthOpen', 'jawOpen'].forEach((key) => {
              if (key in dict) {
                infl[dict[key]] = visemeVal;
              }
            });
          }
        });
      }

      renderer.render(scene, camera);
    };

    animate();

    // Resize Handler
    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      renderer.dispose();
    };
  }, [isSpeaking]);

  const triggerAction = (actionName) => {
    setCurrentAction(actionName);
    if (rightArmRef.current) {
      if (actionName === 'wave') {
        rightArmRef.current.rotation.z = -1.2;
        setTimeout(() => {
          if (rightArmRef.current) rightArmRef.current.rotation.z = -0.2;
          setCurrentAction('idle');
        }, 2500);
      } else if (actionName === 'power_blast') {
        if (leftArmRef.current) leftArmRef.current.rotation.z = 1.2;
        rightArmRef.current.rotation.z = -1.2;
        setTimeout(() => {
          if (leftArmRef.current) leftArmRef.current.rotation.z = 0.2;
          if (rightArmRef.current) rightArmRef.current.rotation.z = -0.2;
          setCurrentAction('idle');
        }, 2500);
      }
    }
  };

  return (
    <div className="flex flex-col items-center select-none w-full">
      {/* 3D WebGL Canvas Container */}
      <div 
        ref={containerRef} 
        className="w-full h-[320px] sm:h-[400px] cursor-grab active:cursor-grabbing relative"
      />

      {/* 3D Interactive Controls */}
      <div className="flex flex-wrap justify-center gap-2 mt-1 z-20">
        <button 
          onClick={() => triggerAction('power_blast')}
          className="px-3.5 py-1.5 btn-ocean dark:btn-gradient-cyan text-xs font-extrabold shadow-xs hover:scale-105 transition-all"
        >
          ⚡ 3D Power Stance
        </button>
        <button 
          onClick={() => triggerAction('wave')}
          className="px-3.5 py-1.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-cyan-500/30 rounded-xl text-xs font-bold hover:scale-105 transition-all"
        >
          👋 3D Wave
        </button>
      </div>
    </div>
  );
};

export default AnimeMascot3D;
