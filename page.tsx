"use client";

import { useMemo, useState } from "react";

type Scenario = "realist" | "best" | "worst";

const defaults = { age: 58, capital: 2500000, annualIncome: 58000, inflation: 3, returnRate: 4, tax: 27 };
const scenarioLabels: Record<Scenario, string> = { realist: "Realista", best: "Favorable", worst: "Exigent" };
const scenarioAdjustments: Record<Scenario, { returnRate: number; inflation: number }> = {
  realist: { returnRate: 0, inflation: 0 }, best: { returnRate: 1, inflation: -0.5 }, worst: { returnRate: -1.5, inflation: 0.5 },
};

function formatEuro(value: number, compact = false) {
  if (compact && Math.abs(value) >= 1000000) return `${(value / 1000000).toFixed(2).replace(".", ",")} M€`;
  if (compact && Math.abs(value) >= 1000) return `${Math.round(value / 1000)} k€`;
  return new Intl.NumberFormat("ca-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}
function formatPercent(value: number) { return `${value.toFixed(1).replace(".", ",")}%`; }

const strategyNames = [
  ["fixed", "Retirada fixa", "Estable", 0.92],
  ["four_percent", "Regla del 4%", "Equilibrada", 0.82],
  ["guyton_klinger", "Guyton-Klinger", "Guardrails", 0.68],
  ["vpw", "VPW", "Variable", 0.62],
  ["adaptive", "Retirada adaptativa", "Flexible", 0.54],
] as const;

function StrategyPanel({ rows }: { rows: Array<{ name: string; type: string; terminal: number; risk: number; recommended: boolean }> }) {
  return <section className="panel strategies-panel"><div className="panel-heading"><div><span className="muted-label">COMPARADOR</span><h2>Cinc maneres de retirar</h2></div><span className="strategy-count">Primera estimació</span></div><p className="strategy-intro">La retirada adaptativa redueix la despesa quan el patrimoni entra en tensió i la recupera quan la trajectòria millora.</p><div className="strategy-table"><div className="strategy-table-head"><span>ESTRATÈGIA</span><span>PATRIMONI FINAL</span><span>RISC ESTIMAT</span><span>ESTAT</span></div>{rows.map((row) => <div className={`strategy-row ${row.recommended ? "recommended" : ""}`} key={row.name}><div><strong>{row.name}</strong><small>{row.type}</small></div><strong>{formatEuro(row.terminal, true)}</strong><span className={row.risk < 5 ? "low-risk" : "mid-risk"}>{formatPercent(row.risk)}</span><span className="strategy-status">{row.recommended ? "Recomanada" : "Comparar"}</span></div>)}</div></section>;
}

export default function Home() {
  const [scenario, setScenario] = useState<Scenario>("realist");
  const [inputs, setInputs] = useState(defaults);
  const [activeView, setActiveView] = useState("Resum");
  const [runCount, setRunCount] = useState(0);
  const projection = useMemo(() => {
    const adjustment = scenarioAdjustments[scenario];
    const returnRate = (inputs.returnRate + adjustment.returnRate) / 100;
    const inflation = (inputs.inflation + adjustment.inflation) / 100;
    const balances = [inputs.capital];
    let income = inputs.annualIncome;
    let spending = inputs.annualIncome * 0.58;
    for (let index = 1; index < 16; index += 1) {
      income *= 1 + inflation; spending *= 1 + inflation;
      const netWithdrawal = Math.max(spending - income, spending * 0.12) + inputs.capital * 0.006;
      balances.push(Math.max(0, (balances[balances.length - 1] - netWithdrawal) * (1 + returnRate)));
    }
    const terminal = balances[balances.length - 1];
    const stressFactor = scenario === "worst" ? 1.9 : scenario === "best" ? 0.45 : 1;
    const risk = Math.min(24, Math.max(1.2, (inputs.annualIncome / inputs.capital) * 100 * stressFactor + Math.max(0, inputs.inflation - inputs.returnRate) * 0.8));
    return { balances, terminal, risk };
  }, [inputs, scenario]);
  const maxBalance = Math.max(...projection.balances, inputs.capital);
  const medianLegacy = projection.terminal * 0.72;
  const strategyRows = strategyNames.map(([key, name, type, factor], index) => ({ name, type, terminal: projection.terminal * (1 + (0.12 - index * 0.025) * factor), risk: projection.risk * factor, recommended: key === "adaptive" }));
  const updateInput = (key: keyof typeof inputs, value: number) => setInputs((current) => ({ ...current, [key]: value }));

  return <main className="planner-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">F</span><div><strong>Futur</strong><small>Planificador financer</small></div></div>
      <nav className="nav-list" aria-label="Navegació principal">{["Resum", "Escenaris", "Estratègies", "Dades"].map((item) => <button key={item} className={`nav-item ${activeView === item ? "active" : ""}`} onClick={() => setActiveView(item)}><span className="nav-dot" />{item}</button>)}</nav>
      <div className="sidebar-footer"><span className="online-dot" />Model local preparat<br /><small>Les dades es mantenen en aquest dispositiu.</small></div>
    </aside>
    <section className="content">
      <header className="topbar"><div><span className="eyebrow">PLANIFICACIÓ DE JUBILACIÓ</span><h1>{activeView}</h1></div><div className="top-actions"><span className="last-run">Actualitzat ara</span><button className="icon-button" aria-label="Configuració">⋯</button><div className="avatar">SR</div></div></header>
      <div className="scenario-row"><div><span className="muted-label">ESCENARI ACTIU</span><div className="scenario-title"><span className="status-dot" />{scenarioLabels[scenario]}<span className="chevron">⌄</span></div></div><div className="scenario-tabs">{(["realist", "best", "worst"] as Scenario[]).map((item) => <button key={item} className={scenario === item ? "selected" : ""} onClick={() => setScenario(item)}>{scenarioLabels[item]}</button>)}</div><button className="primary-button" onClick={() => setRunCount((value) => value + 1)}>Executar simulació <span>↗</span></button></div>
      <div className="risk-banner"><div className="risk-icon">!</div><div><strong>La probabilitat estimada de quedar-te viu sense patrimoni és {formatPercent(projection.risk)}</strong><span>Indicador provisional. El motor Monte Carlo complet s’activarà en la pròxima fase.</span></div><button className="banner-link" onClick={() => setActiveView("Estratègies")}>Veure estratègies <span>→</span></button></div>
      <div className="kpi-grid"><article className="kpi-card featured"><div className="kpi-label">PATRIMONI ACTUAL <span>i</span></div><div className="kpi-value">{formatEuro(inputs.capital, true)}</div><div className="kpi-caption positive">● Punt de partida del model</div></article><article className="kpi-card"><div className="kpi-label">PATRIMONI ALS 73</div><div className="kpi-value">{formatEuro(projection.terminal, true)}</div><div className="kpi-caption">Amb hipòtesis {scenarioLabels[scenario].toLowerCase()}</div></article><article className="kpi-card"><div className="kpi-label">HERÈNCIA MEDIANA</div><div className="kpi-value">{formatEuro(medianLegacy, true)}</div><div className="kpi-caption">Estimació inicial</div></article><article className="kpi-card"><div className="kpi-label">EDAT FINAL DEL MODEL</div><div className="kpi-value">73 <small>anys</small></div><div className="kpi-caption">Finestra visible · 15 anys</div></article></div>
      {activeView === "Estratègies" ? <StrategyPanel rows={strategyRows} /> : <div className="dashboard-grid"><article className="panel chart-panel"><div className="panel-heading"><div><span className="muted-label">PROJECCIÓ CENTRAL</span><h2>Evolució del patrimoni</h2></div><div className="legend"><span><i className="legend-line" /> Patrimoni</span><span><i className="legend-dash" /> Llindar de confort</span></div></div><div className="chart-wrap"><div className="y-axis"><span>3,0 M€</span><span>2,0 M€</span><span>1,0 M€</span><span>0 €</span></div><div className="chart"><div className="comfort-line" /><div className="bars">{projection.balances.map((value, index) => <div className="bar-column" key={index}><div className="bar" style={{ height: `${Math.max(3, (value / maxBalance) * 100)}%` }} title={`${inputs.age + index} anys: ${formatEuro(value)}`} /><span>{inputs.age + index}</span></div>)}</div></div></div><div className="chart-foot"><span>Patrimoni estimat segons ingressos i retirades actuals</span><span className="chart-note">Execucions: {runCount + 1}</span></div></article>
        <article className="panel inputs-panel"><div className="panel-heading"><div><span className="muted-label">HIPÒTESIS</span><h2>El teu punt de partida</h2></div><button className="text-button" onClick={() => setInputs(defaults)}>Restablir</button></div><div className="input-list"><label><span>Edat actual</span><output>{inputs.age} anys</output><input type="range" min="45" max="75" value={inputs.age} onChange={(event) => updateInput("age", Number(event.target.value))} /></label><label><span>Patrimoni inicial</span><output>{formatEuro(inputs.capital, true)}</output><input type="range" min="250000" max="5000000" step="50000" value={inputs.capital} onChange={(event) => updateInput("capital", Number(event.target.value))} /></label><label><span>Ingressos anuals</span><output>{formatEuro(inputs.annualIncome, true)}</output><input type="range" min="0" max="150000" step="1000" value={inputs.annualIncome} onChange={(event) => updateInput("annualIncome", Number(event.target.value))} /></label><label><span>Inflació prevista</span><output>{formatPercent(inputs.inflation)}</output><input type="range" min="0" max="8" step="0.1" value={inputs.inflation} onChange={(event) => updateInput("inflation", Number(event.target.value))} /></label><label><span>Rendiment nominal</span><output>{formatPercent(inputs.returnRate)}</output><input type="range" min="0" max="10" step="0.1" value={inputs.returnRate} onChange={(event) => updateInput("returnRate", Number(event.target.value))} /></label></div></article></div>}
      <section className="next-step"><div className="next-step-copy"><span className="step-badge">PRÒXIMA FASE</span><h2>Comparar estratègies de retirada</h2><p>Posarem costat per costat la retirada fixa, la regla del 4%, Guyton-Klinger, VPW i una retirada adaptativa.</p></div><div className="strategy-preview"><div><span className="mini-label">ESTRATÈGIA RECOMANADA</span><strong>Retirada adaptativa</strong></div><span className="arrow-circle">→</span></div></section>
      <footer className="footer"><span>Futur · Primera versió web</span><span>Compatible amb iPad · Preparat per instal·lar com a app web</span></footer>
    </section>
  </main>;
}
