export default function ProductImage({
  name,
  className = "w-9 h-9 p-1",
}: {
  name?: string;
  className?: string;
}) {
  return (
    <div
      className={`bg-blue-50 border border-blue-100 rounded-lg flex items-center justify-center shrink-0 overflow-hidden ${className}`}
    >
      <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <path d="M45 70 L50 50 L55 70 L75 75 L55 80 L50 100 L45 80 L25 75 Z" fill="#38bdf8" />
        <path d="M155 90 L160 75 L165 90 L180 95 L165 100 L160 115 L155 100 L140 95 Z" fill="#38bdf8" />
        <path d="M70 30 C70 30, 85 55, 100 55 C115 55, 130 30, 130 30 L145 65 L125 90 L75 90 L55 65 Z" fill="#e0f2fe" stroke="#1e1b4b" strokeWidth="10" strokeLinejoin="round" />
        <path d="M75 90 L125 90 L150 165 C150 165, 125 180, 100 175 C75 180, 50 165, 50 165 Z" fill="#3b82f6" stroke="#1e1b4b" strokeWidth="10" strokeLinejoin="round" />
        <path d="M85 130 C85 130, 80 160, 95 170" stroke="#e0f2fe" strokeWidth="8" strokeLinecap="round" />
        <path d="M115 140 C115 140, 120 160, 122 170" stroke="#e0f2fe" strokeWidth="8" strokeLinecap="round" />
      </svg>
    </div>
  );
}