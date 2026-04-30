export default function ComingSoon({ title }: { title: string }) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-onix-900">{title}</h2>
      <div className="bg-white border border-dashed border-onix-100 rounded-xl p-12 text-center">
        <p className="text-onix-900 font-medium">Em construção</p>
        <p className="text-sm text-g60 mt-1">
          Esta aba será implementada na Fase 3 — migrando do single-file
          original do Club Park Butantã.
        </p>
      </div>
    </div>
  );
}
