struct HybridFrameParams {
  frame_index: u32,
  max_trace_steps: u32,
  history_weight: f32,
  exposure: f32,
  image_width: u32,
  image_height: u32,
  reflection_reset: u32,
  sky_mode: u32,
  sky_intensity: f32,
  max_reflection_distance: f32,
  roughness_bias: f32,
  thickness: f32,
};

struct HybridHit {
  radiance: vec3<f32>,
  hit_distance: f32,
};

struct HybridReflectionCamera {
  position: vec3<f32>,
  _padding0: f32,
};

struct HybridReflectionSurface {
  position: vec4<f32>,
  normal_roughness: vec4<f32>,
  albedo_metalness: vec4<f32>,
  emission_occlusion: vec4<f32>,
};

struct HybridGroundPlane {
  normal: vec3<f32>,
  height: f32,
  material_index: u32,
  enabled: u32,
  _padding0: vec2<u32>,
};

struct HybridReflectionSceneMetadata {
  sphere_count: u32,
  material_count: u32,
  _padding0: vec2<u32>,
  max_trace_distance: f32,
};

struct HybridReflectionMaterial {
  albedo_roughness: vec4<f32>,
  emission_metalness: vec4<f32>,
};

struct HybridReflectionSphere {
  center_radius: vec4<f32>,
  material_index: u32,
  flags: u32,
  _padding0: vec2<u32>,
};

struct HybridReflectionTrace {
  hit_mask: u32,
  distance: f32,
  position: vec3<f32>,
  material_index: u32,
  normal: vec3<f32>,
  _padding1: u32,
};

struct HybridReflectionPixel {
  reflection_confidence: vec4<f32>,
  hit_normal_distance: vec4<f32>,
};

struct HybridLightingPixel {
  radiance_confidence: vec4<f32>,
  normal_occlusion: vec4<f32>,
};

struct HybridScreenTracePixel {
  radiance_confidence: vec4<f32>,
  hit_normal_distance: vec4<f32>,
};

struct HybridRadianceCacheEntry {
  irradiance_validity: vec4<f32>,
  bent_normal_depth: vec4<f32>,
};

fn encode_history_weight(value: f32) -> f32 {
  return clamp(value, 0.0, 1.0);
}

fn hybrid_saturate(value: f32) -> f32 {
  return clamp(value, 0.0, 1.0);
}

fn hybrid_safe_normalize(value: vec3<f32>) -> vec3<f32> {
  if (dot(value, value) <= 0.000001) {
    return vec3<f32>(0.0, 1.0, 0.0);
  }

  return normalize(value);
}

fn hybrid_fresnel_schlick(cos_theta: f32, f0: vec3<f32>) -> vec3<f32> {
  let factor = pow(1.0 - hybrid_saturate(cos_theta), 5.0);
  return f0 + (vec3<f32>(1.0) - f0) * factor;
}

fn hybrid_surface_f0(albedo: vec3<f32>, metalness: f32) -> vec3<f32> {
  return vec3<f32>(0.04) * (1.0 - metalness) + albedo * metalness;
}

fn hybrid_luminance(color: vec3<f32>) -> f32 {
  return dot(color, vec3<f32>(0.2126, 0.7152, 0.0722));
}

fn hybrid_hash_u32(value: u32) -> u32 {
  var x = value + 0x9e3779b9u;
  x = (x ^ (x >> 16u)) * 0x85ebca6bu;
  x = (x ^ (x >> 13u)) * 0xc2b2ae35u;
  return x ^ (x >> 16u);
}

fn hybrid_random_f32(state: ptr<function, u32>) -> f32 {
  let next = hybrid_hash_u32((*state) ^ 0x7f4a7c15u);
  *state = next;
  return f32(next) * 2.3283064365386963e-10;
}

fn hybrid_sample_unit_sphere(state: ptr<function, u32>) -> vec3<f32> {
  let z = hybrid_random_f32(state) * 2.0 - 1.0;
  let angle = 6.283185307179586 * hybrid_random_f32(state);
  let radius = sqrt(max(1.0 - z * z, 0.0));
  return vec3<f32>(radius * cos(angle), radius * sin(angle), z);
}

fn hybrid_environment(direction: vec3<f32>, intensity: f32, mode: u32) -> vec3<f32> {
  let up_factor = hybrid_saturate(direction.y * 0.5 + 0.5);
  let horizon_color = vec3<f32>(0.54, 0.64, 0.77);
  let zenith_color = select(
    vec3<f32>(0.04, 0.09, 0.18),
    vec3<f32>(0.09, 0.07, 0.16),
    mode == 1u
  );
  let sun_direction = hybrid_safe_normalize(vec3<f32>(0.31, 0.92, 0.22));
  let sun_glow = pow(hybrid_saturate(dot(direction, sun_direction)), 192.0);
  let sunset_bias = select(vec3<f32>(0.0), vec3<f32>(0.55, 0.24, 0.08) * (1.0 - up_factor), mode == 1u);
  return (
    horizon_color * (1.0 - up_factor) +
    zenith_color * up_factor +
    sunset_bias +
    vec3<f32>(5.8, 5.5, 5.0) * sun_glow
  ) * max(intensity, 0.0001);
}
