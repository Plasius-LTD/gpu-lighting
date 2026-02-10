import {
  lightingProfileNames,
  lightingTechniqueNames,
  getLightingProfile,
  getLightingTechnique,
} from "../src/index.js";

const profileList = document.getElementById("profiles");
const techniqueList = document.getElementById("techniques");

for (const profileName of lightingProfileNames) {
  const profile = getLightingProfile(profileName);
  const item = document.createElement("li");
  item.textContent = `${profile.name}: ${profile.techniques.join(", ")}`;
  profileList.appendChild(item);
}

for (const techniqueName of lightingTechniqueNames) {
  const technique = getLightingTechnique(techniqueName);
  const item = document.createElement("li");
  item.textContent = `${technique.name}: ${technique.jobs
    .map((job) => job.key)
    .join(", ")}`;
  techniqueList.appendChild(item);
}
