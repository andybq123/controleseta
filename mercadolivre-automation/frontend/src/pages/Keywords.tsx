import { useEffect, useState, type FormEvent } from "react";
import { api } from "../lib/api";
import type { Keyword } from "../lib/types";
import { Badge, Button, Card, Input } from "../components/ui";

export function KeywordsPage() {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [term, setTerm] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    const data = await api<Keyword[]>("/keywords");
    setKeywords(data);
  }

  useEffect(() => {
    load();
  }, []);

  async function addKeyword(event: FormEvent) {
    event.preventDefault();
    if (!term.trim()) return;
    setLoading(true);
    try {
      await api("/keywords", { method: "POST", body: JSON.stringify({ term: term.trim() }) });
      setTerm("");
      await load();
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(keyword: Keyword) {
    await api(`/keywords/${keyword.id}`, {
      method: "PUT",
      body: JSON.stringify({ active: keyword.active === 1 ? false : true }),
    });
    await load();
  }

  async function remove(keyword: Keyword) {
    await api(`/keywords/${keyword.id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h2 className="text-xl font-semibold">Palavras-chave e categorias</h2>
      <p className="text-sm text-slate-500">
        A automação busca ofertas no Mercado Livre para cada termo ativo abaixo (ex.: "notebook", "fone de
        ouvido bluetooth", "air fryer").
      </p>

      <Card>
        <form onSubmit={addKeyword} className="flex gap-2">
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Ex.: smartwatch"
          />
          <Button type="submit" disabled={loading}>
            Adicionar
          </Button>
        </form>
      </Card>

      <Card>
        {keywords.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma palavra-chave cadastrada ainda.</p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {keywords.map((keyword) => (
              <li key={keyword.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm">{keyword.term}</span>
                  {keyword.active === 1 ? (
                    <Badge tone="success">ativa</Badge>
                  ) : (
                    <Badge tone="warning">pausada</Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => toggleActive(keyword)}>
                    {keyword.active === 1 ? "Pausar" : "Ativar"}
                  </Button>
                  <Button variant="danger" onClick={() => remove(keyword)}>
                    Remover
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
