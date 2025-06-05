const encryptedMessageSchema = new Schema({
  content: {
    type: String,
    encrypt: {
      algorithm: 'AEAD_AES_256_CBC_HMAC_SHA_512-Deterministic',
      keyId: process.env.ENCRYPTION_KEY_ID
    }
  }
});
