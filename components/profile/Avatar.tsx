"use client";
import React from 'react';

type Props = {
  src?: string | null;
  alt?: string;
  size?: number; // px
  onClick?: () => void;
  interactive?: boolean; // button or static box
  withBorder?: boolean; // show border around avatar
  className?: string;
};

export function Avatar({ src, alt = 'ユーザーアイコン', size = 96, onClick, interactive = true, withBorder = true, className = '' }: Props) {
  const s = { width: size, height: size } as const;
  const base = `overflow-hidden rounded-lg ${withBorder ? 'border' : ''} ${className}`.trim();
  if (interactive) {
    return (
      <button type="button" onClick={onClick} aria-label="アイコンを表示" className={`inline-block ${base}`} style={s}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={alt} width={size} height={size} className="block object-cover w-full h-full" />
        ) : (
          <div className="w-full h-full bg-gray-200" />
        )}
      </button>
    );
  }
  return (
    <div className={`inline-block ${base}`} style={s} aria-label={alt}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} width={size} height={size} className="block object-cover w-full h-full" />
      ) : (
        <div className="w-full h-full bg-gray-200" />
      )}
    </div>
  );
}

export default Avatar;
