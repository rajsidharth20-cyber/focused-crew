import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const limits = { avatars: 2 * 1024 * 1024, social: 8 * 1024 * 1024, 'group-images': 8 * 1024 * 1024 } as const;
type Bucket = keyof typeof limits;

function inspectImage(bytes: Uint8Array): { mime: string; ext: string } | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return { mime: 'image/png', ext: 'png' };
  if (bytes.length >= 6 && new TextDecoder().decode(bytes.subarray(0, 6)).match(/^GIF8[79]a$/)) return { mime: 'image/gif', ext: 'gif' };
  if (bytes.length >= 12 && new TextDecoder().decode(bytes.subarray(0, 4)) === 'RIFF' && new TextDecoder().decode(bytes.subarray(8, 12)) === 'WEBP') return { mime: 'image/webp', ext: 'webp' };
  if (bytes.length >= 12 && new TextDecoder().decode(bytes.subarray(4, 8)) === 'ftyp') {
    const brand = new TextDecoder().decode(bytes.subarray(8, 12)).toLowerCase();
    if (['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(brand)) return { mime: brand.startsWith('hei') ? 'image/heic' : 'image/heif', ext: brand.startsWith('hei') ? 'heic' : 'heif' };
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response('Unauthorized', { status: 401, headers: corsHeaders });

    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) return new Response('Unauthorized', { status: 401, headers: corsHeaders });

    const body = await req.json();
    const bucket = body.bucket as Bucket;
    if (!Object.hasOwn(limits, bucket) || typeof body.bytes !== 'string' || body.bytes.length > 11_200_000) {
      return new Response('Invalid upload request', { status: 400, headers: corsHeaders });
    }

    let bytes: Uint8Array;
    try {
      const binary = atob(body.bytes);
      bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    } catch {
      return new Response('Invalid image encoding', { status: 400, headers: corsHeaders });
    }

    if (bytes.length < 1 || bytes.length > limits[bucket]) return new Response('Image is too large', { status: 413, headers: corsHeaders });
    const image = inspectImage(bytes);
    if (!image) return new Response('Unsupported or invalid image', { status: 415, headers: corsHeaders });

    const admin = createClient(url, serviceKey);
    let path: string;
    if (bucket === 'avatars') {
      path = `${user.id}/avatar-${crypto.randomUUID()}.${image.ext}`;
    } else if (bucket === 'social') {
      if (body.folder !== 'posts' && body.folder !== 'stories') return new Response('Invalid folder', { status: 400, headers: corsHeaders });
      path = `${user.id}/${body.folder}/${crypto.randomUUID()}.${image.ext}`;
    } else {
      if (typeof body.groupId !== 'string') return new Response('Invalid group', { status: 400, headers: corsHeaders });
      const { data: membership } = await admin.from('group_members').select('id').eq('group_id', body.groupId).eq('user_id', user.id).maybeSingle();
      if (!membership) return new Response('Forbidden', { status: 403, headers: corsHeaders });
      path = `${body.groupId}/${user.id}-${crypto.randomUUID()}.${image.ext}`;
    }

    const { error } = await admin.storage.from(bucket).upload(path, bytes, { contentType: image.mime, upsert: false, cacheControl: bucket === 'avatars' ? '31536000' : '3600' });
    if (error) throw error;
    return new Response(JSON.stringify({ path }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Secure image upload failed', error instanceof Error ? error.message : 'unknown');
    return new Response('Upload failed', { status: 500, headers: corsHeaders });
  }
});