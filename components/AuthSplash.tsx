export default function AuthSplash({
  label = "Checking your session...",
}: {
  label?: string;
}) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center bg-gradient-to-br from-[#dff3ff] via-[#eef8ff] to-[#cbe8fb]">
      <div className="flex flex-col items-center gap-4 text-[#0b2559]">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#0ea5e9]/25 border-t-[#0284c7]" />
        <p className="text-sm font-bold tracking-wide">{label}</p>
      </div>
    </div>
  );
}
