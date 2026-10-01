// SPDX-License-Identifier: MIT
// Literal copy of the standalone component's cosmetic pool. The site owns
// initial naming through nameProvider so a fresh visit needs no naming RPC.
const defaultNames = [
  "Plato",
  "Sappho",
  "Hypatia",
  "Cicero",
  "Cato",
  "Marcus Aurelius",
  "Aurelia",
  "Livia",
  "Ovid",
  "Seneca",
  "Ariadne",
  "Daphne",
  "Lucius",
  "Octavia",
  "Vergil",
  "Claudia",
  "Dion",
  "Theon",
  "Julia",
  "Titus",
  "Aelia",
  "Cornelia",
];
export function randomClassicalName() {
  return defaultNames[Math.floor(Math.random() * defaultNames.length)]!;
}
