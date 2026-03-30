export const OCEAN_VERT = `
uniform float uTime;
uniform float uWaveHeight;
uniform float uWaveFreq;
varying vec2 vUv;
varying float vElevation;

void main() {
  vec4 modelPosition = modelMatrix * vec4(position, 1.0);
  
  float elevation = sin(modelPosition.x * uWaveFreq + uTime) * 0.5 +
                    sin(modelPosition.z * uWaveFreq * 0.7 + uTime * 1.3) * 0.5;
  elevation *= uWaveHeight;
  
  modelPosition.y += elevation;
  
  vElevation = elevation / uWaveHeight;
  vUv = uv;
  
  gl_Position = projectionMatrix * viewMatrix * modelPosition;
}
`;

export const OCEAN_FRAG = `
uniform float uTime;
uniform vec3 uShallowColor;
uniform vec3 uDeepColor;
uniform vec3 uFoamColor;
varying vec2 vUv;
varying float vElevation;

void main() {
  float mixStrength = (vElevation + 1.0) * 0.5 * vUv.y;
  vec3 color = mix(uDeepColor, uShallowColor, mixStrength);
  
  float foam = smoothstep(0.55, 0.75, vElevation);
  color = mix(color, uFoamColor, foam * 0.6);
  
  float edge = smoothstep(0.0, 0.15, vUv.x) * smoothstep(1.0, 0.85, vUv.x);
  color += uFoamColor * (1.0 - edge) * 0.15;
  
  gl_FragColor = vec4(color, 0.92);
}
`;
