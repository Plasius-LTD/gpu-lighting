const PATH_TRACER_PI: f32 = 3.141592653589793;
const PATH_TRACER_INV_PI: f32 = 0.3183098861837907;
const PATH_TRACER_EPSILON: f32 = 0.0005;

struct PathTracerParams {
  frame_index: u32,
  max_bounces: u32,
  samples_per_pixel: u32,
  enable_next_event_estimation: u32,
  image_width: u32,
  image_height: u32,
  accumulation_reset: u32,
  environment_mode: u32,
  environment_intensity: f32,
  exposure: f32,
  history_blend: f32,
  denoise_strength: f32,
};

struct PathSample {
  radiance: vec3<f32>,
  throughput: vec3<f32>,
};

struct PathTracerCamera {
  origin: vec3<f32>,
  aspect_ratio: f32,
  forward: vec3<f32>,
  vertical_fov_radians: f32,
  right: vec3<f32>,
  focus_distance: f32,
  up: vec3<f32>,
  aperture_radius: f32,
};

struct PathTracerSceneMetadata {
  sphere_count: u32,
  triangle_count: u32,
  material_count: u32,
  max_trace_distance: f32,
};

struct PathTracerGroundPlane {
  normal: vec3<f32>,
  height: f32,
  material_index: u32,
  enabled: u32,
  _padding0: vec2<u32>,
};

struct PathTracerMaterial {
  albedo_roughness: vec4<f32>,
  emission_metalness: vec4<f32>,
  transmittance_ior: vec4<f32>,
};

struct PathTracerSphere {
  center_radius: vec4<f32>,
  material_index: u32,
  flags: u32,
  _padding0: vec2<u32>,
};

struct PathTracerTriangle {
  position0: vec4<f32>,
  position1: vec4<f32>,
  position2: vec4<f32>,
  normal0: vec4<f32>,
  normal1: vec4<f32>,
  normal2: vec4<f32>,
  material_index: u32,
  flags: u32,
  _padding0: vec2<u32>,
};

struct Ray {
  origin: vec3<f32>,
  t_min: f32,
  direction: vec3<f32>,
  t_max: f32,
};

struct PathHit {
  hit: u32,
  distance: f32,
  position: vec3<f32>,
  material_index: u32,
  normal: vec3<f32>,
  primitive_kind: u32,
  barycentric: vec3<f32>,
  _padding1: u32,
};

struct MaterialSample {
  albedo: vec3<f32>,
  roughness: f32,
  emission: vec3<f32>,
  metalness: f32,
  transmittance: vec3<f32>,
  refractive_index: f32,
};

struct PathScatter {
  direction: vec3<f32>,
  pdf: f32,
  attenuation: vec3<f32>,
  event_kind: f32,
};

struct PathState {
  throughput_bounce: vec4<f32>,
  origin_active: vec4<f32>,
  direction_pdf: vec4<f32>,
  random_state: u32,
  last_hit_kind: u32,
  _padding0: vec2<u32>,
};

struct PathSamplePixel {
  radiance_opacity: vec4<f32>,
  direction_distance: vec4<f32>,
  normal_roughness: vec4<f32>,
  albedo_sample_count: vec4<f32>,
};

struct PathAccumulationPixel {
  integrated_radiance: vec4<f32>,
  moments: vec4<f32>,
};

struct PathDenoisePixel {
  filtered_radiance: vec4<f32>,
  normal_depth: vec4<f32>,
  albedo_history: vec4<f32>,
};

fn luminance(value: vec3<f32>) -> f32 {
  return dot(value, vec3<f32>(0.2126, 0.7152, 0.0722));
}

fn saturate(value: f32) -> f32 {
  return clamp(value, 0.0, 1.0);
}

fn sanitize_radiance(value: vec3<f32>) -> vec3<f32> {
  return max(value, vec3<f32>(0.0));
}

fn ensure_non_null_radiance(value: vec3<f32>) -> vec3<f32> {
  let radiance = sanitize_radiance(value);
  if (luminance(radiance) <= 0.000001) {
    return vec3<f32>(0.0001);
  }

  return radiance;
}

fn safe_rcp(value: f32) -> f32 {
  if (abs(value) <= PATH_TRACER_EPSILON) {
    return 0.0;
  }

  return 1.0 / value;
}

fn safe_normalize(value: vec3<f32>) -> vec3<f32> {
  if (dot(value, value) <= PATH_TRACER_EPSILON) {
    return vec3<f32>(0.0, 1.0, 0.0);
  }

  return normalize(value);
}

fn make_default_material() -> PathTracerMaterial {
  return PathTracerMaterial(
    vec4<f32>(0.72, 0.74, 0.76, 0.5),
    vec4<f32>(0.0, 0.0, 0.0, 0.0),
    vec4<f32>(0.0, 0.0, 0.0, 1.45)
  );
}

fn unpack_material(material: PathTracerMaterial) -> MaterialSample {
  return MaterialSample(
    material.albedo_roughness.xyz,
    clamp(material.albedo_roughness.w, 0.02, 1.0),
    sanitize_radiance(material.emission_metalness.xyz),
    saturate(material.emission_metalness.w),
    material.transmittance_ior.xyz,
    max(material.transmittance_ior.w, 1.0)
  );
}

fn hash_u32(value: u32) -> u32 {
  var x = value + 0x9e3779b9u;
  x = (x ^ (x >> 16u)) * 0x85ebca6bu;
  x = (x ^ (x >> 13u)) * 0xc2b2ae35u;
  return x ^ (x >> 16u);
}

fn random_f32(state: ptr<function, u32>) -> f32 {
  let next = hash_u32((*state) ^ 0x68bc21ebu);
  *state = next;
  return f32(next) * 2.3283064365386963e-10;
}

fn sample_unit_disk(state: ptr<function, u32>) -> vec2<f32> {
  let radius = sqrt(random_f32(state));
  let angle = 2.0 * PATH_TRACER_PI * random_f32(state);
  return vec2<f32>(cos(angle), sin(angle)) * radius;
}

fn sample_unit_sphere(state: ptr<function, u32>) -> vec3<f32> {
  let z = random_f32(state) * 2.0 - 1.0;
  let angle = 2.0 * PATH_TRACER_PI * random_f32(state);
  let radius = sqrt(max(1.0 - z * z, 0.0));
  return vec3<f32>(radius * cos(angle), radius * sin(angle), z);
}

fn build_tangent(normal: vec3<f32>) -> vec3<f32> {
  let basis = select(
    vec3<f32>(0.0, 1.0, 0.0),
    vec3<f32>(1.0, 0.0, 0.0),
    abs(normal.y) > 0.999
  );
  return safe_normalize(cross(basis, normal));
}

fn build_bitangent(normal: vec3<f32>, tangent: vec3<f32>) -> vec3<f32> {
  return safe_normalize(cross(normal, tangent));
}

fn sample_cosine_hemisphere(normal: vec3<f32>, state: ptr<function, u32>) -> vec3<f32> {
  let disk = sample_unit_disk(state);
  let z = sqrt(max(1.0 - dot(disk, disk), 0.0));
  let tangent = build_tangent(normal);
  let bitangent = build_bitangent(normal, tangent);
  return safe_normalize(tangent * disk.x + bitangent * disk.y + normal * z);
}

fn fresnel_schlick(cos_theta: f32, f0: vec3<f32>) -> vec3<f32> {
  let factor = pow(1.0 - saturate(cos_theta), 5.0);
  return f0 + (vec3<f32>(1.0) - f0) * factor;
}

fn environment_horizon_color(mode: u32) -> vec3<f32> {
  var color = vec3<f32>(0.65, 0.74, 0.86);
  if (mode == 0u) { color = vec3<f32>(0.33, 0.43, 0.53); }
  if (mode == 1u) { color = vec3<f32>(0.52, 0.61, 0.65); }
  if (mode == 2u) { color = vec3<f32>(0.48, 0.53, 0.55); }
  if (mode == 3u) { color = vec3<f32>(0.92, 0.54, 0.32); }
  if (mode == 4u) { color = vec3<f32>(0.58, 0.78, 0.96); }
  if (mode == 5u) { color = vec3<f32>(1.08, 0.42, 0.24); }
  if (mode == 6u) { color = vec3<f32>(0.08, 0.13, 0.2); }
  if (mode == 7u) { color = vec3<f32>(0.72, 0.48, 0.28); }
  if (mode == 8u) { color = vec3<f32>(0.38, 0.62, 0.42); }
  if (mode == 9u) { color = vec3<f32>(0.72, 0.28, 0.2); }
  if (mode == 10u) { color = vec3<f32>(0.035, 0.08, 0.1); }
  if (mode == 11u) { color = vec3<f32>(0.58, 0.44, 0.34); }
  if (mode == 12u) { color = vec3<f32>(0.64, 0.7, 0.74); }
  if (mode == 13u) { color = vec3<f32>(0.7, 0.32, 0.24); }
  if (mode == 14u) { color = vec3<f32>(0.06, 0.08, 0.12); }
  if (mode == 15u) { color = vec3<f32>(0.5, 0.3, 0.2); }
  if (mode == 16u) { color = vec3<f32>(0.6, 0.56, 0.48); }
  if (mode == 17u) { color = vec3<f32>(0.46, 0.18, 0.14); }
  if (mode == 18u) { color = vec3<f32>(0.025, 0.035, 0.06); }
  return ensure_non_null_radiance(color);
}

fn environment_zenith_color(mode: u32) -> vec3<f32> {
  var color = vec3<f32>(0.05, 0.12, 0.24);
  if (mode == 0u) { color = vec3<f32>(0.035, 0.07, 0.14); }
  if (mode == 1u) { color = vec3<f32>(0.18, 0.22, 0.26); }
  if (mode == 2u) { color = vec3<f32>(0.24, 0.26, 0.29); }
  if (mode == 3u) { color = vec3<f32>(0.16, 0.28, 0.5); }
  if (mode == 4u) { color = vec3<f32>(0.1, 0.34, 0.82); }
  if (mode == 5u) { color = vec3<f32>(0.09, 0.1, 0.32); }
  if (mode == 6u) { color = vec3<f32>(0.018, 0.035, 0.09); }
  if (mode == 7u) { color = vec3<f32>(0.08, 0.18, 0.18); }
  if (mode == 8u) { color = vec3<f32>(0.08, 0.28, 0.32); }
  if (mode == 9u) { color = vec3<f32>(0.04, 0.07, 0.18); }
  if (mode == 10u) { color = vec3<f32>(0.012, 0.025, 0.06); }
  if (mode == 11u) { color = vec3<f32>(0.16, 0.19, 0.24); }
  if (mode == 12u) { color = vec3<f32>(0.28, 0.34, 0.42); }
  if (mode == 13u) { color = vec3<f32>(0.08, 0.1, 0.18); }
  if (mode == 14u) { color = vec3<f32>(0.02, 0.03, 0.055); }
  if (mode == 15u) { color = vec3<f32>(0.04, 0.07, 0.09); }
  if (mode == 16u) { color = vec3<f32>(0.08, 0.12, 0.14); }
  if (mode == 17u) { color = vec3<f32>(0.035, 0.045, 0.08); }
  if (mode == 18u) { color = vec3<f32>(0.008, 0.014, 0.03); }
  return ensure_non_null_radiance(color);
}

fn environment_key_direction(mode: u32) -> vec3<f32> {
  var direction = vec3<f32>(0.35, 0.92, 0.18);
  if (mode == 0u) { direction = vec3<f32>(0.22, 0.88, 0.42); }
  if (mode == 1u) { direction = vec3<f32>(0.18, 0.93, 0.24); }
  if (mode == 2u) { direction = vec3<f32>(-0.24, 0.86, 0.36); }
  if (mode == 3u) { direction = vec3<f32>(0.64, 0.32, 0.18); }
  if (mode == 4u) { direction = vec3<f32>(0.18, 0.98, 0.08); }
  if (mode == 5u) { direction = vec3<f32>(-0.76, 0.24, 0.22); }
  if (mode == 6u) { direction = vec3<f32>(-0.22, 0.86, -0.34); }
  if (mode == 7u) { direction = vec3<f32>(0.58, 0.42, -0.24); }
  if (mode == 8u) { direction = vec3<f32>(0.08, 0.96, -0.18); }
  if (mode == 9u) { direction = vec3<f32>(-0.7, 0.18, -0.18); }
  if (mode == 10u) { direction = vec3<f32>(0.2, 0.82, -0.46); }
  if (mode == 11u) { direction = vec3<f32>(0.82, 0.28, 0.18); }
  if (mode == 12u) { direction = vec3<f32>(0.35, 0.86, 0.16); }
  if (mode == 13u) { direction = vec3<f32>(-0.78, 0.18, 0.16); }
  if (mode == 14u) { direction = vec3<f32>(0.1, 0.94, -0.12); }
  if (mode == 15u) { direction = vec3<f32>(0.72, 0.32, 0.26); }
  if (mode == 16u) { direction = vec3<f32>(0.36, 0.82, 0.14); }
  if (mode == 17u) { direction = vec3<f32>(0.32, 0.34, -0.54); }
  if (mode == 18u) { direction = vec3<f32>(0.18, 0.28, -0.68); }
  return safe_normalize(direction);
}

fn environment_fill_direction(mode: u32) -> vec3<f32> {
  var direction = vec3<f32>(0.0, 1.0, 0.0);
  if (mode == 3u || mode == 4u || mode == 5u) { direction = vec3<f32>(0.0, 0.35, 0.1); }
  if (mode == 6u) { direction = vec3<f32>(0.0, 1.0, 0.0); }
  if (mode >= 7u && mode <= 10u) { direction = vec3<f32>(0.18, 0.75, 0.2); }
  if (mode >= 11u && mode <= 14u) { direction = vec3<f32>(0.0, 0.95, -0.08); }
  if (mode >= 15u && mode <= 18u) { direction = vec3<f32>(-0.25, 0.22, 0.7); }
  return safe_normalize(direction);
}

fn environment_key_color(mode: u32) -> vec3<f32> {
  var color = vec3<f32>(8.0, 7.6, 6.8);
  if (mode == 0u) { color = vec3<f32>(0.7, 0.76, 0.9) * 2.2; }
  if (mode == 1u) { color = vec3<f32>(1.0, 0.94, 0.82) * 4.1; }
  if (mode == 2u) { color = vec3<f32>(0.96, 0.97, 1.0) * 2.5; }
  if (mode == 3u) { color = vec3<f32>(1.0, 0.58, 0.28) * 5.6; }
  if (mode == 4u) { color = vec3<f32>(1.0, 0.96, 0.86) * 9.8; }
  if (mode == 5u) { color = vec3<f32>(1.0, 0.34, 0.16) * 4.8; }
  if (mode == 6u) { color = vec3<f32>(0.52, 0.62, 1.0) * 1.25; }
  if (mode == 7u) { color = vec3<f32>(1.0, 0.62, 0.32) * 4.4; }
  if (mode == 8u) { color = vec3<f32>(1.0, 0.96, 0.74) * 7.2; }
  if (mode == 9u) { color = vec3<f32>(1.0, 0.34, 0.2) * 2.2; }
  if (mode == 10u) { color = vec3<f32>(0.42, 0.56, 1.0) * 0.95; }
  if (mode == 11u) { color = vec3<f32>(1.0, 0.62, 0.34) * 2.8; }
  if (mode == 12u) { color = vec3<f32>(0.92, 0.96, 1.0) * 4.2; }
  if (mode == 13u) { color = vec3<f32>(1.0, 0.42, 0.2) * 2.4; }
  if (mode == 14u) { color = vec3<f32>(0.68, 0.88, 1.0) * 2.25; }
  if (mode == 15u) { color = vec3<f32>(1.0, 0.58, 0.3) * 2.1; }
  if (mode == 16u) { color = vec3<f32>(1.0, 0.9, 0.66) * 3.4; }
  if (mode == 17u) { color = vec3<f32>(1.0, 0.38, 0.12) * 1.85; }
  if (mode == 18u) { color = vec3<f32>(1.0, 0.36, 0.12) * 1.9; }
  return ensure_non_null_radiance(color);
}

fn environment_fill_color(mode: u32) -> vec3<f32> {
  var color = vec3<f32>(0.3, 0.4, 0.6);
  if (mode == 0u) { color = vec3<f32>(0.22, 0.31, 0.48) * 0.35; }
  if (mode == 1u) { color = vec3<f32>(0.75, 0.84, 1.0) * 1.3; }
  if (mode == 2u) { color = vec3<f32>(0.55, 0.58, 0.62) * 0.8; }
  if (mode == 3u) { color = vec3<f32>(0.22, 0.44, 0.12) * 0.45; }
  if (mode == 4u) { color = vec3<f32>(0.28, 0.56, 0.16) * 0.65; }
  if (mode == 5u) { color = vec3<f32>(0.12, 0.28, 0.11) * 0.35; }
  if (mode == 6u) { color = vec3<f32>(0.32, 0.38, 0.6) * 0.24; }
  if (mode == 7u) { color = vec3<f32>(0.34, 0.68, 0.24) * 0.86; }
  if (mode == 8u) { color = vec3<f32>(0.24, 0.72, 0.28) * 1.35; }
  if (mode == 9u) { color = vec3<f32>(0.18, 0.38, 0.2) * 0.52; }
  if (mode == 10u) { color = vec3<f32>(0.08, 0.18, 0.12) * 0.28; }
  if (mode == 11u) { color = vec3<f32>(0.78, 0.9, 1.0) * 1.1; }
  if (mode == 12u) { color = vec3<f32>(0.78, 0.92, 1.0) * 1.6; }
  if (mode == 13u) { color = vec3<f32>(0.72, 0.88, 1.0) * 1.35; }
  if (mode == 14u) { color = vec3<f32>(1.0, 0.05, 0.025) * 0.4; }
  if (mode == 15u) { color = vec3<f32>(1.0, 0.42, 0.16) * 1.35; }
  if (mode == 16u) { color = vec3<f32>(0.1, 0.82, 0.64) * 0.46; }
  if (mode == 17u) { color = vec3<f32>(0.08, 0.58, 0.72) * 0.34; }
  if (mode == 18u) { color = vec3<f32>(0.06, 0.62, 0.76) * 0.52; }
  return ensure_non_null_radiance(color);
}

fn environment_horizon_glow(mode: u32) -> vec3<f32> {
  var color = environment_horizon_color(mode) * 0.2;
  if (mode == 5u || mode == 9u || mode == 13u || mode == 17u) {
    color = color + vec3<f32>(0.8, 0.22, 0.12);
  }
  if (mode == 14u || mode == 18u) {
    color = color + vec3<f32>(0.08, 0.12, 0.22);
  }
  return ensure_non_null_radiance(color);
}

fn environment_key_focus(mode: u32) -> f32 {
  var focus = 192.0;
  if (mode == 1u || mode == 2u || (mode >= 11u && mode <= 14u)) {
    focus = 48.0;
  }
  if (mode >= 15u && mode <= 18u) {
    focus = 28.0;
  }
  if (mode == 6u || mode == 10u) {
    focus = 384.0;
  }
  return focus;
}

fn environment_radiance(
  direction: vec3<f32>,
  intensity: f32,
  mode: u32
) -> vec3<f32> {
  let up_factor = saturate(direction.y * 0.5 + 0.5);
  let horizon_color = environment_horizon_color(mode);
  let zenith_color = environment_zenith_color(mode);
  let key_direction = safe_normalize(environment_key_direction(mode));
  let fill_direction = safe_normalize(environment_fill_direction(mode));
  let key_glow = pow(saturate(dot(direction, key_direction)), environment_key_focus(mode));
  let fill_glow = pow(saturate(dot(direction, fill_direction)), 32.0);
  let horizon_band = pow(1.0 - abs(direction.y), 2.0);
  let sky = horizon_color * (1.0 - up_factor) + zenith_color * up_factor;
  let inferred_source =
    environment_key_color(mode) * key_glow +
    environment_fill_color(mode) * fill_glow * 0.35 +
    environment_horizon_glow(mode) * horizon_band;
  return ensure_non_null_radiance(
    (sky + inferred_source) * max(intensity, 0.0001)
  );
}

fn miss_hit(ray: Ray) -> PathHit {
  return PathHit(
    0u,
    ray.t_max,
    ray.origin + ray.direction * ray.t_max,
    0u,
    vec3<f32>(0.0, 1.0, 0.0),
    0u,
    vec3<f32>(0.0),
    0u
  );
}

fn faceforward_normal(normal: vec3<f32>, direction: vec3<f32>) -> vec3<f32> {
  return select(normal, -normal, dot(normal, direction) > 0.0);
}
