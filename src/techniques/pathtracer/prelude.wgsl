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
    material.emission_metalness.xyz,
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

fn environment_radiance(
  direction: vec3<f32>,
  intensity: f32,
  mode: u32
) -> vec3<f32> {
  let up_factor = saturate(direction.y * 0.5 + 0.5);
  let horizon_color = vec3<f32>(0.65, 0.74, 0.86);
  let zenith_color = select(
    vec3<f32>(0.05, 0.12, 0.24),
    vec3<f32>(0.11, 0.08, 0.18),
    mode == 1u
  );
  let sunset_color = vec3<f32>(1.1, 0.64, 0.32);
  let sun_direction = safe_normalize(vec3<f32>(0.35, 0.92, 0.18));
  let moon_direction = safe_normalize(vec3<f32>(-0.2, 0.98, -0.1));
  let sun_glow = pow(saturate(dot(direction, sun_direction)), 256.0);
  let moon_glow = pow(saturate(dot(direction, moon_direction)), 512.0);
  var sky = horizon_color * (1.0 - up_factor) + zenith_color * up_factor;
  if (mode == 1u) {
    sky = sky * (1.0 - up_factor * 0.4) + sunset_color * sun_glow * 0.25;
  }
  return (
    sky +
    vec3<f32>(8.0, 7.6, 6.8) * sun_glow +
    vec3<f32>(0.7, 0.76, 0.9) * moon_glow * 0.3
  ) * max(intensity, 0.0001);
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
