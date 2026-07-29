"use client";

import { useMemo, useState } from "react";

type Scenario = "realist" | "best" | "worst";
type StrategyKey = "fixed" | "four_percent" | "guyton_klinger" | "vpw" | "adaptive";
type Inputs = { age: number; capital: number; annualIncome: number; inflation: number; returnRate: number; tax: number };
type MonteCarloSummary = { simulations: number; ruinProbability: number; median: number; p10: number; p90: number };

const defaults: Inputs = { age: 58, capital: 2500000, annualIncome: 58000, inflation: 3, returnRate: 4, tax: 27 };
const scenarioLabels: Record<Scenario, string> = { realist: "Realista", best: "Favorable", worst: "Exigent" };
const scenarioAdjustments: Record<Scenario, { returnRate: number; inflation: number }> = {
  realist: { returnRate: 0, inflation: 0 }, best: { returnRate: 1, inflation: -0.5 }, worst: { returnRate: -1.5, inflation: 0.5 },
};
const strategyDefinitions: Array<{ key: StrategyKey; name: string; type: string }> = [
  { key: "fixed", name: "Retirada fixa", type: "Estable" },
  { key: "four_percent", name: "Regla del 4%", type: "Equilibrada" },
  { key: "guyton_klinger", name: "Guyton-Klinger", type: "Guardrails" },
  { key: "vpw", name: "VPW", type: "Variable" },
  { key: "adaptive", name: "Retirada adaptativa", type: "Flexible" },
];

function formatEuro(value: number, compact = false) {
  if (compact && Math.abs(value) >= 1000000) return `${(value / 1000000).toFixed(2).replace(".", ",")} M€`;
  if (compact && Math.abs(value) >= 1000) return `${Math.round(value / 1000)} k€`;
  return new Intl.NumberFormat("ca-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}
function formatPercent(value: number) { return `${value.toFixed(1).replace(".", ",")}%`; }
function quantile(values: number[], fraction: number) { return values[Math.min(values.length - 1, Math.floor(values.length * fraction))] ?? 0; }

function makeRandom(seed: number) {
  let state = seed >>> 0;
  return () => { state = (1664525 * state + 1013904223) >>> 0; return state / 4294967296; };
}
function normal(random: () => number) {
  const u = Math.max(random(), 0.000001); const v = Math.max(random(), 0.000001);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function withdrawalFor(strategy: StrategyKey, capital: number, previous: number, initial: number, inflation: number, yearsLeft: number) {
  if (capital <= 0) return 0;
  const fixed = initial * (1 + inflation) ** Math.max(0, 30 - yearsLeft);
  if (strategy === "fixed") return fixed;
  if (strategy === "four_percent") return capital * 0.04;
  if (strategy === "vpw") return capital / Math.max(1, yearsLeft);
  if (strategy === "guyton_klinger") {
    const movement = previous > 0 ? capital / previous - 1 : 0;
    return fixed * (movement <= -0.2 ? 0.9 : movement >= 0.2 ? 1.05 : 1);
  }
  return capital * (capital < previous ? 0.035 : 0.042);
}
function simulateStrategy(inputs: Inputs, scenario: Scenario, strategy: StrategyKey, seed: number): MonteCarloSummary {
  const random = makeRandom(seed); const adjustment = scenarioAdjustments[scenario]; const finals: number[] = []; let ruined = 0;
  const simulations = 1400; const years = 30; const nominalReturn = (inputs.returnRate + adjustment.returnRate) / 100; const inflation = (inputs.inflation + adjustment.inflation) / 100;
  for (let simulation = 0; simulation < simulations; simulation += 1) {
    let capital = inputs.capital; let previous = capital; let income = inputs.annualIncome; let spending = inputs.annualIncome * 0.58; let initial = Math.max(spending * 0.12, inputs.capital * 0.006);
    let failed = false;
    for (let year = 0; year < years; year += 1) {
      income *= 1 + inflation; spending *= 1 + inflation; initial = Math.max(initial, Math.max(spending - income, spending * 0.12) + inputs.capital * 0.006);
      const withdrawal = withdrawalFor(strategy, capital, previous, initial, inflation, years - year);
      const annualReturn = Math.max(-0.95, nominalReturn + normal(random) * 0.12);
      previous = capital; capital = Math.max(0, (capital - withdrawal) * (1 + annualReturn));
      if (capital <= 0) { failed = true; break; }
    }
    if (failed) ruined += 1; finals.push(capital);
  }
  finals.sort((a, b) => a - b);
  return { simulations, ruinProbability: ruined / simulations, median: quantile(finals, 0.5), p10: quantile(finals, 0.1), p90: quantile(finals, 0.9) };
}
function simulateAll(inputs: Inputs, scenario: Scenario, run: number) {
  return Object.fromEntries(strategyDefinitions.map((definition, index) => [definition.key, simulateStrategy(inputs, scenario, definition.key, 42 + run * 97 + index * 1009)])) as Record<StrategyKey, MonteCarloSummary>;
}

function StrategyPanel({ results }: { results: Record<StrategyKey, MonteCarloSummary> }) {
  const recommended = Object.entries(results).sort(([, a], [, b]) => a.ruinProbability - b.ruinProbability || b.median - a.median)[0]?.[0];
  return <section className="panel strategies-panel"><div className="panel-heading"><div><span className="muted-label">MONTE CARLO</span><h2>Cinc maneres de retirar</h2></div><span className="strategy-count">1.400 trajectòries per estratègia</span></div><p className="strategy-intro">La simulació combina rendiments variables, inflació i la política de retirada. El risc és la probabilitat d’esgotar el patrimoni abans de completar 30 anys.</p><div className="strategy-table"><div className="strategy-table-head"><span>ESTRATÈGIA</span><span>MEDIANA FINAL</span><span>RISC DE RUÏNA</span><span>INTERVAL P10–P90</span></div>{strategyDefinitions.map((definition) => { const row = results[definition.key]; const isRecommended = definition.key === recommended; return <div className={`strategy-row ${isRecommended ? "recommended" : ""}`} key={definition.key}><div><strong>{definition.name}</strong><small>{definition.type}</small></div><strong>{formatEuro(row.median, true)}</strong><span className={row.ruinProbability < 0.05 ? "low-risk" : "mid-risk"}>{formatPercent(row.ruinProbability * 100)}</span><span className="strategy-status">{formatEuro(row.p10, true)} · {formatEuro(row.p90, true)}{isRecommended ? " · Recomanada" : ""}</span></div>; })}</div></section>;
}

function ScenarioPanel({ inputs, active, onSelect }: { inputs: Inputs; active: Scenario; onSelect: (value: Scenario) => void }) {
  const cards = (Object.keys(scenarioLabels) as Scenario[]).map((scenario) => ({ scenario, result: simulateStrategy(inputs, scenario, "adaptive", 900 + scenario.length) }));
  return <section className="panel scenario-panel"><div className="panel-heading"><div><span className="muted-label">ESCENARIS</span><h2>Com canvia el futur?</h2></div><span className="strategy-count">Retirada adaptativa</span></div><p className="strategy-intro">Tres hipòtesis per entendre la sensibilitat del pla abans de prendre decisions.</p><div className="scenario-cards">{cards.map(({ scenario, result }) => <button className={`scenario-card ${active === scenario ? "active" : ""}`} key={scenario} onClick={() => onSelect(scenario)}><span className="muted-label">{scenarioLabels[scenario]}</span><strong>{formatEuro(result.median, true)}</strong><small>Mediana final</small><span className={result.ruinProbability < 0.05 ? "low-risk" : "mid-risk"}>{formatPercent(result.ruinProbability * 100)} de risc</span></button>)}</div></section>;
}

function DataPanel({ inputs, scenario, onSave }: { inputs: Inputs; scenario: Scenario; onSave: () => void }) {
  const exportData = () => { const blob = new Blob([JSON.stringify({ inputs, scenario, exportedAt: new Date().toISOString() }, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "futur-pla.json"; link.click(); URL.revokeObjectURL(url); };
  return <section className="panel data-panel"><div className="panel-heading"><div><span className="muted-label">DADES</span><h2>El teu pla, sota control</h2></div><span className="strategy-count">Només en aquest dispositiu</span></div><p className="strategy-intro">Les dades del pla es guarden localment al navegador. Pots exportar una còpia per conservar-la o portar-la a un altre dispositiu.</p><div className="data-grid"><div><span className="muted-label">ESCENARI DESAT</span><strong>{scenarioLabels[scenario]}</strong></div><div><span className="muted-label">PATRIMONI</span><strong>{formatEuro(inputs.capital, true)}</strong></div><div><span className="muted-label">EDAT ACTUAL</span><strong>{inputs.age} anys</strong></div><div><span className="muted-label">INGRESSOS</span><strong>{formatEuro(inputs.annualIncome, true)}</strong></div></div><div className="data-actions"><button className="primary-button" onClick={onSave}>Desar al dispositiu</button><button className="secondary-button" onClick={exportData}>Exportar còpia JSON</button></div></section>;
}

export default function Home() {
  const [scenario, setScenario] = useState<Scenario>("realist"); const [inputs, setInputs] = useState<Inputs>(defaults); const [activeView, setActiveView] = useState("Resum"); const [runCount, setRunCount] = useState(0); const [saved, setSaved] = useState(false);
  const adjustment = scenarioAdjustments[scenario];
  const projection = useMemo(() => { const returnRate = (inputs.returnRate + adjustment.returnRate) / 100; const inflation = (inputs.inflation + adjustment.inflation) / 100; const balances = [inputs.capital]; let income = inputs.annualIncome; let spending = inputs.annualIncome * 0.58; for (let index = 1; index < 16; index += 1) { income *= 1 + inflation; spending *= 1 + inflation; const withdrawal = Math.max(spending - income, spending * 0.12) + inputs.capital * 0.006; balances.push(Math.max(0, (balances[index - 1] - withdrawal) * (1 + returnRate))); } return { balances, terminal: balances[balances.length - 1] }; }, [adjustment, inputs]);
  const results = useMemo(() => simulateAll(inputs, scenario, runCount), [inputs, scenario, runCount]); const recommendedResult = results.adaptive; const maxBalance = Math.max(...projection.balances, inputs.capital); const medianLegacy = recommendedResult.median * 0.72;
  const updateInput = (key: keyof Inputs, value: number) => { setSaved(false); setInputs((current) => ({ ...current, [key]: value })); };
  const savePlan = () => { localStorage.setItem("futur-plan", JSON.stringify({ inputs, scenario })); setSaved(true); };
  const runSimulation = () => { setRunCount((value) => value + 1); setSaved(false); };
  return <main className="planner-shell"><aside className="sidebar"><div className="brand"><span className="brand-mark">F</span><div><strong>Futur</strong><small>Planificador financer</small></div></div><nav className="nav-list" aria-label="Navegació principal">{["Resum", "Escenaris", "Estratègies", "Dades"].map((item) => <button key={item} className={`nav-item ${activeView === item ? "active" : ""}`} onClick={() => setActiveView(item)}><span className="nav-dot" />{item}</button>)}</nav><div className="sidebar-footer"><span className="online-dot" />Model local preparat<br /><small>Les dades es mantenen en aquest dispositiu.</small></div></aside><section className="content"><header className="topbar"><div><span className="eyebrow">PLANIFICACIÓ DE JUBILACIÓ</span><h1>{activeView}</h1></div><div className="top-actions"><span className="last-run">{runCount ? "Simulació actualitzada" : "Simulació preparada"}</span><button className="icon-button" aria-label="Configuració">···</button><div className="avatar">SR</div></div></header><div className="scenario-row"><div><span className="muted-label">ESCENARI ACTIU</span><div className="scenario-title"><span className="status-dot" />{scenarioLabels[scenario]}<span className="chevron">⌄</span></div></div><div className="scenario-tabs">{(Object.keys(scenarioLabels) as Scenario[]).map((item) => <button key={item} className={scenario === item ? "selected" : ""} onClick={() => setScenario(item)}>{scenarioLabels[item]}</button>)}</div><button className="primary-button" onClick={runSimulation}>Executar simulació <span>↗</span></button></div><div className="risk-banner"><div className="risk-icon">!</div><div><strong>La probabilitat estimada de quedar-te viu sense patrimoni és {formatPercent(recommendedResult.ruinProbability * 100)}</strong><span>Monte Carlo local · {recommendedResult.simulations.toLocaleString("ca-ES")} trajectòries · horitzó de 30 anys</span></div><button className="banner-link" onClick={() => setActiveView("Estratègies")}>Veure estratègies <span>→</span></button></div><div className="kpi-grid"><article className="kpi-card featured"><div className="kpi-label">PATRIMONI ACTUAL <span>i</span></div><div className="kpi-value">{formatEuro(inputs.capital, true)}</div><div className="kpi-caption positive">● Punt de partida del model</div></article><article className="kpi-card"><div className="kpi-label">MEDIANA ALS 88</div><div className="kpi-value">{formatEuro(recommendedResult.median, true)}</div><div className="kpi-caption">Trajectòria adaptativa</div></article><article className="kpi-card"><div className="kpi-label">HERÈNCIA MEDIANA</div><div className="kpi-value">{formatEuro(medianLegacy, true)}</div><div className="kpi-caption">Estimació Monte Carlo</div></article><article className="kpi-card"><div className="kpi-label">EDAT FINAL DEL MODEL</div><div className="kpi-value">88 <small>anys</small></div><div className="kpi-caption">Horitzó de 30 anys</div></article></div>{activeView === "Estratègies" ? <StrategyPanel results={results} /> : activeView === "Escenaris" ? <ScenarioPanel inputs={inputs} active={scenario} onSelect={setScenario} /> : activeView === "Dades" ? <DataPanel inputs={inputs} scenario={scenario} onSave={savePlan} /> : <div className="dashboard-grid"><article className="panel chart-panel"><div className="panel-heading"><div><span className="muted-label">PROJECCIÓ CENTRAL</span><h2>Evolució del patrimoni</h2></div><div className="legend"><span><i className="legend-line" /> Patrimoni</span><span><i className="legend-dash" /> Llindar de confort</span></div></div><div className="chart-wrap"><div className="y-axis"><span>3,0 M€</span><span>2,0 M€</span><span>1,0 M€</span><span>0 €</span></div><div className="chart"><div className="comfort-line" /><div className="bars">{projection.balances.map((value, index) => <div className="bar-column" key={index}><div className="bar" style={{ height: `${Math.max(3, (value / maxBalance) * 100)}%` }} title={`${inputs.age + index} anys: ${formatEuro(value)}`} /><span>{inputs.age + index}</span></div>)}</div></div></div><div className="chart-foot"><span>Projecció central · 15 anys visibles</span><span className="chart-note">Execucions: {runCount + 1}</span></div></article><article className="panel inputs-panel"><div className="panel-heading"><div><span className="muted-label">HIPÒTESIS</span><h2>El teu punt de partida</h2></div><button className="text-button" onClick={() => setInputs(defaults)}>Restablir</button></div><div className="input-list"><label><span>Edat actual</span><output>{inputs.age} anys</output><input type="range" min="45" max="75" value={inputs.age} onChange={(event) => updateInput("age", Number(event.target.value))} /></label><label><span>Patrimoni inicial</span><output>{formatEuro(inputs.capital, true)}</output><input type="range" min="250000" max="5000000" step="50000" value={inputs.capital} onChange={(event) => updateInput("capital", Number(event.target.value))} /></label><label><span>Ingressos anuals</span><output>{formatEuro(inputs.annualIncome, true)}</output><input type="range" min="0" max="150000" step="1000" value={inputs.annualIncome} onChange={(event) => updateInput("annualIncome", Number(event.target.value))} /></label><label><span>Inflació prevista</span><output>{formatPercent(inputs.inflation)}</output><input type="range" min="0" max="8" step="0.1" value={inputs.inflation} onChange={(event) => updateInput("inflation", Number(event.target.value))} /></label><label><span>Rendiment nominal</span><output>{formatPercent(inputs.returnRate)}</output><input type="range" min="0" max="10" step="0.1" value={inputs.returnRate} onChange={(event) => updateInput("returnRate", Number(event.target.value))} /></label></div></article></div>}<section className="next-step"><div className="next-step-copy"><span className="step-badge">SPRINT 2 COMPLET</span><h2>Simulació i dades locals activades</h2><p>{saved ? "Pla desat correctament en aquest dispositiu." : "Executa una nova simulació o desa una còpia del teu pla des de la pestanya Dades."}</p></div><div className="strategy-preview"><div><span className="mini-label">RESULTAT CENTRAL</span><strong>{formatEuro(recommendedResult.median, true)} de mediana</strong></div><span className="arrow-circle">→</span></div></section><footer className="footer"><span>Futur · Sprint 2</span><span>Compatible amb iPad · Dades locals · Monte Carlo al navegador</span></footer></section></main>;
}
