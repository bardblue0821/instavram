import { buildProfilePatch } from '@/src/services/profile/buildPatch';

jest.mock('@/lib/repos/userRepo', () => ({
  isHandleTaken: jest.fn(async (_h: string) => false),
}));

const { isHandleTaken } = jest.requireMock('@/lib/repos/userRepo');

describe('buildProfilePatch', () => {
  const baseProfile = { uid: 'u1', handle: 'current' } as any;

  test('displayName: required and max length', async () => {
    await expect(buildProfilePatch('displayName', '', baseProfile)).rejects.toThrow('表示名は必須');
    await expect(buildProfilePatch('displayName', 'a'.repeat(51), baseProfile)).rejects.toThrow('表示名は最大50文字');
    await expect(buildProfilePatch('displayName', 'Alice', baseProfile)).resolves.toEqual({ displayName: 'Alice' });
  });

  test('handle: format, uniqueness when changed', async () => {
    await expect(buildProfilePatch('handle', 'A', baseProfile)).rejects.toThrow('ハンドルは英数字と_ 3〜20文字');

    // unchanged handle should not call isHandleTaken
    (isHandleTaken as jest.Mock).mockClear();
    await expect(buildProfilePatch('handle', 'current', baseProfile)).resolves.toEqual({ handle: 'current' });
    expect(isHandleTaken).not.toHaveBeenCalled();

    // changed handle checks uniqueness
    (isHandleTaken as jest.Mock).mockResolvedValueOnce(true);
    await expect(buildProfilePatch('handle', 'new_id', baseProfile)).rejects.toThrow('そのハンドルは既に使用されています');

    (isHandleTaken as jest.Mock).mockResolvedValueOnce(false);
    await expect(buildProfilePatch('handle', 'new_id', baseProfile)).resolves.toEqual({ handle: 'new_id' });
  });

  test('bio: rejects URL, banned words, trims and limits to 100', async () => {
    await expect(buildProfilePatch('bio', 'see http://example.com', baseProfile)).rejects.toThrow('bio に URL は含められません');
    await expect(buildProfilePatch('bio', 'これは 禁止語 を含む', baseProfile)).rejects.toThrow('不適切な語句が含まれています');
    await expect(buildProfilePatch('bio', 'a'.repeat(101), baseProfile)).rejects.toThrow('bio は最大100文字です');
    await expect(buildProfilePatch('bio', '  改行\nや  全角　や  余分  な  スペース ', baseProfile)).resolves.toEqual({ bio: '改行 や 全角や 余分 な スペース' });
    await expect(buildProfilePatch('bio', '   ', baseProfile)).resolves.toEqual({ bio: null });
  });

  test('vrchatUrl: must be http(s) and include vrchat', async () => {
    await expect(buildProfilePatch('vrchatUrl', 'http://example.com', baseProfile)).rejects.toThrow('VRChat URL 不正');
    await expect(buildProfilePatch('vrchatUrl', 'https://vrchat.com/home/user/usr_123', baseProfile)).resolves.toEqual({ vrchatUrl: 'https://vrchat.com/home/user/usr_123' });
    await expect(buildProfilePatch('vrchatUrl', '', baseProfile)).resolves.toEqual({ vrchatUrl: null });
  });

  test('age: number 0-150 or null', async () => {
    await expect(buildProfilePatch('age', '200', baseProfile)).rejects.toThrow('年齢は0〜150');
    await expect(buildProfilePatch('age', 'not-a-number', baseProfile)).rejects.toThrow('年齢は0〜150');
    await expect(buildProfilePatch('age', '20', baseProfile)).resolves.toEqual({ age: 20 });
    await expect(buildProfilePatch('age', '', baseProfile)).resolves.toEqual({ age: null });
  });

  test('location, gender, language: passthrough string or null', async () => {
    await expect(buildProfilePatch('location', 'Tokyo', baseProfile)).resolves.toEqual({ location: 'Tokyo' });
    await expect(buildProfilePatch('location', '', baseProfile)).resolves.toEqual({ location: null });
    await expect(buildProfilePatch('gender', '男性', baseProfile)).resolves.toEqual({ gender: '男性' });
    await expect(buildProfilePatch('language', '', baseProfile)).resolves.toEqual({ language: null });
  });

  test('birthDate: YYYY-MM-DD', async () => {
    await expect(buildProfilePatch('birthDate', '2024-13-40', baseProfile)).rejects.toThrow('誕生日はYYYY-MM-DD');
    await expect(buildProfilePatch('birthDate', '1990-01-02', baseProfile)).resolves.toEqual({ birthDate: '1990-01-02' });
    await expect(buildProfilePatch('birthDate', '', baseProfile)).resolves.toEqual({ birthDate: null });
  });

  test('link: validates single string but leaves patch building to caller', async () => {
    await expect(buildProfilePatch('link', 'ftp://bad', baseProfile)).rejects.toThrow('URLはhttp/httpsのみ');
    await expect(buildProfilePatch('link', 'https://ok', baseProfile)).resolves.toEqual({});
  });
});
