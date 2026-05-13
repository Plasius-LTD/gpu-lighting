@group(0) @binding(0) var<uniform> pathTracerParams: PathTracerParams;
@group(0) @binding(1) var<storage, read> pathSampleBuffer: array<PathSamplePixel>;
@group(0) @binding(2) var<storage, read_write> pathAccumulationBuffer: array<PathAccumulationPixel>;

fn accumulation_index(pixel: vec2<u32>) -> u32 {
  return pixel.y * max(pathTracerParams.image_width, 1u) + pixel.x;
}

fn reset_accumulation(sample: PathSamplePixel) -> PathAccumulationPixel {
  let sample_luminance = luminance(sample.radiance_opacity.xyz);
  return PathAccumulationPixel(
    vec4<f32>(sample.radiance_opacity.xyz, max(sample.albedo_sample_count.w, 1.0)),
    vec4<f32>(sample_luminance, 0.0, 0.0, f32(pathTracerParams.frame_index))
  );
}

@compute @workgroup_size(8, 8, 1)
fn process_job(@builtin(global_invocation_id) global_id: vec3<u32>) {
  if (
    global_id.x >= pathTracerParams.image_width ||
    global_id.y >= pathTracerParams.image_height
  ) {
    return;
  }

  let index = accumulation_index(global_id.xy);
  let sample = pathSampleBuffer[index];
  let history = pathAccumulationBuffer[index];
  let sample_luminance = luminance(sample.radiance_opacity.xyz);
  let current_samples = max(sample.albedo_sample_count.w, 1.0);
  let history_samples = max(history.integrated_radiance.w, 0.0);
  let should_reset =
    pathTracerParams.accumulation_reset != 0u ||
    history_samples <= 0.0 ||
    history.moments.w <= 0.0;

  if (should_reset) {
    pathAccumulationBuffer[index] = reset_accumulation(sample);
    return;
  }

  let combined_samples = min(history_samples + current_samples, 4096.0);
  let progressive_weight = current_samples / max(combined_samples, 1.0);
  let minimum_refresh = 1.0 - clamp(pathTracerParams.history_blend, 0.0, 0.98);
  let blend = clamp(max(progressive_weight, minimum_refresh), 0.02, 1.0);
  let integrated =
    history.integrated_radiance.xyz * (1.0 - blend) +
    sample.radiance_opacity.xyz * blend;
  let mean_luminance =
    history.moments.x * (1.0 - blend) +
    sample_luminance * blend;
  let variance_sample = sample_luminance - mean_luminance;
  let variance =
    max(0.0, history.moments.y * (1.0 - blend) + variance_sample * variance_sample * blend);

  pathAccumulationBuffer[index] = PathAccumulationPixel(
    vec4<f32>(integrated, combined_samples),
    vec4<f32>(
      mean_luminance,
      variance,
      1.0 - blend,
      f32(pathTracerParams.frame_index)
    )
  );
}
