import { buildImagePath } from '../utils/storage';

export class StorageService {
  constructor({ assetBasePath = '/assets/images' } = {}) {
    this.assetBasePath = assetBasePath;
  }

  async uploadGallery(bucket, tenantId, files = []) {
    if (!bucket || typeof bucket.put !== 'function') {
      throw new Error(
        'Storage bucket is not available. Ensure wrangler.toml binds an R2 bucket and tests provide a mock with put/delete methods.',
      );
    }

    const uploaded = [];
    for (const file of files) {
      const key = buildImagePath(tenantId, file.filename);
      await bucket.put(key, file.data, {
        httpMetadata: { contentType: file.type },
      });

      uploaded.push({
        key,
        url: `${this.assetBasePath}/${key}`,
        contentType: file.type,
        size: file.data.byteLength,
      });
    }

    return uploaded;
  }

  async deleteFiles(bucket, keys = []) {
    if (!bucket || typeof bucket.delete !== 'function' || !keys.length) return;
    await Promise.all(keys.map((key) => bucket.delete(key)));
  }
}
