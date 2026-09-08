import { Argon2Hasher } from '@/infra/cryptography/argon2-hasher';

describe('Argon2Hasher', () => {
  const hasher = new Argon2Hasher();

  it('produces an argon2id hash distinct from the plain password', async () => {
    const hash = await hasher.hash('Password1');

    expect(hash).not.toEqual('Password1');
    expect(hash).toMatch(/^\$argon2id\$/);
  });

  it('round-trips: compare() succeeds for the correct password', async () => {
    const hash = await hasher.hash('Password1');

    await expect(hasher.compare('Password1', hash)).resolves.toBe(true);
  });

  it('compare() fails for the wrong password', async () => {
    const hash = await hasher.hash('Password1');

    await expect(hasher.compare('WrongPassword', hash)).resolves.toBe(false);
  });

  it('produces a different hash each time (random salt)', async () => {
    const [first, second] = await Promise.all([
      hasher.hash('Password1'),
      hasher.hash('Password1'),
    ]);

    expect(first).not.toEqual(second);
  });
});
