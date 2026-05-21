@group(0) @binding(0) var<uniform> hybridFrameParams: HybridFrameParams;
@group(0) @binding(1) var<storage, read> hybridReflectionSurfaces: array<HybridReflectionSurface>;
@group(0) @binding(2) var<storage, read> hybridDirectLightingInput: array<HybridLightingPixel>;
@group(0) @binding(3) var<storage, read> hybridScreenTraceInput: array<HybridScreenTracePixel>;
@group(0) @binding(4) var<storage, read> hybridRadianceCacheInput: array<HybridRadianceCacheEntry>;
@group(0) @binding(5) var<storage, read_write> hybridFinalGatherOutput: array<HybridLightingPixel>;

fn final_gather_index(pixel: vec2<u32>) -> u32 {
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

  let index = final_gather_index(global_id.xy);
  let surface = hybridReflectionSurfaces[index];
  let direct = hybridDirectLightingInput[index];
  let trace = hybridScreenTraceInput[index];
  let cache = hybridRadianceCacheInput[index];
  let previous = hybridFinalGatherOutput[index];
  let normal = hybrid_safe_normalize(surface.normal_roughness.xyz);
  let roughness = clamp(surface.normal_roughness.w + hybridFrameParams.roughness_bias, 0.02, 1.0);
  let metalness = hybrid_saturate(surface.albedo_metalness.w);
  let emission = surface.emission_occlusion.xyz;
  let occlusion = hybrid_saturate(surface.emission_occlusion.w);
  let direct_radiance = direct.radiance_confidence.xyz;
  let trace_radiance = trace.radiance_confidence.xyz;
  let cache_irradiance = cache.irradiance_validity.xyz;
  let indirect_gi =
    cache_irradiance * occlusion * (0.32 + (1.0 - roughness) * 0.28);
  let reflection_term =
    trace_radiance *
    trace.radiance_confidence.w *
    (0.18 + (1.0 - roughness) * 0.42 + metalness * 0.25);
  let ambient = hybrid_environment(normal, hybridFrameParams.sky_intensity, hybridFrameParams.sky_mode) * 0.05 * occlusion;
  let current_radiance = direct_radiance + indirect_gi + reflection_term + emission + ambient;
  let history_weight = select(
    0.0,
    encode_history_weight(hybridFrameParams.history_weight),
    hybridFrameParams.reflection_reset == 0u && previous.radiance_confidence.w > 0.0
  );
  let resolved_radiance =
    previous.radiance_confidence.xyz * history_weight +
    current_radiance * (1.0 - history_weight);
  let confidence = clamp(
    direct.radiance_confidence.w * 0.4 +
    cache.irradiance_validity.w * 0.3 +
    trace.radiance_confidence.w * 0.3,
    0.0,
    1.0
  );

  hybridFinalGatherOutput[index] = HybridLightingPixel(
    vec4<f32>(resolved_radiance, confidence),
    vec4<f32>(normal, occlusion)
  );
}
