import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

// In-memory store. To switch to PostgreSQL: replace this file with a Prisma adapter
// that exposes the same interface (findById, findByEmail, create, update, delete, findAll).
const users = new Map();
const byEmail = new Map();

export const userRepository = {
  findById(id) {
    return users.get(id) ?? null;
  },

  findByEmail(email) {
    const id = byEmail.get(email.toLowerCase());
    return id ? (users.get(id) ?? null) : null;
  },

  async create({ email, password, name }) {
    const id = uuidv4();
    const passwordHash = await bcrypt.hash(password, 12);
    const user = {
      id,
      email: email.toLowerCase(),
      passwordHash,
      name,
      createdAt: new Date().toISOString(),
    };
    users.set(id, user);
    byEmail.set(email.toLowerCase(), id);
    return user;
  },

  update(id, patch) {
    const user = users.get(id);
    if (!user) return null;
    const updated = { ...user, ...patch, updatedAt: new Date().toISOString() };
    users.set(id, updated);
    return updated;
  },

  delete(id) {
    const user = users.get(id);
    if (!user) return false;
    byEmail.delete(user.email);
    users.delete(id);
    return true;
  },

  findAll() {
    return [...users.values()];
  },
};
