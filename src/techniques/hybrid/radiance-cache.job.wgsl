@group(0) @binding(0) var<uniform> hybridFrameParams: HybridFrameParams;
@group(0) @binding(1) var<storage, read> hybridReflectionSurfaces: array<HybridReflectionSurface>;
@group(0) @binding(2) var<storage, read> hybridDirectLightingInput: array<HybridLightingPixel>;
@group(0) @binding(3) var<storage, read> hybridRadianceCacheHistory: array<HybridRadianceCacheEntry>;
@group(0) @binding(4) var<storage, read_write> hybridRadianceCacheOutput: array<HybridRadianceCacheEntry>;

fn radiance_cache_index(pixel: vec2<u32>) -> u32 {
  return pixel.y * max(hybridFrameParams.image_width, 1u) + pixel.x;
}

@compute @workgroup_size(8, 8, 1)
fn process_job(@builtin(global_invocation_id) global_id: vec3<u32>) {
  if (
    global_id.x >= hybridFrameParams.image_width ||
    global_id.y >= hybridFrameParams.image_height
  ) {
    return;
  }

  let index = radiance_cache_index(global_id.xy);
  let surface = hybridReflectionSurfaces[index];
  let direct = hybridDirectLightingInput[index];
  let previous = hybridRadianceCacheHistory[index];
  let normal = hybrid_safe_normalize(surface.normal_roughness.xyz);
  let roughness = clamp(surface.normal_roughness.w + hybridFrameParams.roughness_bias, 0.02, 1.0);
  let occlusion = hybrid_saturate(surface.emission_occlusion.w);
  let sky_probe = hybrid_environment(normal, hybridFrameParams.sky_intensity, hybridFrameParams.sky_mode);
  let direct_irradiance = direct.radiance_confidence.xyz * (0.28 + (1.0 - roughness) * 0.12);
  let cache_fill = sky_probe * (0.08 + occlusion * 0.12);
  let current_irradiance = direct_irradiance + cache_fill;
  let bent_normal = hybrid_safe_normalize(
    normal * (0.75 + occlusion * 0.25) +
    previous.bent_normal_depth.xyz * previous.irradiance_validity.w * 0.2
  );
  let history_weight = select(
    0.0,
    encode_history_weight(hybridFrameParams.history_weight) * previous.irradiance_validity.w,
    hybridFrameParams.reflection_reset == 0u && previous.irradiance_validity.w > 0.0
  );
  let resolved_irradiance =
    previous.irradiance_validity.xyz * history_weight +
    current_irradiance * (1.0 - history_weight);
  let validity = clamp(
    hybrid_luminance(resolved_irradiance) * 0.05 +
    occlusion * 0.35 +
    (1.0 - roughness) * 0.15,
    0.0,
    1.0
  );
  let probe_depth =
    previous.bent_normal_depth.w * history_weight +
    length(surface.position.xyz) * (1.0 - history_weight);

  hybridRadianceCacheOutput[index] = HybridRadianceCacheEntry(
    vec4<f32>(resolved_irradiance, validity),
    vec4<f32>(bent_normal, probe_depth)
  );
}
