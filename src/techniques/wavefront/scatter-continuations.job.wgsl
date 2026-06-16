@group(0) @binding(0) var<uniform> wavefrontLightingParams: WavefrontLightingParams;
@group(0) @binding(1) var<storage, read> activeQueue: array<RayRecord>;
@group(0) @binding(2) var<storage, read> hitBuffer: array<HitRecord>;
@group(0) @binding(3) var<storage, read> surfaceBuffer: array<SurfaceRecord>;
@group(0) @binding(4) var<storage, read> materialRefBuffer: array<MaterialReferenceRecord>;
@group(0) @binding(5) var<storage, read> mediumRefBuffer: array<MediumReferenceRecord>;
@group(0) @binding(6) var<storage, read_write> nextQueue: array<RayRecord>;
@group(0) @binding(7) var<storage, read_write> nextQueueCounter: atomic<u32>;

fn queue_continuation_ray(
  ray: RayRecord,
  hit: HitRecord,
  surface: SurfaceRecord,
  direction: vec3<f32>,
  attenuation: vec3<f32>
) {
  let slot = atomicAdd(&nextQueueCounter, 1u);
  if (slot >= wavefrontLightingParams.next_queue_capacity) {
    return;
  }

  let offset_origin =
    ray.origin +
    ray.direction * hit.distance +
    faceforward_normal(surface.geometricNormal, ray.direction) * 0.001;
  nextQueue[slot] = RayRecord(
    ray.rayId ^ ((wavefrontLightingParams.bounce_index + 1u) * 0x9e3779b9u),
    ray.rayId,
    ray.sourcePixelId,
    ray.sampleId,
    wavefrontLightingParams.bounce_index + 1u,
    offset_origin,
    0.0,
    direction,
    0.0,
    ray.throughput * attenuation,
    surface.mediumRefId,
    ray.flags
  );
}

fn queue_reflection_continuation(
  ray: RayRecord,
  hit: HitRecord,
  surface: SurfaceRecord,
  material: MaterialReferenceRecord
) {
  let facing_normal = faceforward_normal(surface.shadingNormal, ray.direction);
  let direction = reflect_direction(ray.direction, facing_normal);
  let attenuation = continuation_attenuation(EVENT_KIND_REFLECTION, material);
  queue_continuation_ray(ray, hit, surface, direction, attenuation);
}

fn queue_refraction_continuation(
  ray: RayRecord,
  hit: HitRecord,
  surface: SurfaceRecord,
  material: MaterialReferenceRecord
) {
  let front_face = hit.frontFace != 0u;
  let facing_normal = faceforward_normal(surface.shadingNormal, ray.direction);
  let eta_ratio = select(1.45, 1.0 / 1.45, front_face);
  let direction = refract_direction(ray.direction, facing_normal, eta_ratio);
  let attenuation = continuation_attenuation(EVENT_KIND_REFRACTION, material);
  queue_continuation_ray(ray, hit, surface, direction, attenuation);
}

fn queue_transparency_continuation(
  ray: RayRecord,
  hit: HitRecord,
  surface: SurfaceRecord,
  material: MaterialReferenceRecord
) {
  let attenuation = continuation_attenuation(EVENT_KIND_TRANSPARENCY, material);
  queue_continuation_ray(ray, hit, surface, ray.direction, attenuation);
}

fn queue_diffuse_continuation(
  ray: RayRecord,
  hit: HitRecord,
  surface: SurfaceRecord,
  material: MaterialReferenceRecord
) {
  let facing_normal = faceforward_normal(surface.shadingNormal, ray.direction);
  let attenuation = continuation_attenuation(EVENT_KIND_DIFFUSE, material);
  let bias =
    surface.tangentFrame0 * (surface.uv.x - 0.5) +
    surface.tangentFrame1 * (surface.uv.y - 0.5) +
    facing_normal;
  let direction = safe_normalize(bias);
  queue_continuation_ray(ray, hit, surface, direction, attenuation);
}

@compute @workgroup_size(64, 1, 1)
fn process_job(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let index = global_id.x;
  if (index >= wavefrontLightingParams.active_count) {
    return;
  }
  if (wavefrontLightingParams.bounce_index + 1u >= wavefrontLightingParams.max_depth) {
    return;
  }

  let ray = activeQueue[index];
  let hit = hitBuffer[index];
  if (is_terminal_hit_type(hit.hitType) || hit.hitType == HIT_TYPE_MISS) {
    return;
  }

  let surface = surfaceBuffer[index];
  let material = materialRefBuffer[surface.materialRefId];
  let _medium = mediumRefBuffer[surface.mediumRefId];
  let event_kind = choose_continuation_event_kind(hit, material);
  let explicit_light_sampling_enabled = wavefrontLightingParams.enable_explicit_light_sampling != 0u;

  if (event_kind == EVENT_KIND_REFLECTION) {
    queue_reflection_continuation(ray, hit, surface, material);
    return;
  }
  if (event_kind == EVENT_KIND_REFRACTION) {
    queue_refraction_continuation(ray, hit, surface, material);
    return;
  }
  if (event_kind == EVENT_KIND_TRANSPARENCY) {
    queue_transparency_continuation(ray, hit, surface, material);
    return;
  }

  if (explicit_light_sampling_enabled) {
    // Explicit light sampling remains optional for correctness in this first slice.
    queue_diffuse_continuation(ray, hit, surface, material);
    return;
  }

  queue_diffuse_continuation(ray, hit, surface, material);
}
