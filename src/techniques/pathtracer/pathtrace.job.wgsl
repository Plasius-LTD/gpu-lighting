@group(0) @binding(0) var<uniform> pathTracerParams: PathTracerParams;
@group(0) @binding(1) var<uniform> pathTracerCamera: PathTracerCamera;
@group(0) @binding(2) var<storage, read> pathTracerScene: PathTracerSceneMetadata;
@group(0) @binding(3) var<uniform> pathTracerGroundPlane: PathTracerGroundPlane;
@group(0) @binding(4) var<storage, read> pathTracerMaterials: array<PathTracerMaterial>;
@group(0) @binding(5) var<storage, read> pathTracerSpheres: array<PathTracerSphere>;
@group(0) @binding(6) var<storage, read> pathTracerTriangles: array<PathTracerTriangle>;
@group(0) @binding(7) var<storage, read_write> pathStateBuffer: array<PathState>;
@group(0) @binding(8) var<storage, read_write> pathSampleBuffer: array<PathSamplePixel>;

fn pixel_index(pixel: vec2<u32>) -> u32 {
  return pixel.y * max(pathTracerParams.image_width, 1u) + pixel.x;
}

fn load_path_material(index: u32) -> MaterialSample {
  if (pathTracerScene.material_count == 0u) {
    return unpack_material(make_default_material());
  }

  let safe_index = min(index, pathTracerScene.material_count - 1u);
  return unpack_material(pathTracerMaterials[safe_index]);
}

fn set_best_hit(best: ptr<function, PathHit>, candidate: PathHit) {
  if (candidate.hit == 1u && candidate.distance < (*best).distance) {
    *best = candidate;
  }
}

fn trace_ground(ray: Ray, best: ptr<function, PathHit>) {
  if (pathTracerGroundPlane.enabled == 0u) {
    return;
  }

  let plane_normal = safe_normalize(pathTracerGroundPlane.normal);
  let denominator = dot(plane_normal, ray.direction);
  if (abs(denominator) <= PATH_TRACER_EPSILON) {
    return;
  }

  let distance = -(dot(plane_normal, ray.origin) + pathTracerGroundPlane.height) / denominator;
  if (distance <= ray.t_min || distance >= (*best).distance || distance >= ray.t_max) {
    return;
  }

  set_best_hit(
    best,
    PathHit(
      1u,
      distance,
      ray.origin + ray.direction * distance,
      pathTracerGroundPlane.material_index,
      plane_normal,
      1u,
      vec3<f32>(1.0, 0.0, 0.0),
      0u
    )
  );
}

fn trace_spheres(ray: Ray, best: ptr<function, PathHit>) {
  var index = 0u;
  loop {
    if (index >= pathTracerScene.sphere_count) {
      break;
    }

    let sphere = pathTracerSpheres[index];
    let offset = ray.origin - sphere.center_radius.xyz;
    let a = dot(ray.direction, ray.direction);
    let half_b = dot(offset, ray.direction);
    let c = dot(offset, offset) - sphere.center_radius.w * sphere.center_radius.w;
    let discriminant = half_b * half_b - a * c;
    if (discriminant >= 0.0) {
      let root = sqrt(discriminant);
      var distance = (-half_b - root) / max(a, PATH_TRACER_EPSILON);
      if (distance <= ray.t_min) {
        distance = (-half_b + root) / max(a, PATH_TRACER_EPSILON);
      }
      if (distance > ray.t_min && distance < (*best).distance && distance < ray.t_max) {
        let position = ray.origin + ray.direction * distance;
        let normal = safe_normalize(position - sphere.center_radius.xyz);
        set_best_hit(
          best,
          PathHit(
            1u,
            distance,
            position,
            sphere.material_index,
            normal,
            2u,
            vec3<f32>(0.0),
            0u
          )
        );
      }
    }

    index = index + 1u;
  }
}

fn trace_triangles(ray: Ray, best: ptr<function, PathHit>) {
  var index = 0u;
  loop {
    if (index >= pathTracerScene.triangle_count) {
      break;
    }

    let triangle = pathTracerTriangles[index];
    let p0 = triangle.position0.xyz;
    let p1 = triangle.position1.xyz;
    let p2 = triangle.position2.xyz;
    let edge1 = p1 - p0;
    let edge2 = p2 - p0;
    let p_vec = cross(ray.direction, edge2);
    let determinant = dot(edge1, p_vec);
    if (abs(determinant) > PATH_TRACER_EPSILON) {
      let inverse_determinant = 1.0 / determinant;
      let t_vec = ray.origin - p0;
      let u = dot(t_vec, p_vec) * inverse_determinant;
      if (u >= 0.0 && u <= 1.0) {
        let q_vec = cross(t_vec, edge1);
        let v = dot(ray.direction, q_vec) * inverse_determinant;
        if (v >= 0.0 && u + v <= 1.0) {
          let distance = dot(edge2, q_vec) * inverse_determinant;
          if (distance > ray.t_min && distance < (*best).distance && distance < ray.t_max) {
            let w = 1.0 - u - v;
            let interpolated_normal =
              triangle.normal0.xyz * w +
              triangle.normal1.xyz * u +
              triangle.normal2.xyz * v;
            let geometric_normal = cross(edge1, edge2);
            let resolved_normal = select(
              safe_normalize(geometric_normal),
              safe_normalize(interpolated_normal),
              dot(interpolated_normal, interpolated_normal) > PATH_TRACER_EPSILON
            );
            set_best_hit(
              best,
              PathHit(
                1u,
                distance,
                ray.origin + ray.direction * distance,
                triangle.material_index,
                resolved_normal,
                3u,
                vec3<f32>(w, u, v),
                0u
              )
            );
          }
        }
      }
    }

    index = index + 1u;
  }
}

fn trace_scene(ray: Ray) -> PathHit {
  var best = miss_hit(ray);
  trace_ground(ray, &best);
  trace_spheres(ray, &best);
  trace_triangles(ray, &best);
  return best;
}

fn trace_shadow(origin: vec3<f32>, direction: vec3<f32>, max_distance: f32) -> bool {
  let shadow_ray = Ray(
    origin + direction * PATH_TRACER_EPSILON * 8.0,
    PATH_TRACER_EPSILON,
    direction,
    max_distance
  );
  return trace_scene(shadow_ray).hit == 1u;
}

fn evaluate_direct_sun(
  hit: PathHit,
  material: MaterialSample,
  view_direction: vec3<f32>
) -> vec3<f32> {
  let surface_normal = faceforward_normal(hit.normal, -view_direction);
  let sun_direction = safe_normalize(vec3<f32>(0.32, 0.91, 0.21));
  let ndotl = saturate(dot(surface_normal, sun_direction));
  if (ndotl <= 0.0) {
    return vec3<f32>(0.0);
  }

  let shadowed = trace_shadow(hit.position + surface_normal * PATH_TRACER_EPSILON * 12.0, sun_direction, pathTracerScene.max_trace_distance);
  if (shadowed) {
    return vec3<f32>(0.0);
  }

  let halfway = safe_normalize(sun_direction + view_direction);
  let base_reflectance =
    vec3<f32>(0.04) * (1.0 - material.metalness) +
    material.albedo * material.metalness;
  let fresnel = fresnel_schlick(saturate(dot(surface_normal, view_direction)), base_reflectance);
  let specular_power = 8.0 + (1.0 - material.roughness) * 120.0;
  let specular = fresnel * pow(saturate(dot(surface_normal, halfway)), specular_power) * ndotl;
  let diffuse =
    material.albedo *
    ndotl *
    PATH_TRACER_INV_PI *
    (1.0 - material.metalness);
  let sun_color = vec3<f32>(10.0, 9.4, 8.6) * max(pathTracerParams.environment_intensity, 0.0001);
  return (diffuse + specular) * sun_color;
}

fn sample_scatter(
  surface_normal: vec3<f32>,
  material: MaterialSample,
  view_direction: vec3<f32>,
  random_state: ptr<function, u32>
) -> PathScatter {
  let specular_chance = clamp(
    material.metalness * 0.75 + (1.0 - material.roughness) * 0.35,
    0.05,
    0.95
  );
  let choose_specular = random_f32(random_state) < specular_chance;
  let base_reflectance =
    vec3<f32>(0.04) * (1.0 - material.metalness) +
    material.albedo * material.metalness;

  if (choose_specular) {
    let reflected = reflect(-view_direction, surface_normal);
    let glossy_direction = safe_normalize(
      reflected + sample_unit_sphere(random_state) * material.roughness * 0.35
    );
    let attenuation = fresnel_schlick(
      saturate(dot(surface_normal, view_direction)),
      base_reflectance
    ) / specular_chance;
    return PathScatter(glossy_direction, 1.0, attenuation, 1.0);
  }

  let diffuse_direction = sample_cosine_hemisphere(surface_normal, random_state);
  let cosine = saturate(dot(surface_normal, diffuse_direction));
  let pdf = max(cosine * PATH_TRACER_INV_PI, PATH_TRACER_EPSILON);
  let attenuation =
    material.albedo *
    (1.0 - material.metalness) *
    cosine /
    max((1.0 - specular_chance) * pdf, PATH_TRACER_EPSILON);
  return PathScatter(diffuse_direction, pdf, attenuation, 0.0);
}

fn make_camera_ray(pixel: vec2<u32>, jitter: vec2<f32>, random_state: ptr<function, u32>) -> Ray {
  let image_size = vec2<f32>(
    max(f32(pathTracerParams.image_width), 1.0),
    max(f32(pathTracerParams.image_height), 1.0)
  );
  let uv = ((vec2<f32>(pixel) + jitter) / image_size) * 2.0 - vec2<f32>(1.0, 1.0);
  let tan_half_fov = tan(pathTracerCamera.vertical_fov_radians * 0.5);
  let sensor_offset =
    pathTracerCamera.right * uv.x * pathTracerCamera.aspect_ratio * tan_half_fov +
    pathTracerCamera.up * (-uv.y) * tan_half_fov;
  let focal_point =
    pathTracerCamera.origin +
    (pathTracerCamera.forward + sensor_offset) * pathTracerCamera.focus_distance;
  var origin = pathTracerCamera.origin;
  if (pathTracerCamera.aperture_radius > 0.0) {
    let lens = sample_unit_disk(random_state) * pathTracerCamera.aperture_radius;
    origin =
      origin +
      pathTracerCamera.right * lens.x +
      pathTracerCamera.up * lens.y;
  }
  return Ray(
    origin,
    PATH_TRACER_EPSILON,
    safe_normalize(focal_point - origin),
    pathTracerScene.max_trace_distance
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

  let pixel = global_id.xy;
  let index = pixel_index(pixel);
  let sample_count = max(pathTracerParams.samples_per_pixel, 1u);
  let bounce_count = max(pathTracerParams.max_bounces, 1u);
  var random_state = hash_u32(
    pathTracerParams.frame_index * 1664525u +
    index * 1013904223u +
    0x6d2b79f5u
  );
  var accumulated_radiance = vec3<f32>(0.0);
  var accumulated_normal = vec3<f32>(0.0);
  var accumulated_albedo = vec3<f32>(0.0);
  var accumulated_distance = 0.0;
  var accumulated_roughness = 0.0;
  var primary_direction = vec3<f32>(0.0, 0.0, 1.0);
  var terminal_direction = primary_direction;
  var terminal_origin = pathTracerCamera.origin;
  var terminal_throughput = vec3<f32>(1.0);
  var last_hit_kind = 0u;
  var hit_samples = 0.0;

  for (var sample_index = 0u; sample_index < sample_count; sample_index = sample_index + 1u) {
    let jitter = vec2<f32>(random_f32(&random_state), random_f32(&random_state));
    var ray = make_camera_ray(pixel, jitter, &random_state);
    primary_direction = primary_direction + ray.direction;
    var throughput = vec3<f32>(1.0);
    var sample_radiance = vec3<f32>(0.0);
    var captured_primary_hit = false;
    var current_hit_kind = 0u;

    for (var bounce_index = 0u; bounce_index < bounce_count; bounce_index = bounce_index + 1u) {
      let hit = trace_scene(ray);
      if (hit.hit == 0u) {
        sample_radiance = sample_radiance + throughput * environment_radiance(
          ray.direction,
          pathTracerParams.environment_intensity,
          pathTracerParams.environment_mode
        );
        terminal_origin = ray.origin;
        terminal_direction = ray.direction;
        current_hit_kind = 0u;
        break;
      }

      let material = load_path_material(hit.material_index);
      let surface_normal = faceforward_normal(hit.normal, ray.direction);

      if (!captured_primary_hit) {
        accumulated_normal = accumulated_normal + surface_normal;
        accumulated_distance = accumulated_distance + hit.distance;
        accumulated_albedo = accumulated_albedo + material.albedo;
        accumulated_roughness = accumulated_roughness + material.roughness;
        hit_samples = hit_samples + 1.0;
        captured_primary_hit = true;
      }

      sample_radiance = sample_radiance + throughput * material.emission;
      if (pathTracerParams.enable_next_event_estimation != 0u) {
        sample_radiance = sample_radiance + throughput * evaluate_direct_sun(
          hit,
          material,
          -ray.direction
        );
      }

      let scatter = sample_scatter(surface_normal, material, -ray.direction, &random_state);
      throughput = throughput * scatter.attenuation;
      if (luminance(throughput) <= 0.0001) {
        terminal_origin = hit.position;
        terminal_direction = scatter.direction;
        current_hit_kind = hit.primitive_kind;
        break;
      }

      if (bounce_index >= 2u) {
        let russian_roulette = clamp(luminance(throughput), 0.05, 0.95);
        if (random_f32(&random_state) > russian_roulette) {
          terminal_origin = hit.position;
          terminal_direction = scatter.direction;
          current_hit_kind = hit.primitive_kind;
          break;
        }
        throughput = throughput / russian_roulette;
      }

      ray = Ray(
        hit.position + scatter.direction * PATH_TRACER_EPSILON * 8.0,
        PATH_TRACER_EPSILON,
        scatter.direction,
        pathTracerScene.max_trace_distance
      );
      terminal_origin = ray.origin;
      terminal_direction = ray.direction;
      current_hit_kind = hit.primitive_kind;
    }

    terminal_throughput = throughput;
    last_hit_kind = max(last_hit_kind, current_hit_kind);
    accumulated_radiance = accumulated_radiance + sample_radiance;
  }

  let sample_count_f32 = f32(sample_count);
  let averaged_radiance = accumulated_radiance / sample_count_f32;
  let averaged_direction = safe_normalize(primary_direction / sample_count_f32);
  let averaged_normal = select(
    vec3<f32>(0.0, 1.0, 0.0),
    safe_normalize(accumulated_normal / max(hit_samples, 1.0)),
    hit_samples > 0.0
  );
  let averaged_distance = select(
    pathTracerScene.max_trace_distance,
    accumulated_distance / max(hit_samples, 1.0),
    hit_samples > 0.0
  );
  let averaged_albedo = select(
    vec3<f32>(0.0),
    accumulated_albedo / max(hit_samples, 1.0),
    hit_samples > 0.0
  );
  let averaged_roughness = select(
    1.0,
    accumulated_roughness / max(hit_samples, 1.0),
    hit_samples > 0.0
  );
  let hit_mask = select(0.0, 1.0, hit_samples > 0.0);

  pathStateBuffer[index] = PathState(
    vec4<f32>(terminal_throughput, f32(bounce_count)),
    vec4<f32>(terminal_origin, hit_mask),
    vec4<f32>(terminal_direction, 1.0),
    random_state,
    last_hit_kind,
    vec2<u32>(0u)
  );

  pathSampleBuffer[index] = PathSamplePixel(
    vec4<f32>(averaged_radiance * pathTracerParams.exposure, hit_mask),
    vec4<f32>(averaged_direction, averaged_distance),
    vec4<f32>(averaged_normal, averaged_roughness),
    vec4<f32>(averaged_albedo, sample_count_f32)
  );
}
