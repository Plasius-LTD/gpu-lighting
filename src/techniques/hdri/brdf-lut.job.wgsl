@group(0) @binding(0) var<uniform> iblPrecomputeParams: IblPrecomputeParams;
@group(0) @binding(1) var<storage, read_write> hdriBrdfLutOutput: array<vec4<f32>>;

fn lut_extent() -> u32 {
  return max(iblPrecomputeParams.sample_count, 1u);
}

fn lut_index(pixel: vec2<u32>) -> u32 {
  let extent = lut_extent();
  return pixel.y * extent + pixel.x;
}

fn saturate(value: f32) -> f32 {
  return clamp(value, 0.0, 1.0);
}

fn geometry_schlick_ggx(ndotv: f32, roughness: f32) -> f32 {
  let alpha = max(roughness * roughness, 0.001);
  let k = (alpha + 1.0) * (alpha + 1.0) / 8.0;
  return ndotv / max(ndotv * (1.0 - k) + k, 0.001);
}

fn geometry_smith(ndotv: f32, ndotl: f32, roughness: f32) -> f32 {
  return geometry_schlick_ggx(ndotv, roughness) * geometry_schlick_ggx(ndotl, roughness);
}

fn fresnel_schlick(cos_theta: f32) -> f32 {
  return pow(1.0 - saturate(cos_theta), 5.0);
}

@compute @workgroup_size(8, 8, 1)
fn process_job(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let extent = lut_extent();
  if (global_id.x >= extent || global_id.y >= extent) {
    return;
  }

  let uv = (vec2<f32>(global_id.xy) + vec2<f32>(0.5)) / max(vec2<f32>(f32(extent)), vec2<f32>(1.0));
  let ndotv = saturate(uv.x);
  let roughness = clamp_roughness(uv.y + iblPrecomputeParams.roughness * 0.15);
  let sample_total = max(iblPrecomputeParams.sample_count, 1u);
  var integrated_brdf = vec2<f32>(0.0);
  var sample_index = 0u;
  loop {
    if (sample_index >= sample_total) {
      break;
    }

    let sample_u = (f32(sample_index) + 0.5) / f32(sample_total);
    let sample_v = fract(f32(sample_index) * 0.61803398875);
    let ndotl = saturate(sqrt(sample_u));
    let vdoth = saturate(mix(ndotv, 1.0, sample_v));
    let geometry = geometry_smith(ndotv, ndotl, roughness);
    let fresnel = fresnel_schlick(vdoth);
    integrated_brdf = integrated_brdf + vec2<f32>(
      (1.0 - fresnel) * geometry,
      fresnel * geometry
    );

    sample_index = sample_index + 1u;
  }

  integrated_brdf =
    integrated_brdf / f32(sample_total) * max(iblPrecomputeParams.exposure_bias, 0.0001);
  hdriBrdfLutOutput[lut_index(global_id.xy)] = vec4<f32>(
    integrated_brdf.x,
    integrated_brdf.y,
    roughness,
    ndotv
  );
}
