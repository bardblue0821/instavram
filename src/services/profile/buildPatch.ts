import { isHandleTaken } from '../../../lib/repos/userRepo';

export type ProfilePatch = Record<string, any>;

/**
 * Build a partial user profile patch from a field + raw value with validation.
 * Throws if invalid.
 */
export async function buildProfilePatch(
  field: string,
  rawInput: string,
  profile: any,
): Promise<ProfilePatch> {
  const patch: any = {};
  const raw = (rawInput ?? '').trim();

  switch (field) {
    case 'displayName': {
      if (!raw) throw new Error('表示名は必須');
      if (raw.length > 50) throw new Error('表示名は最大50文字');
      patch.displayName = raw;
      break;
    }
    case 'handle': {
      const h = raw.toLowerCase();
      if (!/^[a-z0-9_]{3,20}$/.test(h)) throw new Error('ハンドルは英数字と_ 3〜20文字');
      if (profile.handle !== h) {
        const taken = await isHandleTaken(h);
        if (taken) throw new Error('そのハンドルは既に使用されています');
      }
      patch.handle = h;
      break;
    }
    case 'bio': {
      const banned = ['禁止語'];
      if (/(https?:\/\/|www\.)/i.test(raw)) throw new Error('bio に URL は含められません');
      if (banned.some((w) => raw.toLowerCase().includes(w))) throw new Error('不適切な語句が含まれています');
      let b = raw
        .replace(/[\r\n]+/g, ' ')
        .replace(/[\u3000]+/g, '')
        .replace(/ {2,}/g, ' ')
        .trim();
      if (b.length > 100) throw new Error('bio は最大100文字です');
      patch.bio = b || null;
      break;
    }
    case 'vrchatUrl': {
      if (raw) {
        if (!/^https?:\/\//.test(raw) || !/vrchat/i.test(raw)) throw new Error('VRChat URL 不正');
        patch.vrchatUrl = raw;
      } else patch.vrchatUrl = null;
      break;
    }
    case 'language': {
      patch.language = raw || null;
      break;
    }
    case 'gender': {
      patch.gender = raw || null;
      break;
    }
    case 'age': {
      if (raw) {
        const n = Number(raw);
        if (Number.isNaN(n) || n < 0 || n > 150) throw new Error('年齢は0〜150');
        patch.age = n;
      } else patch.age = null;
      break;
    }
    case 'location': {
      patch.location = raw || null;
      break;
    }
    case 'birthDate': {
      if (raw && !/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new Error('誕生日はYYYY-MM-DD');
      patch.birthDate = raw || null;
      break;
    }
    case 'link': {
      // For link field, this function expects caller to build full array; keep here for completeness
      // But allow validation of a single link string
      if (raw && !/^https?:\/\//.test(raw)) throw new Error('URLはhttp/httpsのみ');
      // Caller should set patch.links appropriately
      break;
    }
    default: {
      // Unknown field, no-op
    }
  }

  return patch;
}
