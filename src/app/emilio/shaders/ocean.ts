export const OCEAN_VERT = `
uniform float uTime;
uniform float uWaveHeight;
uniform float uWaveFreq;
uniform vec2 uSunPos;
varying vec2 vUv;
varying float vElevation;
varying vec3 vWorldPos;
varying vec3 vNormal;

void main() {
  vec4 modelPosition = modelMatrix * vec4(position, 1.0);
  
  // Layer 1: primary swell
  float wave1 = sin(modelPosition.x * uWaveFreq + uTime) * 0.5;
  float wave2 = sin(modelPosition.z * uWaveFreq * 0.7 + uTime * 1.3) * 0.35;
  
  // Layer 2: secondary chop
  float wave3 = sin(modelPosition.x * uWaveFreq * 2.1 + uTime * 1.7) * 0.15;
  float wave4 = sin(modelPosition.z * uWaveFreq * 1.8 + uTime * 2.1) * 0.12;
  
  // Layer 3: micro detail
  float wave5 = sin(modelPosition.x * uWaveFreq * 4.0 + uTime * 3.0) * 0.05;
  float wave6 = sin(modelPosition.z * uWaveFreq * 3.5 + uTime * 2.5) * 0.04;
  
  float elevation = (wave1 + wave2 + wave3 + wave4 + wave5 + wave6) * uWaveHeight;
  modelPosition.y += elevation;
  
  // Calculate normal for lighting
  float dx = cos(modelPosition.x * uWaveFreq + uTime) * uWaveHeight * 0.5 * uWaveFreq +
             cos(modelPosition.x * uWaveFreq * 2.1 + uTime * 1.7) * uWaveHeight * 0.15 * uWaveFreq * 2.1 +
             cos(modelPosition.x * uWaveFreq * 4.0 + uTime * 3.0) * uWaveHeight * 0.05 * uWaveFreq * 4.0;
  float dz = cos(modelPosition.z * uWaveFreq * 0.7 + uTime * 1.3) * uWaveHeight * 0.35 * uWaveFreq * 0.7 +
             cos(modelPosition.z * uWaveFreq * 1.8 + uTime * 2.1) * uWaveHeight * 0.12 * uWaveFreq * 1.8 +
             cos(modelPosition.z * uWaveFreq * 3.5 + uTime * 2.5) * uWaveHeight * 0.04 * uWaveFreq * 3.5;
  
  vNormal = normalize(vec3(-dx, 1.0, -dz));
  vElevation = elevation / uWaveHeight;
  vWorldPos = modelPosition.xyz;
  vUv = uv;
  
  gl_Position = projectionMatrix * viewMatrix * modelPosition;
}
`;

export const OCEAN_FRAG = `
uniform float uTime;
uniform float uWaveHeight;
uniform vec2 uSunPos;
varying vec2 vUv;
varying float vElevation;
varying vec3 vWorldPos;
varying vec3 vNormal;

void main() {
  // Color gradient based on depth and wave height
  vec3 deepColor = vec3(0.039, 0.086, 0.157);      // #0a1628
  vec3 midColor = vec3(0.102, 0.290, 0.420);       // #1a4a6b
  vec3 surfColor = vec3(0.290, 0.608, 0.745);      // #4a9bbe
  vec3 foamColor = vec3(0.910, 0.957, 0.973);      // #e8f4f8
  
  // Mix based on elevation and UV
  float heightFactor = (vElevation + 1.0) * 0.5;
  vec3 waterColor = mix(deepColor, midColor, heightFactor * 0.6);
  waterColor = mix(waterColor, surfColor, heightFactor * heightFactor * 0.8);
  
  // Foam on crests
  float foamThreshold = 0.55;
  float foamIntensity = smoothstep(foamThreshold, 0.75, vElevation);
  float foamNoise = sin(vWorldPos.x * 8.0 + uTime) * sin(vWorldPos.z * 6.0 + uTime * 0.7);
  foamNoise = foamNoise * 0.5 + 0.5;
  foamIntensity *= foamNoise;
  waterColor = mix(waterColor, foamColor, foamIntensity * 0.7);
  
  // Fake sun reflection
  vec3 sunDir = normalize(vec3(uSunPos.x, uSunPos.y, 0.5));
  vec3 viewDir = normalize(-vWorldPos);
  vec3 halfDir = normalize(sunDir + viewDir);
  float NdotH = max(dot(vNormal, halfDir), 0.0);
  float specular = pow(NdotH, 64.0) * 0.4;
  
  // Fresnel effect for edge brightness
  float fresnel = pow(1.0 - max(dot(vNormal, viewDir), 0.0), 3.0);
  waterColor += foamColor * fresnel * 0.15;
  waterColor += vec3(1.0) * specular * (1.0 - foamIntensity * 0.5);
  
  // Distance fog
  float dist = length(vWorldPos);
  float fogFactor = smoothstep(6.0, 18.0, dist);
  vec3 fogColor = vec3(0.067, 0.035, 0.098);
  waterColor = mix(waterColor, fogColor, fogFactor * 0.4);
  
  gl_FragColor = vec4(waterColor, 0.92);
}
`;
