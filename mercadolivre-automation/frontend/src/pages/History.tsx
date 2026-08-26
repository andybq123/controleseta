import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { SentProduct } from "../lib/types";
import { Badge, Card } from "../components/ui";

export function HistoryPage() {
  const [items, setItems] = useState<SentProduct[]>([]);

  useEffect(() => {
    api<{ items: SentProduct[]; total: number }>("/products?limit=100").then((data) =>
      setItems(data.items),
    );
  }, []);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Histórico de ofertas enviadas</h2>
      <Card>
        {items.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma oferta enviada ainda.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="pb-2">Produto</th>
                <th className="pb-2">Preço</th>
                <th className="pb-2">Desconto</th>
                <th className="pb-2">Palavra-chave</th>
                <th className="pb-2">Enviado em</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="py-2 pr-4">
                    <a
                      href={item.affiliate_link || item.permalink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-brand-400 hover:underline"
                    >
                      {item.title}
                    </a>
                  </td>
                  <td className="py-2 pr-4">R$ {item.price?.toFixed(2)}</td>
                  <td className="py-2 pr-4">{item.discount_percent}%</td>
                  <td className="py-2 pr-4 text-slate-400">{item.keyword}</td>
                  <td className="py-2 pr-4 text-slate-400">
                    {new Date(item.sent_at).toLocaleString("pt-BR")}
                  </td>
                  <td className="py-2">
                    <Badge tone={item.status === "sent" ? "success" : "error"}>{item.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
