@group(0) @binding(0) var<uniform> wavefrontLightingParams: WavefrontLightingParams;
@group(0) @binding(1) var<storage, read> activeQueue: array<RayRecord>;
@group(0) @binding(2) var<storage, read> hitBuffer: array<HitRecord>;
@group(0) @binding(3) var<storage, read> surfaceBuffer: array<SurfaceRecord>;
@group(0) @binding(4) var<storage, read> materialRefBuffer: array<MaterialReferenceRecord>;
@group(0) @binding(5) var<storage, read> mediumRefBuffer: array<MediumReferenceRecord>;
@group(0) @binding(6) var<storage, read_write> accumulationBuffer: array<AccumulationRecord>;

fn resolve_emissive_radiance(
  material: MaterialReferenceRecord,
  surface: SurfaceRecord
) -> vec3<f32> {
  let uv_weight = saturate_scalar(surface.uv.x + surface.uv.y);
  let emissive_hint = select(0.0, 1.0, (material.flags & 0x1u) != 0u);
  let base = material_base_albedo(material);
  return base * (0.5 + uv_weight * 0.5 + emissive_hint * 2.0);
}

fn accumulate_terminal_sample(
  ray: RayRecord,
  hit: HitRecord,
  surface: SurfaceRecord,
  material: MaterialReferenceRecord,
  accumulation_index: u32
) {
  let emissive_radiance = resolve_emissive_radiance(material, surface);
  let terminal_radiance = terminal_radiance_for_hit(hit, ray, emissive_radiance);
  if (luminance(terminal_radiance) <= LIGHTING_EPSILON) {
    return;
  }

  accumulationBuffer[accumulation_index].sourcePixelId = ray.sourcePixelId;
  accumulationBuffer[accumulation_index].sampleCount =
    accumulationBuffer[accumulation_index].sampleCount + 1u;
  accumulationBuffer[accumulation_index].resetEpoch =
    wavefrontLightingParams.accumulation_reset_epoch;
  accumulationBuffer[accumulation_index].radiance =
    accumulationBuffer[accumulation_index].radiance + terminal_radiance;
  accumulationBuffer[accumulation_index].throughput = ray.throughput;
}

@compute @workgroup_size(64, 1, 1)
fn process_job(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let index = global_id.x;
  if (index >= wavefrontLightingParams.active_count) {
    return;
  }

  let ray = activeQueue[index];
  let hit = hitBuffer[index];
  if (!is_terminal_hit_type(hit.hitType)) {
    return;
  }

  let surface = surfaceBuffer[index];
  let material = materialRefBuffer[surface.materialRefId];
  let _medium = mediumRefBuffer[surface.mediumRefId];
  let accumulation_index = min(ray.sourcePixelId, wavefrontLightingParams.active_count - 1u);

  accumulate_terminal_sample(ray, hit, surface, material, accumulation_index);
}
