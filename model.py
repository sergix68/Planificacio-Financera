"""Core deterministic projection model, ready to be wrapped by Monte Carlo."""

from dataclasses import dataclass

from .withdrawals import POLICIES, WithdrawalContext


@dataclass(frozen=True)
class PlanInputs:
    start_age: int = 58
    initial_capital: float = 2_500_000
    annual_income: float = 58_000
    annual_spending: float = 33_640
    nominal_return: float = 0.04
    inflation: float = 0.03
    tax_rate: float = 0.27
    years: int = 40


@dataclass(frozen=True)
class YearResult:
    age: int
    opening_capital: float
    withdrawal: float
    income: float
    closing_capital: float


def project(inputs: PlanInputs, policy: str = "adaptive", returns: list[float] | None = None) -> list[YearResult]:
    if policy not in POLICIES:
        raise ValueError(f"Unknown withdrawal policy: {policy}")
    path = returns or [inputs.nominal_return] * inputs.years
    result: list[YearResult] = []
    capital = inputs.initial_capital
    income = inputs.annual_income
    for index in range(inputs.years):
        age = inputs.start_age + index
        prior = capital if index == 0 else result[-1].closing_capital
        context = WithdrawalContext(age, capital, prior, inputs.annual_spending, inputs.inflation, inputs.years)
        withdrawal = POLICIES[policy](context)
        net_need = max(0.0, withdrawal - income)
        closing = max(0.0, (capital - net_need) * (1 + path[index]))
        result.append(YearResult(age, capital, withdrawal, income, closing))
        income *= 1 + inputs.inflation
    return result
