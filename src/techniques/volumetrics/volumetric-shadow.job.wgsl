struct VolumetricLightParams {
  light_direction: vec3<f32>,
  history_blend: f32,
  light_color: vec3<f32>,
  shadow_strength: f32,
  slice_depth_scale: f32,
  density_bias: f32,
  phase_bias: f32,
  jitter_amount: f32,
};

struct FroxelMediumVoxel {
  extinction_density: vec4<f32>,
  inscattering_anisotropy: vec4<f32>,
};

struct VolumetricShadowHistory {
  shadow_transmittance: vec4<f32>,
  depth_phase: vec4<f32>,
};

@group(0) @binding(0) var<uniform> froxelGridParams: FroxelGridParams;
@group(0) @binding(1) var<uniform> volumetricLightParams: VolumetricLightParams;
@group(0) @binding(2) var<storage, read> froxelMediumInput: array<FroxelMediumVoxel>;
@group(0) @binding(3) var<storage, read> froxelShadowHistory: array<VolumetricShadowHistory>;
@group(0) @binding(4) var<storage, read_write> froxelShadowOutput: array<VolumetricShadowHistory>;

fn froxel_shadow_index(coord: vec3<u32>) -> u32 {
  let plane = max(froxelGridParams.grid_width, 1u) * max(froxelGridParams.grid_height, 1u);
  return coord.z * plane + coord.y * max(froxelGridParams.grid_width, 1u) + coord.x;
}

fn safe_normalize(value: vec3<f32>) -> vec3<f32> {
  let length_value = length(value);
  if (length_value <= 0.000001) {
    return vec3<f32>(0.0, 1.0, 0.0);
  }
  return value / length_value;
}

fn henyey_greenstein(cos_theta: f32, anisotropy: f32) -> f32 {
  let g = clamp(anisotropy, -0.85, 0.85);
  let denominator = pow(max(1.0 + g * g - 2.0 * g * cos_theta, 0.001), 1.5);
  return (1.0 - g * g) / max(12.566370614359172 * denominator, 0.001);
}

@compute @workgroup_size(4, 4, 4)
fn process_job(@builtin(global_invocation_id) global_id: vec3<u32>) {
  if (
    global_id.x >= froxelGridParams.grid_width ||
    global_id.y >= froxelGridParams.grid_height ||
    global_id.z >= froxelGridParams.grid_depth
  ) {
    return;
  }

  let index = froxel_shadow_index(global_id);
  let medium = froxelMediumInput[index];
  let previous = froxelShadowHistory[index];
  let light_direction = safe_normalize(volumetricLightParams.light_direction);
  let slice_depth = (f32(global_id.z) + 0.5) / max(f32(froxelGridParams.grid_depth), 1.0);
  let density = max(medium.extinction_density.w + volumetricLightParams.density_bias, 0.0);
  let extinction = max(dot(medium.extinction_density.xyz, vec3<f32>(0.2126, 0.7152, 0.0722)), 0.0001);
  let anisotropy = medium.inscattering_anisotropy.w;
  let phase_weight = henyey_greenstein(light_direction.y, anisotropy);
  let depth_scale = max(volumetricLightParams.slice_depth_scale, 0.25);
  let shadow_distance = depth_scale * mix(0.35, 1.35, slice_depth);
  let optical_depth = (density * 0.7 + extinction * 0.3) * shadow_distance;
  let raw_transmittance = exp(-optical_depth);
  let horizon_wrap = 0.35 + 0.65 * saturate(light_direction.y * 0.5 + 0.5);
  let jitter = fract(
    f32(global_id.x * 19u + global_id.y * 47u + global_id.z * 73u) * 0.61803398875
  );
  let visibility = clamp(
    raw_transmittance * horizon_wrap * (1.0 - volumetricLightParams.jitter_amount * (jitter - 0.5)),
    0.0,
    1.0
  );
  let history_visibility = previous.shadow_transmittance.w;
  let blend = clamp(volumetricLightParams.history_blend, 0.0, 0.98);
  let shadow_transmittance = mix(visibility, history_visibility, blend);
  let light_radiance =
    volumetricLightParams.light_color *
    shadow_transmittance *
    max(volumetricLightParams.shadow_strength, 0.0) *
    (0.55 + phase_weight * 0.45);
  let depth_confidence = clamp(
    slice_depth * 0.45 + shadow_transmittance * 0.35 + (1.0 - density) * 0.2,
    0.0,
    1.0
  );

  froxelShadowOutput[index] = VolumetricShadowHistory(
    vec4<f32>(light_radiance, shadow_transmittance),
    vec4<f32>(slice_depth, optical_depth, phase_weight, depth_confidence)
  );
}
