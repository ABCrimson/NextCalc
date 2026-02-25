/**
 * RSA Encryption Algorithm
 *
 * RSA (Rivest–Shamir–Adleman) is one of the first public-key cryptosystems
 * and is widely used for secure data transmission.
 *
 * Security is based on the practical difficulty of factoring the product of
 * two large prime numbers (the "factoring problem").
 *
 * Key Generation:
 * 1. Choose two large prime numbers p and q
 * 2. Compute n = p × q (modulus)
 * 3. Compute φ(n) = (p-1)(q-1) (Euler's totient)
 * 4. Choose e such that 1 < e < φ(n) and gcd(e, φ(n)) = 1 (public exponent)
 * 5. Compute d = e⁻¹ mod φ(n) (private exponent)
 * 6. Public key: (e, n), Private key: (d, n)
 *
 * Encryption: c = m^e mod n
 * Decryption: m = c^d mod n
 */

/**
 * RSA key pair
 */
export interface RSAKeyPair {
  /** Public key */
  readonly publicKey: {
    readonly e: bigint; // Public exponent
    readonly n: bigint; // Modulus
  };
  /** Private key */
  readonly privateKey: {
    readonly d: bigint; // Private exponent
    readonly n: bigint; // Modulus
  };
  /** Original primes (for educational purposes only) */
  readonly primes?: {
    readonly p: bigint;
    readonly q: bigint;
  };
}

// ============================================================================
// NUMBER THEORY UTILITIES
// ============================================================================

/**
 * Compute Greatest Common Divisor using Euclidean algorithm
 * Time Complexity: O(log(min(a, b)))
 */
export function gcd(a: bigint, b: bigint): bigint {
  let [x, y] = [a, b];
  while (y !== 0n) {
    [x, y] = [y, x % y];
  }
  return x;
}

/**
 * Extended Euclidean Algorithm
 * Finds x, y such that ax + by = gcd(a, b)
 * Returns [gcd, x, y]
 */
export function extendedGCD(a: bigint, b: bigint): [bigint, bigint, bigint] {
  if (b === 0n) {
    return [a, 1n, 0n];
  }

  const [gcd, x1, y1] = extendedGCD(b, a % b);
  const x = y1;
  const y = x1 - (a / b) * y1;

  return [gcd, x, y];
}

/**
 * Compute modular multiplicative inverse
 * Find x such that (a × x) ≡ 1 (mod m)
 * Returns null if inverse doesn't exist
 */
export function modInverse(a: bigint, m: bigint): bigint | null {
  const [g, x, _] = extendedGCD(a, m);

  if (g !== 1n) {
    return null; // Inverse doesn't exist
  }

  // Ensure positive result
  return ((x % m) + m) % m;
}

/**
 * Modular exponentiation: (base^exponent) mod modulus
 * Uses binary exponentiation for efficiency
 * Time Complexity: O(log(exponent))
 */
export function modPow(base: bigint, exponent: bigint, modulus: bigint): bigint {
  if (modulus === 1n) return 0n;

  let result = 1n;
  base = base % modulus;

  while (exponent > 0n) {
    if (exponent % 2n === 1n) {
      result = (result * base) % modulus;
    }
    exponent = exponent / 2n;
    base = (base * base) % modulus;
  }

  return result;
}

/**
 * Miller-Rabin primality test
 * Probabilistic algorithm for testing if a number is prime
 * Time Complexity: O(k × log³(n)) where k is number of rounds
 *
 * @param n - Number to test
 * @param rounds - Number of test rounds (default: 40, error probability < 2^-80)
 */
export function isProbablyPrime(n: bigint, rounds = 40): boolean {
  if (n < 2n) return false;
  if (n === 2n || n === 3n) return true;
  if (n % 2n === 0n) return false;

  // Write n-1 as 2^r × d
  let d = n - 1n;
  let r = 0n;
  while (d % 2n === 0n) {
    d /= 2n;
    r++;
  }

  // Miller-Rabin test
  witnessLoop: for (let i = 0; i < rounds; i++) {
    // Random witness a in [2, n-2]
    const a = 2n + BigInt(Math.floor(Math.random() * Number(n - 4n)));

    let x = modPow(a, d, n);

    if (x === 1n || x === n - 1n) {
      continue;
    }

    for (let j = 0n; j < r - 1n; j++) {
      x = modPow(x, 2n, n);
      if (x === n - 1n) {
        continue witnessLoop;
      }
    }

    return false; // Composite
  }

  return true; // Probably prime
}

/**
 * Generate a random prime number with specified bit length
 * Uses Miller-Rabin test for primality checking
 */
export function generatePrime(bits: number): bigint {
  const min = 2n ** BigInt(bits - 1);
  const max = 2n ** BigInt(bits) - 1n;

  while (true) {
    // Generate random odd number
    let candidate = min + BigInt(Math.floor(Math.random() * Number(max - min)));
    if (candidate % 2n === 0n) candidate++;

    if (isProbablyPrime(candidate)) {
      return candidate;
    }
  }
}

// ============================================================================
// RSA IMPLEMENTATION
// ============================================================================

/**
 * Generate RSA key pair
 *
 * @param bits - Key size in bits (e.g., 1024, 2048, 4096)
 *               Note: For demonstration, use smaller values like 16-32 bits
 * @param includePrivates - Include original primes (educational only)
 * @returns RSA key pair
 *
 * Time Complexity: O(bits³) for key generation
 */
export function generateRSAKeyPair(
  bits: number,
  includePrivates = false
): RSAKeyPair {
  // Generate two distinct prime numbers
  const p = generatePrime(bits / 2);
  let q = generatePrime(bits / 2);

  // Ensure p ≠ q
  while (q === p) {
    q = generatePrime(bits / 2);
  }

  // Compute modulus
  const n = p * q;

  // Compute Euler's totient function
  const phi = (p - 1n) * (q - 1n);

  // Choose public exponent e (commonly 65537)
  let e = 65537n;

  // Ensure e < phi and gcd(e, phi) = 1
  if (e >= phi) {
    e = 3n; // Fallback for small keys
  }

  while (gcd(e, phi) !== 1n) {
    e += 2n;
  }

  // Compute private exponent d
  const d = modInverse(e, phi);

  if (d === null) {
    throw new Error('Failed to compute private exponent');
  }

  const keyPair: RSAKeyPair = {
    publicKey: { e, n },
    privateKey: { d, n },
  };

  if (includePrivates) {
    return {
      ...keyPair,
      primes: { p, q },
    };
  }

  return keyPair;
}

/**
 * Encrypt a message using RSA public key
 *
 * @param message - Message as BigInt (must be < n)
 * @param publicKey - RSA public key
 * @returns Encrypted ciphertext
 *
 * Time Complexity: O(log³(n)) for modular exponentiation
 */
export function rsaEncrypt(
  message: bigint,
  publicKey: { e: bigint; n: bigint }
): bigint {
  const { e, n } = publicKey;

  if (message >= n) {
    throw new Error('Message is too large for this key size');
  }

  if (message < 0n) {
    throw new Error('Message must be non-negative');
  }

  // c = m^e mod n
  return modPow(message, e, n);
}

/**
 * Decrypt a ciphertext using RSA private key
 *
 * @param ciphertext - Encrypted ciphertext
 * @param privateKey - RSA private key
 * @returns Decrypted message
 *
 * Time Complexity: O(log³(n)) for modular exponentiation
 */
export function rsaDecrypt(
  ciphertext: bigint,
  privateKey: { d: bigint; n: bigint }
): bigint {
  const { d, n } = privateKey;

  if (ciphertext >= n) {
    throw new Error('Ciphertext is invalid for this key');
  }

  // m = c^d mod n
  return modPow(ciphertext, d, n);
}

/**
 * Encrypt a string message (for demonstration)
 * Splits string into blocks and encrypts each block
 */
export function rsaEncryptString(
  message: string,
  publicKey: { e: bigint; n: bigint }
): ReadonlyArray<bigint> {
  const { n } = publicKey;

  // Determine block size (bytes that fit in n)
  const maxBlockSize = Math.floor((n.toString(2).length - 1) / 8);

  const blocks: bigint[] = [];
  const messageBytes = new TextEncoder().encode(message);

  for (let i = 0; i < messageBytes.length; i += maxBlockSize) {
    const blockBytes = messageBytes.slice(i, i + maxBlockSize);

    // Convert bytes to BigInt
    let blockValue = 0n;
    for (const byte of blockBytes) {
      blockValue = (blockValue << 8n) + BigInt(byte);
    }

    blocks.push(rsaEncrypt(blockValue, publicKey));
  }

  return blocks;
}

/**
 * Decrypt string message
 */
export function rsaDecryptString(
  ciphertext: ReadonlyArray<bigint>,
  privateKey: { d: bigint; n: bigint }
): string {
  const { n } = privateKey;
  const maxBlockSize = Math.floor((n.toString(2).length - 1) / 8);

  let message = '';

  for (const block of ciphertext) {
    const decrypted = rsaDecrypt(block, privateKey);

    // Convert BigInt back to bytes
    const bytes: number[] = [];
    let value = decrypted;

    while (value > 0n) {
      bytes.unshift(Number(value & 0xFFn));
      value >>= 8n;
    }

    // Pad to block size if needed
    while (bytes.length < maxBlockSize && bytes.length > 0) {
      bytes.unshift(0);
    }

    message += new TextDecoder().decode(new Uint8Array(bytes));
  }

  return message;
}

/**
 * Digital signature using RSA
 * Sign a message by "encrypting" with private key
 */
export function rsaSign(
  message: bigint,
  privateKey: { d: bigint; n: bigint }
): bigint {
  // Signature = m^d mod n
  return rsaDecrypt(message, privateKey);
}

/**
 * Verify digital signature
 * Verify by "decrypting" signature with public key
 */
export function rsaVerify(
  message: bigint,
  signature: bigint,
  publicKey: { e: bigint; n: bigint }
): boolean {
  // Recovered message = signature^e mod n
  const recovered = rsaEncrypt(signature, publicKey);
  return recovered === message;
}

/**
 * Example usage demonstration
 */
export function rsaExample(): void {
  console.log('=== RSA Encryption Demo ===\n');

  // Generate keys (use small key for demonstration)
  console.log('Generating RSA key pair (16-bit)...');
  const keyPair = generateRSAKeyPair(16, true);

  console.log('Public key (e, n):', keyPair.publicKey.e, keyPair.publicKey.n);
  console.log('Private key (d, n):', keyPair.privateKey.d, keyPair.privateKey.n);

  if (keyPair.primes) {
    console.log('Primes (p, q):', keyPair.primes.p, keyPair.primes.q);
  }

  // Encrypt and decrypt a number
  const message = 42n;
  console.log('\nOriginal message:', message);

  const encrypted = rsaEncrypt(message, keyPair.publicKey);
  console.log('Encrypted:', encrypted);

  const decrypted = rsaDecrypt(encrypted, keyPair.privateKey);
  console.log('Decrypted:', decrypted);
  console.log('Match:', message === decrypted);
}
