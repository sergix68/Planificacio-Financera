"""Monte Carlo wrapper for financial risk."""

from dataclasses import dataclass
import random

from .model import PlanInputs, project


@dataclass(frozen=True)
class SimulationSummary:
    simulations: int
    ruin_probability: float
    median_final_capital: float
    p10_final_capital: float
    p90_final_capital: float


def run(inputs: PlanInputs, policy: str = "adaptive", simulations: int = 10_000, seed: int = 42) -> SimulationSummary:
    rng = random.Random(seed)
    finals: list[float] = []
    ruined = 0
    for _ in range(simulations):
        returns = [rng.gauss(inputs.nominal_return, 0.12) for _ in range(inputs.years)]
        path = project(inputs, policy, returns)
        finals.append(path[-1].closing_capital)
        ruined += int(any(item.closing_capital <= 0 for item in path))
    finals.sort()
    percentile = lambda p: finals[min(len(finals) - 1, int(len(finals) * p))]
    return SimulationSummary(simulations, ruined / simulations, percentile(0.5), percentile(0.1), percentile(0.9))
