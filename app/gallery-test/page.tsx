import GalleryGrid, { type PhotoItem } from "@/components/gallery/GalleryGrid";

export const dynamic = "force-static"; // デモ用（SSG）

const photos: PhotoItem[] = [
  { src: "/next.svg", width: 1200, height: 800, alt: "Next.js" },
  { src: "/vercel.svg", width: 1200, height: 800, alt: "Vercel" },
  { src: "/globe.svg", width: 1200, height: 800, alt: "Globe" },
  { src: "/window.svg", width: 1200, height: 800, alt: "Window" },
  { src: "/file.svg", width: 1200, height: 800, alt: "File" },
  { src: "/next.svg", width: 1200, height: 800, alt: "Next.js 2" },
  { src: "/vercel.svg", width: 1200, height: 800, alt: "Vercel 2" },
  { src: "/globe.svg", width: 1200, height: 800, alt: "Globe 2" },
];

export default function Page() {
  return (
    <main className="max-w-6xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Gallery Test</h1>
      <p className="fg-subtle mb-6">next/image + React Photo Gallery + lightGallery のデモ</p>
      <GalleryGrid photos={photos} rowHeight={240} />
      <div className="mt-8 fg-subtle text-sm">
        <p>
          デモでは public の SVG を使っています。実運用では /public/photos などに画像を配置するか、S3/Cloudinary 等に置いて remotePatterns/loader を設定してください。
        </p>
      </div>
    </main>
  );
}
