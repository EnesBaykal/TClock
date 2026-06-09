// ─────────────────────────────────────────────────────────────────────────────
// TClock — Sinematik 3D açılış (saf Three.js, derleme gerektirmez)
// Backlight + rim light + bevel'li extrude metin + UnrealBloom + Float + zoom-in
// Font: Space Grotesk Bold (typeface JSON, yerele gömülü)
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const container = document.getElementById('splash');
if (container) initSplash3D(container);

function initSplash3D(container) {
  const W = () => container.clientWidth || window.innerWidth;
  const H = () => container.clientHeight || window.innerHeight;

  // ── Renderer ──
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(W(), H());
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
  container.appendChild(renderer.domElement);

  // ── Scene & camera ──
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x000000, 9, 17);

  const camera = new THREE.PerspectiveCamera(40, W() / H(), 0.1, 100);
  camera.position.set(0, 0.6, 11); // uzaktan başla → yavaş zoom-in

  // ── Işıklandırma: arkadan aydınlatma (backlight / rim) ──
  scene.add(new THREE.AmbientLight(0xffffff, 0.35)); // ön yüz okunur kalsın

  // Ana backlight — metnin TAM ARKASINDA, kameraya doğru → kenarlarda rim
  const back = new THREE.SpotLight(0xbcd4ff, 2.4, 40, 0.6, 0.7, 0);
  back.position.set(0, 0, -7);
  const backTarget = new THREE.Object3D();
  backTarget.position.set(0, 0, 0);
  scene.add(backTarget);
  back.target = backTarget;
  scene.add(back);

  // Üstten ikinci arka kaynak (hafif sıcak) — rim'e renk derinliği
  const backWarm = new THREE.SpotLight(0xfff2d6, 1.2, 30, 0.5, 0.6, 0);
  backWarm.position.set(0, 3, -5);
  backWarm.target = backTarget;
  scene.add(backWarm);

  // Ön dolgu — metni öne çıkaran yumuşak ışık
  const fill = new THREE.DirectionalLight(0xbcd0f0, 0.6);
  fill.position.set(2, 1.5, 6);
  scene.add(fill);

  // Ön-üst key — yüzleri tanımlar, okunabilirliği artırır
  const key = new THREE.DirectionalLight(0xffffff, 0.7);
  key.position.set(-2.5, 4, 5);
  scene.add(key);

  // Yan kenar vurgusu (rim'i belirginleştirir)
  const edge = new THREE.PointLight(0xaccbff, 1.2, 25, 0);
  edge.position.set(-4, 0.5, -2);
  scene.add(edge);

  // ── Post-processing: Bloom (MSAA 4x + HalfFloat → temiz kenar, yüksek kalite) ──
  const dbSize = renderer.getDrawingBufferSize(new THREE.Vector2());
  const hdrRT = new THREE.WebGLRenderTarget(dbSize.x, dbSize.y, {
    type: THREE.HalfFloatType,
    samples: 4,
  });
  const composer = new EffectComposer(renderer, hdrRT);
  composer.addPass(new RenderPass(scene, camera));
  // strength, radius, threshold — eşik yüksek ki sadece en parlak kenarlar parlasın
  const bloom = new UnrealBloomPass(new THREE.Vector2(W(), H()), 0.55, 0.5, 0.85);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // ── Metin grubu (Float için) ──
  const group = new THREE.Group();
  scene.add(group);

  const material = new THREE.MeshStandardMaterial({
    color: 0xe6eaf2,    // açık, beyaza yakın ön yüz
    metalness: 0.3,
    roughness: 0.45,
    emissive: 0x222733, // hafif öz-ışıma → her koşulda okunur kalsın
    emissiveIntensity: 0.4,
    envMapIntensity: 0.5,
  });

  new FontLoader().load('../assets/fonts/SpaceGrotesk_Bold.typeface.json', (font) => {
    const geo = new TextGeometry('Enes Baykal', {
      font,
      size: 1.1,             // küçültüldü → kenar harfler kadraja girer
      height: 0.32,          // gerçek hacim (ekstrüzyon)
      curveSegments: 24,     // daha pürüzsüz kavisler (kalite)
      bevelEnabled: true,
      bevelThickness: 0.03,  // ince pah → kenarda tek keskin ışık hattı
      bevelSize: 0.018,
      bevelOffset: 0,
      bevelSegments: 4,      // daha temiz pah
    });
    geo.center();
    const mesh = new THREE.Mesh(geo, material);
    group.add(mesh);
  });

  // ── Animasyon döngüsü ──
  const clock = new THREE.Clock();        // dt için (getDelta clock'u sıfırlar)
  const elapsedClock = new THREE.Clock(); // toplam süre için
  let rafId;

  (function loop() {
    if (!document.body.contains(renderer.domElement)) { cleanup(); return; }
    rafId = requestAnimationFrame(loop);
    const t = elapsedClock.getElapsedTime();
    const dt = Math.min(clock.getDelta(), 0.05);

    group.rotation.y = Math.sin(t * 0.5) * 0.12;
    group.rotation.x = Math.sin(t * 0.4) * 0.05;
    group.position.y = Math.sin(t * 0.8) * 0.08;

    // Yaklaş, sonra son ~2 sn'de yumuşakça biraz uzaklaş
    const targetZ = 6.8 + THREE.MathUtils.smoothstep(t, 4.2, 6.3) * 1.9;
    camera.position.z = THREE.MathUtils.damp(camera.position.z, targetZ, 1.1, dt);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, 0, 1.1, dt);
    // Açılışta hızlı orta→sağ→sol süpürme, sonra ortada sönümlenir
    camera.position.x = Math.sin(t * 2.4) * 2.6 * Math.exp(-t * 0.8);
    camera.lookAt(0, 0, 0);

    composer.render();
  })();

  // ── Resize ──
  function onResize() {
    camera.aspect = W() / H();
    camera.updateProjectionMatrix();
    renderer.setSize(W(), H());
    composer.setSize(W(), H());
  }
  window.addEventListener('resize', onResize);

  // ── Temizlik ──
  function cleanup() {
    window.removeEventListener('resize', onResize);
    scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
    composer.dispose?.();
    renderer.dispose();
  }
}
