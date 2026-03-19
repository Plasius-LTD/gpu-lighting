import {
  lightingProfileNames,
  lightingTechniqueNames,
  getLightingProfile,
  getLightingTechnique,
} from "../src/index.js";

const profileList = document.getElementById("profiles");
const techniqueList = document.getElementById("techniques");
const displayBadge = document.getElementById("displayBadge");
const displayDetails = document.getElementById("displayDetails");

function setDisplayState(badge, details) {
  if (displayBadge) {
    displayBadge.textContent = badge;
  }
  if (displayDetails) {
    displayDetails.textContent = details;
  }
}

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

setDisplayState(
  "Catalog demo",
  `No 3D canvas is mounted here. This demo shows ${lightingProfileNames.length} profile(s) ` +
    `and ${lightingTechniqueNames.length} technique catalog entry point(s).`
);
