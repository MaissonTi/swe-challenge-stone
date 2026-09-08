import { Injectable } from '@nestjs/common';
import { Env, envSchema } from './env';

@Injectable()
export class EnvService {
  private readonly env: Env;

  constructor() {
    this.env = envSchema.parse(process.env);
  }

  get<K extends keyof Env>(key: K): Env[K] {
    return this.env[key];
  }
}
