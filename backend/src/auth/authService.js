import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import { userRepository } from '../repositories/userRepository.js';

export const authService = {
  async register({ email, password, name }) {
    if (userRepository.findByEmail(email)) {
      const err = new Error('Email already registered');
      err.status = 409;
      throw err;
    }
    const user = await userRepository.create({ email, password, name });
    const token = this._issueToken(user);
    return { user: this._sanitize(user), token };
  },

  async login({ email, password }) {
    const user = userRepository.findByEmail(email);
    if (!user) {
      const err = new Error('Invalid credentials');
      err.status = 401;
      throw err;
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      const err = new Error('Invalid credentials');
      err.status = 401;
      throw err;
    }
    const token = this._issueToken(user);
    return { user: this._sanitize(user), token };
  },

  me(userId) {
    const user = userRepository.findById(userId);
    if (!user) {
      const err = new Error('User not found');
      err.status = 404;
      throw err;
    }
    return this._sanitize(user);
  },

  _issueToken(user) {
    return jwt.sign(
      { userId: user.id, email: user.email },
      config.auth.jwtSecret,
      { expiresIn: config.auth.jwtExpiresIn }
    );
  },

  _sanitize({ id, email, name, createdAt }) {
    return { id, email, name, createdAt };
  },
};
