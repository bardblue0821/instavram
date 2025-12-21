"use client";
import AuthForm from "../components/AuthForm";
import ThemeSwitch from "../components/ThemeSwitch";

export default function Home() {
  return (
    <div className="min-h-[calc(100vh-56px)] grid grid-cols-1 md:grid-cols-2">
      <section className="hidden md:flex items-center justify-center p-8 bg-linear-to-br from-teal-600 via-teal-500 to-cyan-500 text-white">
        <div className="max-w-md space-y-4">
          <h1 className="text-4xl font-extrabold leading-tight">瞬間を、つなぐ。</h1>
          <p className="text-lg opacity-90">友だちと、いまこの瞬間を共有しよう。写真も、アルバムも、もっとシンプルに。</p>
          <ul className="space-y-1 text-sm opacity-90">
            <li>• スマートなアルバム共有</li>
            <li>• フレンドとウォッチで発見</li>
            <li>• タイムラインで最新をチェック</li>
          </ul>
        </div>
      </section>
      <section className="flex items-center justify-center p-6">
        <div>
          <AuthForm />
          <div className="mt-6">
            {/*<ThemeSwitch />*/}
          </div>
        </div>
      </section>
    </div>
  );
}
