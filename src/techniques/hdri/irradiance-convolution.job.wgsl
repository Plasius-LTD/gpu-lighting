struct HdriConvolutionSample {
  direction_radiance: vec4<f32>,
};

@group(0) @binding(0) var<uniform> iblPrecomputeParams: IblPrecomputeParams;
@group(0) @binding(1) var<storage, read> hdriEnvironmentInput: array<HdriConvolutionSample>;
@group(0) @binding(2) var<storage, read_write> hdriIrradianceOutput: array<vec4<f32>>;

fn face_extent() -> u32 {
  return max(iblPrecomputeParams.sample_count, 1u);
}

fn face_pixel_index(pixel: vec2<u32>) -> u32 {
  let extent = face_extent();
  return pixel.y * extent + pixel.x;
}

fn safe_normalize(value: vec3<f32>) -> vec3<f32> {
  let length_value = length(value);
  if (length_value <= 0.000001) {
    return vec3<f32>(0.0, 1.0, 0.0);
  }
  return value / length_value;
}

fn direction_from_texel(pixel: vec2<u32>, extent: u32) -> vec3<f32> {
  let uv = (vec2<f32>(pixel) + vec2<f32>(0.5)) / max(vec2<f32>(f32(extent)), vec2<f32>(1.0));
  let phi = (uv.x * 2.0 - 1.0) * 3.141592653589793;
  let theta = uv.y * 3.141592653589793;
  let sin_theta = sin(theta);
  return safe_normalize(
    vec3<f32>(
      cos(phi) * sin_theta,
      cos(theta),
      sin(phi) * sin_theta
    )
  );
}

fn direction_to_index(direction: vec3<f32>, extent: u32) -> u32 {
  let dir = safe_normalize(direction);
  let phi = atan2(dir.z, dir.x);
  let theta = acos(clamp(dir.y, -1.0, 1.0));
  let u = fract(phi / (2.0 * 3.141592653589793) + 0.5);
  let v = clamp(theta / 3.141592653589793, 0.0, 0.999999);
  let pixel = vec2<u32>(
    min(u32(floor(u * f32(extent))), extent - 1u),
    min(u32(floor(v * f32(extent))), extent - 1u)
  );
  return face_pixel_index(pixel);
}

fn sample_environment(direction: vec3<f32>) -> vec3<f32> {
  let index = direction_to_index(direction, face_extent());
  return hdriEnvironmentInput[index].direction_radiance.xyz;
}

@compute @workgroup_size(8, 8, 1)
fn process_job(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let extent = face_extent();
  if (global_id.x >= extent || global_id.y >= extent) {
    return;
  }

  let normal = direction_from_texel(global_id.xy, extent);
  var accumulated_irradiance = vec3<f32>(0.0);
  var total_weight = 0.0;
  var sample_index = 0u;
  loop {
    if (sample_index >= extent) {
      break;
    }

    let sample_pixel = vec2<u32>(
      (global_id.x + sample_index) % extent,
      (global_id.y + sample_index * 3u) % extent
    );
    let sample_direction = direction_from_texel(sample_pixel, extent);
    let cosine_weight = max(dot(normal, sample_direction), 0.0);
    if (cosine_weight > 0.0) {
      accumulated_irradiance =
        accumulated_irradiance + sample_environment(sample_direction) * cosine_weight;
      total_weight = total_weight + cosine_weight;
    }

    sample_index = sample_index + 1u;
  }

  let irradiance =
    accumulated_irradiance / max(total_weight, 0.0001) * max(iblPrecomputeParams.exposure_bias, 0.0001);
  hdriIrradianceOutput[face_pixel_index(global_id.xy)] = vec4<f32>(irradiance, 1.0);
}
