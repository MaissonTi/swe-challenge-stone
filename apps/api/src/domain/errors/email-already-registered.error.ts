export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super('Email already registered');
    this.name = 'EmailAlreadyRegisteredError';
  }
}
