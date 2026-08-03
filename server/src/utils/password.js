import bcrypt from "bcryptjs";

// bcryptjs (не bcrypt) — навмисно: чиста JS-реалізація без нативної
// компіляції (node-gyp/build tools), той самий API. Для "легкого бека"
// (backend-mvp-plan.md) це менше шансів на зламану локальну установку,
// особливо на Windows без Visual Studio Build Tools.
const SALT_ROUNDS = 10;

export function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

export function verifyPassword(plainPassword, passwordHash) {
  return bcrypt.compare(plainPassword, passwordHash);
}
