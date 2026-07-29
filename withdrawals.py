"""Withdrawal policies used by Futur's planning engine."""

from dataclasses import dataclass


@dataclass(frozen=True)
class WithdrawalContext:
    age: int
    portfolio: float
    prior_portfolio: float
    initial_withdrawal: float
    inflation: float
    expected_years: int = 30


def fixed(ctx: WithdrawalContext) -> float:
    return ctx.initial_withdrawal * (1 + ctx.inflation) ** max(ctx.age - 1, 0)


def four_percent(ctx: WithdrawalContext) -> float:
    return max(0.0, ctx.portfolio * 0.04)


def vpw(ctx: WithdrawalContext) -> float:
    years_left = max(1, ctx.expected_years - (ctx.age - 58))
    return max(0.0, ctx.portfolio / years_left)


def guyton_klinger(ctx: WithdrawalContext) -> float:
    baseline = fixed(ctx)
    if ctx.prior_portfolio <= 0:
        return 0.0
    drawdown = ctx.portfolio / ctx.prior_portfolio - 1
    if drawdown <= -0.20:
        return baseline * 0.90
    if drawdown >= 0.20:
        return baseline * 1.05
    return baseline


def adaptive(ctx: WithdrawalContext) -> float:
    if ctx.portfolio <= 0:
        return 0.0
    target_rate = 0.035 if ctx.portfolio < ctx.prior_portfolio else 0.042
    return max(0.0, ctx.portfolio * target_rate)


POLICIES = {"fixed": fixed, "four_percent": four_percent, "guyton_klinger": guyton_klinger, "vpw": vpw, "adaptive": adaptive}
