const LIGHTING_WAVEFRONT_SCHEMA_VERSION: u32 = 1u;
const LIGHTING_WAVEFRONT_QUEUE_PAIR_STRATEGY: u32 = 1u;

const HIT_TYPE_SURFACE: u32 = 0u;
const HIT_TYPE_EMISSIVE: u32 = 1u;
const HIT_TYPE_ENVIRONMENT: u32 = 2u;
const HIT_TYPE_TRANSPARENT: u32 = 3u;
const HIT_TYPE_MISS: u32 = 4u;

const EVENT_KIND_DIFFUSE: u32 = 0u;
const EVENT_KIND_REFLECTION: u32 = 1u;
const EVENT_KIND_REFRACTION: u32 = 2u;
const EVENT_KIND_TRANSPARENCY: u32 = 3u;
const EVENT_KIND_TERMINATE: u32 = 4u;

const RAY_KIND_PATH: u32 = 0u;
const RAY_KIND_VISIBILITY_PROBE: u32 = 1u;
const RAY_KIND_MASK: u32 = 0x3u;

const LIGHTING_EPSILON: f32 = 0.0001;
const LIGHTING_INV_PI: f32 = 0.3183098861837907;

struct WavefrontLightingParams {
  active_count: u32,
  next_queue_capacity: u32,
  bounce_index: u32,
  max_depth: u32,
  enable_explicit_light_sampling: u32,
  accumulation_reset_epoch: u32,
  environment_mode: u32,
  environment_intensity: f32,
  sunlit_baseline: f32,
  _padding0: vec3<f32>,
  environment_color: vec4<f32>,
  ambient_color: vec4<f32>,
  environment_miss_radiance: vec4<f32>,
};

struct RayRecord {
  rayId: u32,
  parentRayId: u32,
  sourcePixelId: u32,
  sampleId: u32,
  bounce: u32,
  origin: vec3<f32>,
  _padding0: f32,
  direction: vec3<f32>,
  _padding1: f32,
  throughput: vec3<f32>,
  mediumRefId: u32,
  flags: u32,
};

struct HitRecord {
  rayId: u32,
  sourcePixelId: u32,
  hitType: u32,
  _padding0: u32,
  distance: f32,
  entityId: u32,
  instanceId: u32,
  primitiveId: u32,
  materialId: u32,
  _padding1: vec3<u32>,
  barycentrics: vec3<f32>,
  _padding2: f32,
  uv: vec2<f32>,
  _padding3: vec2<f32>,
  geometricNormal: vec3<f32>,
  _padding4: f32,
  shadingNormal: vec3<f32>,
  frontFace: u32,
};

struct SurfaceRecord {
  rayId: u32,
  entityId: u32,
  materialRefId: u32,
  mediumRefId: u32,
  geometricNormal: vec3<f32>,
  _padding0: f32,
  shadingNormal: vec3<f32>,
  _padding1: f32,
  uv: vec2<f32>,
  _padding2: vec2<f32>,
  tangentFrame0: vec3<f32>,
  _padding3: f32,
  tangentFrame1: vec3<f32>,
  _padding4: f32,
  tangentFrame2: vec3<f32>,
  _padding5: f32,
};

struct MaterialReferenceRecord {
  materialRefId: u32,
  materialId: u32,
  shadingModel: u32,
  textureSetId: u32,
  flags: u32,
  _padding0: vec3<u32>,
};

struct MediumReferenceRecord {
  mediumRefId: u32,
  mediumId: u32,
  phaseModel: u32,
  _padding0: u32,
  absorption: vec3<f32>,
  _padding1: f32,
  scattering: vec3<f32>,
  _padding2: f32,
};

struct AccumulationRecord {
  sourcePixelId: u32,
  sampleCount: u32,
  resetEpoch: u32,
  _padding0: u32,
  radiance: vec3<f32>,
  _padding1: f32,
  throughput: vec3<f32>,
  _padding2: f32,
};

fn luminance(value: vec3<f32>) -> f32 {
  return dot(value, vec3<f32>(0.2126, 0.7152, 0.0722));
}

fn saturate_scalar(value: f32) -> f32 {
  return clamp(value, 0.0, 1.0);
}

fn saturate_vec3(value: vec3<f32>) -> vec3<f32> {
  return max(value, vec3<f32>(0.0));
}

fn safe_normalize(value: vec3<f32>) -> vec3<f32> {
  if (dot(value, value) <= LIGHTING_EPSILON) {
    return vec3<f32>(0.0, 1.0, 0.0);
  }
  return normalize(value);
}

fn faceforward_normal(normal: vec3<f32>, direction: vec3<f32>) -> vec3<f32> {
  return select(normal, -normal, dot(normal, direction) > 0.0);
}

fn is_terminal_hit_type(hit_type: u32) -> bool {
  return hit_type == HIT_TYPE_EMISSIVE ||
    hit_type == HIT_TYPE_ENVIRONMENT ||
    hit_type == HIT_TYPE_MISS;
}

fn ray_kind(flags: u32) -> u32 {
  return flags & RAY_KIND_MASK;
}

fn environment_radiance(direction: vec3<f32>) -> vec3<f32> {
  let upward = saturate_scalar(direction.y * 0.5 + 0.5);
  let directional = mix(
    wavefrontLightingParams.environment_color.xyz * 0.45,
    wavefrontLightingParams.environment_color.xyz,
    upward
  );
  let ambient = wavefrontLightingParams.ambient_color.xyz * 0.18;
  let miss = wavefrontLightingParams.environment_miss_radiance.xyz;
  return saturate_vec3(max(directional + ambient, miss));
}

fn terminal_radiance_for_hit(
  hit: HitRecord,
  ray: RayRecord,
  emissive_radiance: vec3<f32>
) -> vec3<f32> {
  if (hit.hitType == HIT_TYPE_EMISSIVE) {
    return ray.throughput * saturate_vec3(emissive_radiance);
  }
  if (hit.hitType == HIT_TYPE_ENVIRONMENT) {
    return ray.throughput * environment_radiance(ray.direction);
  }
  if (hit.hitType == HIT_TYPE_MISS) {
    let miss_radiance = max(
      environment_radiance(ray.direction),
      wavefrontLightingParams.environment_miss_radiance.xyz
    );
    return ray.throughput * saturate_vec3(miss_radiance);
  }
  return vec3<f32>(0.0);
}

fn reflect_direction(direction: vec3<f32>, normal: vec3<f32>) -> vec3<f32> {
  return safe_normalize(reflect(direction, normal));
}

fn refract_direction(direction: vec3<f32>, normal: vec3<f32>, eta_ratio: f32) -> vec3<f32> {
  let refracted = refract(direction, normal, eta_ratio);
  if (dot(refracted, refracted) <= LIGHTING_EPSILON) {
    return reflect_direction(direction, normal);
  }
  return safe_normalize(refracted);
}

fn choose_continuation_event_kind(hit: HitRecord, material: MaterialReferenceRecord) -> u32 {
  if (hit.hitType == HIT_TYPE_TRANSPARENT || (material.flags & 0x4u) != 0u) {
    return EVENT_KIND_TRANSPARENCY;
  }
  if ((material.flags & 0x8u) != 0u) {
    return EVENT_KIND_REFRACTION;
  }
  if ((material.flags & 0x2u) != 0u) {
    return EVENT_KIND_REFLECTION;
  }
  return EVENT_KIND_DIFFUSE;
}

fn material_base_albedo(material: MaterialReferenceRecord) -> vec3<f32> {
  let tint = vec3<f32>(
    f32((material.materialId & 0xffu)) / 255.0,
    f32((material.textureSetId & 0xffu)) / 255.0,
    f32(((material.materialId ^ material.textureSetId) & 0xffu)) / 255.0
  );
  return max(tint, vec3<f32>(0.12, 0.12, 0.12));
}

fn continuation_attenuation(event_kind: u32, material: MaterialReferenceRecord) -> vec3<f32> {
  let base_albedo = material_base_albedo(material);
  if (event_kind == EVENT_KIND_REFLECTION) {
    return mix(vec3<f32>(0.04), base_albedo, 0.7);
  }
  if (event_kind == EVENT_KIND_REFRACTION) {
    return vec3<f32>(0.92, 0.94, 0.98);
  }
  if (event_kind == EVENT_KIND_TRANSPARENCY) {
    return vec3<f32>(0.75, 0.82, 0.9);
  }
  return base_albedo * LIGHTING_INV_PI;
}
