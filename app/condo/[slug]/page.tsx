export default async function VisaoGeralPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await params;
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-onix-900">Visão Geral</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="Inadimplência" value="—" hint="Conecte os dados financeiros" />
        <Card title="Apontamentos abertos" value="—" hint="Aba Engenharia" />
        <Card title="Processos jurídicos" value="—" hint="Aba Jurídico" />
      </div>
      <div className="bg-white border border-onix-100 rounded-xl p-6">
        <h3 className="font-medium text-onix-900">Notas da síndica</h3>
        <p className="text-sm text-g60 mt-1">
          Em breve: bloco de notas com auto-save (substitui cpb_pvr_notas).
        </p>
      </div>
    </div>
  );
}

function Card({
  title,
  value,
  hint,
}: {
  title: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="bg-white border border-onix-100 rounded-xl p-5">
      <p className="text-sm text-g60">{title}</p>
      <p className="text-3xl font-semibold text-onix-900 mt-1">{value}</p>
      <p className="text-xs text-g60 mt-2">{hint}</p>
    </div>
  );
}
