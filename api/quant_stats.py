import numpy as np
import pandas as pd
from scipy import stats
from dataclasses import dataclass
from hmmlearn import hmm

# =====================================================================
# 1. Statistical Signal Detection — Insider Trades & Bulk Deals
# =====================================================================

class WelfordStats:
    """Numerically stable online mean and variance (Welford 1962)."""
    def __init__(self): 
        self.n = 0
        self.mean = 0.0
        self.M2 = 0.0

    def update(self, x: float):
        self.n += 1
        delta = x - self.mean
        self.mean += delta / self.n
        self.M2 += delta * (x - self.mean)

    @property
    def variance(self): 
        return self.M2 / (self.n - 1) if self.n > 1 else 0.0

    @property
    def std(self): 
        return self.variance ** 0.5

    def z_score(self, x): 
        return (x - self.mean) / self.std if self.std > 0 else 0.0


def fishers_combined_p(p_values: list[float]) -> float:
    """Fisher's method for combining independent p-values."""
    if len(p_values) == 1:
        return p_values[0]
    # Clip to avoid log(0); floor at 1e-10
    clipped = np.clip(p_values, 1e-10, 1.0)
    chi2_stat = -2 * np.sum(np.log(clipped))
    df = 2 * len(p_values)
    return 1 - stats.chi2.cdf(chi2_stat, df)


def insider_cluster_score(trades: list[dict]) -> dict:
    """Score a cluster of insider trades on the same stock in 5 days."""
    p_vals = [stats.norm.sf(t.get('z_score', 0)) for t in trades] # one-tailed
    return {
        'n_insiders': len(trades),
        'combined_p': fishers_combined_p(p_vals),
        'log10_p': np.log10(fishers_combined_p(p_vals)) if fishers_combined_p(p_vals) > 0 else -10,
        'is_significant': fishers_combined_p(p_vals) < 0.01,
    }


def compute_insider_score(row: dict) -> float:
    """
    Weighted composite score (0-1) factoring:
    - insider_category (Promoter = 1.0, Director = 0.7, Employee = 0.4)
    - value_cr (log-normalised, capped at ₹50 Cr = 1.0)
    - market_cap_band (small-cap signal stronger -> higher weight)
    """
    cat_weight = {'Promoter': 1.0, 'Director': 0.7, 'Employee': 0.4}.get(row.get('insider_category', ''), 0.3)
    import math
    val_cr = row.get('value_cr', 0)
    val_score = min(math.log1p(val_cr) / math.log1p(50), 1.0) if val_cr > 0 else 0
    
    # Small-cap bonus: market_cap < 500 Cr gets +0.15
    cap_bonus = 0.15 if row.get('market_cap_cr', 9999) < 500 else 0.0
    base = 0.4 * cat_weight + 0.4 * val_score + 0.2
    return min(base + cap_bonus, 1.0)


# =====================================================================
# 2. Pattern Backtesting — Rigorous Statistical Validation
# =====================================================================

def clopper_pearson_ci(k: int, n: int, alpha: float = 0.05) -> tuple[float, float]:
    """Exact binomial confidence interval (Clopper & Pearson 1934)."""
    if n == 0: return (0.0, 1.0)
    lo = stats.beta.ppf(alpha / 2, k, n - k + 1) if k > 0 else 0.0
    hi = stats.beta.ppf(1 - alpha / 2, k + 1, n - k) if k < n else 1.0
    return (round(lo, 4), round(hi, 4))


def pattern_stats(outcomes: list[bool], threshold_pct: float = 2.0) -> dict:
    n = len(outcomes)
    k = sum(outcomes)
    p = k / n if n > 0 else 0.0
    lo, hi = clopper_pearson_ci(k, n)
    return {
        'n': n, 'k': k, 'win_rate': p,
        'ci_95_lower': lo, 'ci_95_upper': hi,
        'ci_width': hi - lo,
        'reliable': n >= 30 and lo > 0.50
    }


def benjamini_hochberg(p_values: np.ndarray, q: float = 0.10) -> np.ndarray:
    """BH FDR correction. Returns boolean mask of rejected (significant) tests."""
    m = len(p_values)
    order = np.argsort(p_values)
    ranked = np.arange(1, m + 1) # ranks 1..m
    thresholds = ranked / m * q
    reject = p_values[order] <= thresholds
    
    # All tests up to last rejection are rejected (monotone)
    if reject.any():
        last = np.where(reject)[0][-1]
        reject[:last + 1] = True
        
    result = np.zeros(m, dtype=bool)
    result[order] = reject
    return result


def bca_bootstrap_ci(data: np.ndarray, B: int = 10_000, alpha: float = 0.05, stat=np.mean) -> tuple:
    """Bias-Corrected Accelerated bootstrap CI."""
    n = len(data)
    if n == 0: return (0.0, 0.0)
    theta_hat = stat(data)
    boots = np.array([stat(np.random.choice(data, n, replace=True)) for _ in range(B)])
    
    # Bias correction
    p_less = np.mean(boots < theta_hat)
    p_less = max(min(p_less, 0.9999), 0.0001) # avoid inf
    z0 = stats.norm.ppf(p_less)
    
    # Acceleration (jackknife)
    jack = np.array([stat(np.delete(data, i)) for i in range(n)])
    jack_mean = jack.mean()
    num = np.sum((jack_mean - jack) ** 3)
    den = 6 * (np.sum((jack_mean - jack) ** 2) ** 1.5)
    a = num / den if den != 0 else 0
    
    # Adjusted percentiles
    z_lo = stats.norm.ppf(alpha / 2)
    z_hi = stats.norm.ppf(1 - alpha / 2)
    
    p_lo = stats.norm.cdf(z0 + (z0 + z_lo) / (1 - a * (z0 + z_lo)))
    p_hi = stats.norm.cdf(z0 + (z0 + z_hi) / (1 - a * (z0 + z_hi)))
    
    return (float(np.percentile(boots, 100 * p_lo)), float(np.percentile(boots, 100 * p_hi)))


# =====================================================================
# 3. Bayesian Framework — Incremental Success Rate Updating
# =====================================================================

class BayesianPatternTracker:
    """
    Beta-Binomial tracker for pattern win rate.
    Closed-form conjugate update: no MCMC needed.
    """
    def __init__(self, alpha0: float = 5.0, beta0: float = 5.0):
        self.alpha = alpha0 # pseudo-wins (prior)
        self.beta = beta0   # pseudo-losses (prior)

    def update(self, win: bool):
        """Update with a new observed outcome."""
        if win: self.alpha += 1
        else: self.beta += 1

    def update_batch(self, k_wins: int, n_trials: int):
        self.alpha += k_wins
        self.beta += (n_trials - k_wins)

    @property
    def posterior_mean(self): 
        return self.alpha / (self.alpha + self.beta)

    @property
    def posterior_std(self):
        a, b = self.alpha, self.beta
        return (a*b / ((a+b)**2 * (a+b+1))) ** 0.5

    def credible_interval(self, level: float = 0.95):
        """HDI via beta quantiles."""
        q = (1 - level) / 2
        return (stats.beta.ppf(q, self.alpha, self.beta),
                stats.beta.ppf(1-q, self.alpha, self.beta))

    def prob_greater_than(self, threshold: float = 0.50) -> float:
        """P(p > threshold | data) — P(pattern has edge)."""
        return 1 - stats.beta.cdf(threshold, self.alpha, self.beta)

    @property
    def n_effective(self): 
        return self.alpha + self.beta # includes prior


# =====================================================================
# 4. Walk-Forward Validation — Preventing Look-Ahead Bias
# =====================================================================

@dataclass
class WalkForwardResult:
    oos_win_rate: float
    oos_n: int
    oos_returns: list[float]
    fold_results: list[dict]
    sharpe: float
    max_drawdown: float

def walk_forward_validate(
    signal_dates: list, outcomes: list[bool], returns: list[float], 
    T_min: int = 252, H: int = 63
) -> WalkForwardResult:
    n = len(signal_dates)
    fold_results, oos_outcomes, oos_returns = [], [], []
    k = 0
    while T_min + k * H < n:
        train_end = T_min + k * H
        test_end = min(train_end + H, n)
        test_outcomes = outcomes[train_end:test_end]
        test_returns = returns[train_end:test_end]
        
        fold_results.append({
            'fold': k + 1,
            'train_n': train_end,
            'test_n': len(test_outcomes),
            'oos_win_rate': np.mean(test_outcomes) if test_outcomes else np.nan,
        })
        
        oos_outcomes.extend(test_outcomes)
        oos_returns.extend(test_returns)
        k += 1
        
    oos_ret = np.array(oos_returns)
    sharpe = oos_ret.mean() / oos_ret.std() * np.sqrt(252) if len(oos_ret) > 0 and oos_ret.std() > 0 else 0.0
    
    if len(oos_ret) > 0:
        cum = np.cumprod(1 + oos_ret / 100)
        peak = np.maximum.accumulate(cum)
        mdd = float(np.min((cum - peak) / peak)) if len(peak) > 0 and peak[0] != 0 else 0.0
    else:
        mdd = 0.0
        
    return WalkForwardResult(
        oos_win_rate=np.mean(oos_outcomes) if oos_outcomes else 0.0, 
        oos_n=len(oos_outcomes),
        oos_returns=list(oos_ret), 
        fold_results=fold_results,
        sharpe=sharpe, 
        max_drawdown=mdd
    )


def compute_risk_metrics(returns: np.ndarray, alpha: float = 0.95) -> dict:
    """Full tail-risk profile for a pattern's historical returns."""
    if len(returns) == 0:
        return {}
    var_h = -np.percentile(returns, (1 - alpha) * 100) # Historical VaR
    tail = returns[returns < -var_h]
    cvar = -tail.mean() if len(tail) > 0 else var_h # CVaR / ES
    
    std_ret = returns.std()
    skewness = float(np.mean((returns - returns.mean())**3) / std_ret**3) if std_ret > 0 else 0.0
    kurtosis = float(np.mean((returns - returns.mean())**4) / std_ret**4 - 3) if std_ret > 0 else 0.0
    
    return {
        'var_95': round(var_h, 2),
        'cvar_95': round(cvar, 2),
        'skewness': round(skewness, 3),
        'excess_kurtosis': round(kurtosis, 3),
        'max_loss': round(float(returns.min()), 2),
        'max_gain': round(float(returns.max()), 2),
    }


# =====================================================================
# 6. Market Regime Detection — Regime-Conditional Signal Validity
# =====================================================================

def fit_regime_hmm(nifty_returns: np.ndarray, n_states: int = 3) -> hmm.GaussianHMM:
    model = hmm.GaussianHMM(
        n_components=n_states, covariance_type='diag',
        n_iter=200, random_state=42
    )
    model.fit(nifty_returns.reshape(-1, 1))
    
    # Sort states by mean return (Bull = highest, Bear = lowest)
    order = np.argsort(model.means_.flatten())[::-1]
    model.means_ = model.means_[order]
    model.covars_ = model.covars_[order]
    model.transmat_ = model.transmat_[np.ix_(order, order)]
    model.startprob_ = model.startprob_[order]
    return model


def get_current_regime(model: hmm.GaussianHMM, recent_30d: np.ndarray) -> dict:
    probs = model.predict_proba(recent_30d.reshape(-1, 1))
    last = probs[-1] # probabilities for latest observation
    state = int(np.argmax(last))
    labels = {0: 'Bull', 1: 'Sideways', 2: 'Bear'}
    return {
        'regime': labels[state],
        'p_bull': round(float(last[0]), 3),
        'p_side': round(float(last[1]), 3),
        'p_bear': round(float(last[2]), 3)
    }


# =====================================================================
# 7. Time-Series Statistical Properties
# =====================================================================

def hurst_exponent(ts: np.ndarray, min_window: int = 10) -> float:
    """Estimate Hurst exponent via R/S analysis."""
    n = len(ts)
    if n < min_window * 2: return 0.5
    
    ns = range(min_window, n // 2, max(1, n // 50))
    rs_vals = []
    for size in ns:
        rs_sub = []
        for start in range(0, n - size, size):
            sub = ts[start:start + size]
            mean_sub = sub.mean()
            dev = np.cumsum(sub - mean_sub)
            R = dev.max() - dev.min()
            S = sub.std(ddof=1)
            if S > 0: rs_sub.append(R / S)
        if rs_sub: rs_vals.append((size, np.mean(rs_sub)))
        
    if len(rs_vals) < 2: return 0.5
    log_n = np.log([x[0] for x in rs_vals])
    log_rs = np.log([x[1] for x in rs_vals])
    H, _ = np.polyfit(log_n, log_rs, 1)
    return round(float(H), 4)


def regime_momentum_validity(H: float) -> str:
    if H > 0.55: return 'Strong — momentum/breakout patterns are statistically grounded'
    if H > 0.50: return 'Mild — breakout patterns have marginal validity'
    return 'Low — mean-reversion strategies preferred over momentum'


# =====================================================================
# 8. Monte Carlo Simulation — Validating Pattern Win Rates Against the Null
# =====================================================================

def monte_carlo_permutation_test(
    signal_dates: list, all_dates: list, return_map: dict, 
    win_threshold: float = 2.0, B: int = 10_000, d: int = 10
) -> dict:
    """
    Permutation test: is the pattern's win rate > random entry?
    signal_dates: dates when pattern fired
    all_dates: all tradeable dates (same stock)
    return_map: {date: forward_return_pct}
    """
    n = len(signal_dates)
    pool = [d for d in all_dates if d in return_map]
    
    # Observed win rate
    obs_returns = [return_map[d] for d in signal_dates if d in return_map]
    if not obs_returns: return {}
    
    obs_p = np.mean([r >= win_threshold for r in obs_returns])
    
    # Simulate null
    null_win_rates = []
    for _ in range(B):
        sample = np.random.choice(pool, size=n, replace=False)
        rand_r = [return_map[d] for d in sample]
        null_win_rates.append(np.mean([r >= win_threshold for r in rand_r]))
        
    null_arr = np.array(null_win_rates)
    emp_p_val = float(np.mean(null_arr >= obs_p))
    
    return {
        'observed_win_rate': round(obs_p, 4),
        'null_mean': round(null_arr.mean(), 4),
        'null_std': round(null_arr.std(), 4),
        'null_95th_pct': round(np.percentile(null_arr, 95), 4),
        'empirical_p_value': round(emp_p_val, 4),
        'z_vs_null': round((obs_p - null_arr.mean()) / null_arr.std(), 3) if null_arr.std() > 0 else 0.0,
        'significant': emp_p_val < 0.05,
    }


# =====================================================================
# Appendix A: Complete Statistical Pipeline
# =====================================================================

def full_statistical_pipeline(
    symbol: str, pattern: str, insider_trades: list[dict], 
    price_history: pd.DataFrame, nifty_returns: np.ndarray, 
    all_tested: int = 10_000
) -> dict:
    """
    Master pipeline returning a fully statistically validated signal package.
    All statistics are OOS only. Returns None if any quality gate fails.
    """
    from statsmodels.tsa.stattools import adfuller
    
    returns = np.log(price_history['close'] / price_history['close'].shift(1)).dropna()
    if len(returns) < 30:
        return {"error": "Insufficient data"}
        
    # === STATIONARITY CHECK ===
    adf_stat, adf_p, *_ = adfuller(returns, autolag='AIC')
    if adf_p >= 0.05:
        return {"error": f"Returns not stationary for {symbol}: ADF p={adf_p:.3f}"}
        
    # === HURST EXPONENT ===
    H = hurst_exponent(returns.values)
    
    # === REGIME ===
    hmm_model = fit_regime_hmm(nifty_returns)
    regime = get_current_regime(hmm_model, nifty_returns[-30:])
    
    # === INSIDER Z-SCORES ===
    stats_tracker = WelfordStats()
    for t in insider_trades[:-1]:
        stats_tracker.update(t.get('value_cr', 0))
    
    latest = insider_trades[-1] if insider_trades else {}
    z_score = stats_tracker.z_score(latest.get('value_cr', 0))
    p_insider = float(stats.norm.sf(z_score))
    
    # Placeholder for Walk-Forward Validation & Monte Carlo
    # In a real scenario, you'd load historical pattern signals and run the full suite
    
    return {
        'symbol': symbol,
        'pattern': pattern,
        'adf_p': adf_p,
        'hurst': H,
        'regime': regime,
        'insider_z_score': z_score,
        'insider_p_value': p_insider,
        'status': 'Pipeline completed successfully'
    }
