@group(0) @binding(0) var<uniform> hybridFrameParams: HybridFrameParams;
@group(0) @binding(1) var<uniform> hybridReflectionCamera: HybridReflectionCamera;
@group(0) @binding(2) var<storage, read> hybridReflectionSurfaces: array<HybridReflectionSurface>;
@group(0) @binding(3) var<storage, read> hybridReflectionHistory: array<HybridReflectionPixel>;
@group(0) @binding(4) var<storage, read> hybridReflectionScene: HybridReflectionSceneMetadata;
@group(0) @binding(5) var<uniform> hybridGroundPlane: HybridGroundPlane;
@group(0) @binding(6) var<storage, read> hybridReflectionMaterials: array<HybridReflectionMaterial>;
@group(0) @binding(7) var<storage, read> hybridReflectionSpheres: array<HybridReflectionSphere>;
@group(0) @binding(8) var<storage, read_write> hybridReflectionOutput: array<HybridReflectionPixel>;

fn reflection_index(pixel: vec2<u32>) -> u32 {
  return pixel.y * max(hybridFrameParams.image_width, 1u) + pixel.x;
}

fn unpack_reflection_material(index: u32) -> HybridReflectionMaterial {
  if (hybridReflectionScene.material_count == 0u) {
    return HybridReflectionMaterial(
      vec4<f32>(0.7, 0.72, 0.76, 0.4),
      vec4<f32>(0.0, 0.0, 0.0, 0.0)
    );
  }

  let safe_index = min(index, hybridReflectionScene.material_count - 1u);
  return hybridReflectionMaterials[safe_index];
}

fn miss_reflection() -> HybridReflectionTrace {
  return HybridReflectionTrace(
    0u,
    hybridReflectionScene.max_trace_distance,
    vec3<f32>(0.0),
    0u,
    vec3<f32>(0.0, 1.0, 0.0),
    0u
  );
}

fn set_best_reflection(best: ptr<function, HybridReflectionTrace>, candidate: HybridReflectionTrace) {
  if (candidate.hit_mask == 1u && candidate.distance < (*best).distance) {
    *best = candidate;
  }
}

fn trace_reflection_ground(
  origin: vec3<f32>,
  direction: vec3<f32>,
  best: ptr<function, HybridReflectionTrace>
) {
  if (hybridGroundPlane.enabled == 0u) {
    return;
  }

  let plane_normal = hybrid_safe_normalize(hybridGroundPlane.normal);
  let denominator = dot(plane_normal, direction);
  if (abs(denominator) <= 0.0005) {
    return;
  }

  let distance = -(dot(plane_normal, origin) + hybridGroundPlane.height) / denominator;
  if (distance <= 0.0005 || distance >= (*best).distance || distance >= hybridReflectionScene.max_trace_distance) {
    return;
  }

  set_best_reflection(
    best,
    HybridReflectionTrace(
      1u,
      distance,
      origin + direction * distance,
      hybridGroundPlane.material_index,
      plane_normal,
      0u
    )
  );
}

fn trace_reflection_spheres(
  origin: vec3<f32>,
  direction: vec3<f32>,
  best: ptr<function, HybridReflectionTrace>
) {
  var index = 0u;
  loop {
    if (index >= hybridReflectionScene.sphere_count) {
      break;
    }

    let sphere = hybridReflectionSpheres[index];
    let offset = origin - sphere.center_radius.xyz;
    let a = dot(direction, direction);
    let half_b = dot(offset, direction);
    let c = dot(offset, offset) - sphere.center_radius.w * sphere.center_radius.w;
    let discriminant = half_b * half_b - a * c;
    if (discriminant >= 0.0) {
      let root = sqrt(discriminant);
      var distance = (-half_b - root) / max(a, 0.0005);
      if (distance <= 0.0005) {
        distance = (-half_b + root) / max(a, 0.0005);
      }
      if (distance > 0.0005 && distance < (*best).distance && distance < hybridReflectionScene.max_trace_distance) {
        let position = origin + direction * distance;
        let normal = hybrid_safe_normalize(position - sphere.center_radius.xyz);
        set_best_reflection(
          best,
          HybridReflectionTrace(
            1u,
            distance,
            position,
            sphere.material_index,
            normal,
            0u
          )
        );
      }
    }

    index = index + 1u;
  }
}

fn trace_reflection_scene(origin: vec3<f32>, direction: vec3<f32>) -> HybridReflectionTrace {
  var best = miss_reflection();
  trace_reflection_ground(origin, direction, &best);
  trace_reflection_spheres(origin, direction, &best);
  return best;
}

fn evaluate_hit_lighting(trace: HybridReflectionTrace, view_direction: vec3<f32>) -> vec3<f32> {
  let material = unpack_reflection_material(trace.material_index);
  let surface_normal = hybrid_safe_normalize(trace.normal);
  let light_direction = hybrid_safe_normalize(vec3<f32>(0.31, 0.92, 0.22));
  let ndotl = hybrid_saturate(dot(surface_normal, light_direction));
  let halfway = hybrid_safe_normalize(light_direction + view_direction);
  let roughness = clamp(material.albedo_roughness.w, 0.02, 1.0);
  let metalness = hybrid_saturate(material.emission_metalness.w);
  let albedo = material.albedo_roughness.xyz;
  let f0 = vec3<f32>(0.04) * (1.0 - metalness) + albedo * metalness;
  let fresnel = hybrid_fresnel_schlick(
    hybrid_saturate(dot(surface_normal, view_direction)),
    f0
  );
  let diffuse = albedo * ndotl * 0.3183098861837907 * (1.0 - metalness);
  let specular_power = 12.0 + (1.0 - roughness) * 96.0;
  let specular = fresnel * pow(hybrid_saturate(dot(surface_normal, halfway)), specular_power) * ndotl;
  let direct_light = vec3<f32>(5.4, 5.0, 4.6) * ndotl;
  let environment = hybrid_environment(surface_normal, hybridFrameParams.sky_intensity, hybridFrameParams.sky_mode);
  return material.emission_metalness.xyz + (diffuse + specular) * direct_light + environment * 0.08;
}

@compute @workgroup_size(8, 8, 1)
fn process_job(@builtin(global_invocation_id) global_id: vec3<u32>) {
  if (
    global_id.x >= hybridFrameParams.image_width ||
    global_id.y >= hybridFrameParams.image_height
  ) {
    return;
  }

  let index = reflection_index(global_id.xy);
  let surface = hybridReflectionSurfaces[index];
  let previous = hybridReflectionHistory[index];
  let position = surface.position.xyz;
  let normal = hybrid_safe_normalize(surface.normal_roughness.xyz);
  let roughness = clamp(surface.normal_roughness.w + hybridFrameParams.roughness_bias, 0.02, 1.0);
  let albedo = surface.albedo_metalness.xyz;
  let metalness = hybrid_saturate(surface.albedo_metalness.w);
  let occlusion = hybrid_saturate(surface.emission_occlusion.w);
  let view_direction = hybrid_safe_normalize(hybridReflectionCamera.position - position);
  let f0 = vec3<f32>(0.04) * (1.0 - metalness) + albedo * metalness;
  let fresnel = hybrid_fresnel_schlick(hybrid_saturate(dot(normal, view_direction)), f0);
  let grazing_boost = pow(1.0 - hybrid_saturate(dot(normal, view_direction)), 5.0);
  let reflection_budget = clamp(
    (metalness * 0.85 + max(fresnel.x, max(fresnel.y, fresnel.z))) *
      (1.0 - roughness * 0.65) +
      grazing_boost * 0.2,
    0.0,
    1.0
  );
  let trace_needed = reflection_budget > 0.02;
  var random_state = hybrid_hash_u32(
    hybridFrameParams.frame_index * 747796405u +
    index * 2891336453u +
    0x27d4eb2du
  );
  let reflection_direction = hybrid_safe_normalize(
    reflect(-view_direction, normal) +
      hybrid_sample_unit_sphere(&random_state) * roughness * roughness * 0.35
  );
  var trace = miss_reflection();
  if (trace_needed) {
    trace = trace_reflection_scene(
      position + normal * max(hybridFrameParams.thickness, 0.0005),
      reflection_direction
    );
  }
  let hit_radiance = select(
    hybrid_environment(reflection_direction, hybridFrameParams.sky_intensity, hybridFrameParams.sky_mode),
    evaluate_hit_lighting(trace, -reflection_direction),
    trace.hit_mask == 1u
  );
  let roughness_mix = roughness * roughness;
  let distant_fade = exp(
    -trace.distance /
      max(hybridFrameParams.max_reflection_distance * 0.65, 0.0005)
  );
  let reflection_color =
    hit_radiance * reflection_budget * distant_fade * occlusion;
  let sky_lobe = hybrid_environment(normal, hybridFrameParams.sky_intensity, hybridFrameParams.sky_mode);
  let shaped_reflection =
    reflection_color * (1.0 - roughness_mix * 0.35) +
    sky_lobe * roughness_mix * 0.18 * reflection_budget;
  let history_weight = select(
    0.0,
    encode_history_weight(hybridFrameParams.history_weight),
    hybridFrameParams.reflection_reset == 0u && previous.reflection_confidence.w > 0.0
  );
  let resolved =
    previous.reflection_confidence.xyz * history_weight +
    shaped_reflection * (1.0 - history_weight);
  let confidence = clamp(
    reflection_budget * (0.45 + distant_fade * 0.55) * (1.0 - roughness * 0.35),
    0.0,
    1.0
  );
  let resolved_normal = select(normal, hybrid_safe_normalize(trace.normal), trace.hit_mask == 1u);
  let resolved_distance = select(
    hybridFrameParams.max_reflection_distance,
    trace.distance,
    trace.hit_mask == 1u
  );

  hybridReflectionOutput[index] = HybridReflectionPixel(
    vec4<f32>(resolved * hybridFrameParams.exposure, confidence),
    vec4<f32>(resolved_normal, resolved_distance)
  );
}
