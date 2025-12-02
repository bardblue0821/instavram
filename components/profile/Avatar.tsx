"use client";
import React from 'react';

type Props = {
  src?: string | null;
  alt?: string;
  size?: number; // px
  onClick?: () => void;
};

export function Avatar({ src, alt = 'ユーザーアイコン', size = 96, onClick }: Props) {
  const s = { width: size, height: size } as const;
  return (
    <button type="button" onClick={onClick} aria-label="アイコンを表示" className="inline-block overflow-hidden border rounded-lg" style={s}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} width={size} height={size} className="object-cover w-full h-full" />
      ) : (
        <div className="w-full h-full bg-gray-200" />
      )}
    </button>
  );
}

export default Avatar;
