@group(0) @binding(0) var<uniform> hybridFrameParams: HybridFrameParams;
@group(0) @binding(1) var<uniform> hybridReflectionCamera: HybridReflectionCamera;
@group(0) @binding(2) var<storage, read> hybridReflectionSurfaces: array<HybridReflectionSurface>;
@group(0) @binding(3) var<storage, read_write> hybridDirectLightingOutput: array<HybridLightingPixel>;

fn direct_lighting_index(pixel: vec2<u32>) -> u32 {
  return pixel.y * max(hybridFrameParams.image_width, 1u) + pixel.x;
}

fn evaluate_direct_sun(
  normal: vec3<f32>,
  view_direction: vec3<f32>,
  albedo: vec3<f32>,
  roughness: f32,
  metalness: f32
) -> vec3<f32> {
  let sun_direction = hybrid_safe_normalize(vec3<f32>(0.31, 0.92, 0.22));
  let ndotl = hybrid_saturate(dot(normal, sun_direction));
  if (ndotl <= 0.0) {
    return vec3<f32>(0.0);
  }

  let halfway = hybrid_safe_normalize(sun_direction + view_direction);
  let f0 = hybrid_surface_f0(albedo, metalness);
  let fresnel = hybrid_fresnel_schlick(
    hybrid_saturate(dot(normal, view_direction)),
    f0
  );
  let diffuse = albedo * ndotl * 0.3183098861837907 * (1.0 - metalness);
  let specular_power = 10.0 + (1.0 - roughness) * 112.0;
  let specular = fresnel * pow(hybrid_saturate(dot(normal, halfway)), specular_power) * ndotl;
  let sun_color = vec3<f32>(6.2, 5.8, 5.1) * max(hybridFrameParams.sky_intensity, 0.0001);
  return (diffuse + specular) * sun_color;
}

@compute @workgroup_size(8, 8, 1)
fn process_job(@builtin(global_invocation_id) global_id: vec3<u32>) {
  if (
    global_id.x >= hybridFrameParams.image_width ||
    global_id.y >= hybridFrameParams.image_height
  ) {
    return;
  }

  let index = direct_lighting_index(global_id.xy);
  let surface = hybridReflectionSurfaces[index];
  let position = surface.position.xyz;
  let normal = hybrid_safe_normalize(surface.normal_roughness.xyz);
  let roughness = clamp(surface.normal_roughness.w + hybridFrameParams.roughness_bias, 0.02, 1.0);
  let albedo = surface.albedo_metalness.xyz;
  let metalness = hybrid_saturate(surface.albedo_metalness.w);
  let emission = surface.emission_occlusion.xyz;
  let occlusion = hybrid_saturate(surface.emission_occlusion.w);
  let view_direction = hybrid_safe_normalize(hybridReflectionCamera.position - position);
  let direct_sun = evaluate_direct_sun(normal, view_direction, albedo, roughness, metalness);
  let sky_fill = hybrid_environment(normal, hybridFrameParams.sky_intensity, hybridFrameParams.sky_mode);
  let grazing = pow(1.0 - hybrid_saturate(dot(normal, view_direction)), 4.0);
  let ambient = sky_fill * (0.08 + grazing * 0.06) * occlusion;
  let radiance = emission + direct_sun * occlusion + ambient;
  let confidence = clamp(
    hybrid_luminance(radiance) * 0.045 + occlusion * 0.35 + (1.0 - roughness) * 0.15,
    0.0,
    1.0
  );

  hybridDirectLightingOutput[index] = HybridLightingPixel(
    vec4<f32>(radiance * hybridFrameParams.exposure, confidence),
    vec4<f32>(normal, occlusion)
  );
}
