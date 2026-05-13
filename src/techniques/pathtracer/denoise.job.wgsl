@group(0) @binding(0) var<uniform> pathTracerParams: PathTracerParams;
@group(0) @binding(1) var<storage, read> pathAccumulationBuffer: array<PathAccumulationPixel>;
@group(0) @binding(2) var<storage, read> pathSampleBuffer: array<PathSamplePixel>;
@group(0) @binding(3) var<storage, read_write> pathDenoiseHistoryBuffer: array<PathDenoisePixel>;

fn denoise_index(pixel: vec2<u32>) -> u32 {
  return pixel.y * max(pathTracerParams.image_width, 1u) + pixel.x;
}

fn in_bounds(pixel: vec2<i32>) -> bool {
  return
    pixel.x >= 0 &&
    pixel.y >= 0 &&
    pixel.x < i32(pathTracerParams.image_width) &&
    pixel.y < i32(pathTracerParams.image_height);
}

fn spatial_kernel(offset: vec2<i32>) -> f32 {
  if (offset.x == 0 && offset.y == 0) {
    return 4.0;
  }
  if (offset.x == 0 || offset.y == 0) {
    return 2.0;
  }
  return 1.0;
}

fn bilateral_weight(
  center_sample: PathSamplePixel,
  center_accumulation: PathAccumulationPixel,
  neighbor_sample: PathSamplePixel,
  offset: vec2<i32>
) -> f32 {
  let strength = clamp(pathTracerParams.denoise_strength, 0.0, 1.0);
  let center_normal = safe_normalize(center_sample.normal_roughness.xyz);
  let neighbor_normal = safe_normalize(neighbor_sample.normal_roughness.xyz);
  let normal_alignment = pow(
    saturate(dot(center_normal, neighbor_normal)),
    6.0 + (1.0 - strength) * 24.0
  );
  let depth_delta = abs(center_sample.direction_distance.w - neighbor_sample.direction_distance.w);
  let depth_scale =
    max(center_sample.direction_distance.w, 1.0) *
    (0.01 + strength * 0.04);
  let depth_weight = exp(-depth_delta * safe_rcp(depth_scale));
  let albedo_delta = length(
    center_sample.albedo_sample_count.xyz - neighbor_sample.albedo_sample_count.xyz
  );
  let albedo_weight = exp(-albedo_delta * (2.0 + strength * 2.0));
  let sample_weight = clamp(
    neighbor_sample.albedo_sample_count.w /
      max(center_sample.albedo_sample_count.w, 1.0),
    0.25,
    1.5
  );
  let variance_penalty = 1.0 / (1.0 + center_accumulation.moments.y * 0.5);
  return spatial_kernel(offset) *
    max(normal_alignment * depth_weight * albedo_weight * sample_weight * variance_penalty, 0.0001);
}

@compute @workgroup_size(8, 8, 1)
fn process_job(@builtin(global_invocation_id) global_id: vec3<u32>) {
  if (
    global_id.x >= pathTracerParams.image_width ||
    global_id.y >= pathTracerParams.image_height
  ) {
    return;
  }

  let pixel = vec2<i32>(i32(global_id.x), i32(global_id.y));
  let index = denoise_index(global_id.xy);
  let center_accumulation = pathAccumulationBuffer[index];
  let center_sample = pathSampleBuffer[index];
  let center_history = pathDenoiseHistoryBuffer[index];
  var filtered = vec3<f32>(0.0);
  var total_weight = 0.0;

  for (var y = -1; y <= 1; y = y + 1) {
    for (var x = -1; x <= 1; x = x + 1) {
      let neighbor_pixel = pixel + vec2<i32>(x, y);
      if (!in_bounds(neighbor_pixel)) {
        continue;
      }

      let neighbor_index = denoise_index(vec2<u32>(u32(neighbor_pixel.x), u32(neighbor_pixel.y)));
      let neighbor_accumulation = pathAccumulationBuffer[neighbor_index];
      let neighbor_sample = pathSampleBuffer[neighbor_index];
      let weight = bilateral_weight(
        center_sample,
        center_accumulation,
        neighbor_sample,
        vec2<i32>(x, y)
      );
      filtered = filtered + neighbor_accumulation.integrated_radiance.xyz * weight;
      total_weight = total_weight + weight;
    }
  }

  let filtered_color = filtered / max(total_weight, PATH_TRACER_EPSILON);
  let sample_confidence = clamp(
    log2(max(center_accumulation.integrated_radiance.w, 1.0) + 1.0) / 6.0,
    0.0,
    1.0
  );
  let variance_penalty = 1.0 / (1.0 + center_accumulation.moments.y * 0.75);
  let confidence = clamp(sample_confidence * variance_penalty, 0.0, 1.0);
  let use_history =
    pathTracerParams.accumulation_reset == 0u &&
    center_history.filtered_radiance.w > 0.0;
  let temporal_blend = clamp(0.2 + confidence * 0.6, 0.2, 0.9);
  let resolved_color = select(
    filtered_color,
    center_history.filtered_radiance.xyz * (1.0 - temporal_blend) +
      filtered_color * temporal_blend,
    use_history
  );

  pathDenoiseHistoryBuffer[index] = PathDenoisePixel(
    vec4<f32>(resolved_color, confidence),
    vec4<f32>(safe_normalize(center_sample.normal_roughness.xyz), center_sample.direction_distance.w),
    vec4<f32>(
      center_sample.albedo_sample_count.xyz,
      center_accumulation.integrated_radiance.w
    )
  );
}
