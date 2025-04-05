export class StorageService {
  async uploadFile(bucket, key, file, file_type) {
    await bucket.put(key, file, {
      httpMetadata: {
        contentType: file_type, // Preserve the content type
      },
    });
    return key;
  }

  async getFile(bucket, key) {
    const object = await bucket.get(key);
    if (!object) return null;
    return object;
  }

  async deleteFile(bucket, key) {
    await bucket.delete(key);
  }

  async deleteMultiFile(bucket, arr) {
    await Promise.all(
      arr.map(async (key) => {
        await bucket.delete(key);
      })
    );
  }
}