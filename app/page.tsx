import Image from "next/image";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <Image
        src="/logo.png"
        alt="Mandi Plus"
        width={757}
        height={203}
        preload
        className="h-auto w-64 sm:w-80"
      />
      <h1 className="text-3xl font-semibold text-brand">Bolo</h1>
      <p className="max-w-md text-lg">Voice billing for the mandi counter.</p>
    </main>
  );
}
