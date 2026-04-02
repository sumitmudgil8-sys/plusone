import { v2 as cloudinary } from 'cloudinary';

// Lazy-configure so missing env vars only throw at call time, not build time.
function getCloudinary() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      'Cloudinary env vars are not set (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET)'
    );
  }

  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
  return cloudinary;
}

export type UploadFolder = 'avatars' | 'companion-gallery' | 'verification-docs';

export interface UploadResult {
  url: string;
  publicId: string;
  width?: number;
  height?: number;
  format: string;
  bytes: number;
}

const FOLDER_TRANSFORMS: Record<UploadFolder, object> = {
  avatars: {
    transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face', quality: 85, fetch_format: 'webp' }],
  },
  'companion-gallery': {
    transformation: [{ width: 800, height: 600, crop: 'limit', quality: 85, fetch_format: 'webp' }],
  },
  'verification-docs': {
    // No transformation — preserve document fidelity for ID verification
  },
};

/**
 * Uploads a file buffer to Cloudinary.
 * @param buffer  Raw file bytes
 * @param folder  Destination folder (controls transforms + organisation)
 * @param publicId  Optional fixed public_id (used for avatar replacement)
 */
export async function uploadToCloudinary(
  buffer: Buffer,
  folder: UploadFolder,
  publicId?: string
): Promise<UploadResult> {
  const cld = getCloudinary();

  const options: Record<string, unknown> = {
    folder: `plus-one/${folder}`,
    resource_type: 'auto',
    overwrite: true,
    ...FOLDER_TRANSFORMS[folder],
  };

  if (publicId) {
    options.public_id = publicId;
  }

  const result = await new Promise<Record<string, unknown>>((resolve, reject) => {
    const stream = cld.uploader.upload_stream(options, (error, result) => {
      if (error || !result) return reject(error ?? new Error('Upload failed'));
      resolve(result as Record<string, unknown>);
    });
    stream.end(buffer);
  });

  return {
    url: result.secure_url as string,
    publicId: result.public_id as string,
    width: result.width as number | undefined,
    height: result.height as number | undefined,
    format: result.format as string,
    bytes: result.bytes as number,
  };
}

/**
 * Deletes a file from Cloudinary by its public_id.
 * Best-effort — does not throw if deletion fails.
 */
export async function deleteFromCloudinary(publicId: string): Promise<void> {
  try {
    const cld = getCloudinary();
    await cld.uploader.destroy(publicId);
  } catch (err) {
    console.error('Cloudinary delete error (non-fatal):', err);
  }
}
