#!/usr/bin/env python3
"""Basket Analysis (Association Rules).

Uses the Apriori algorithm via mlxtend to find product pairs frequently
bought together. Falls back to basic co-occurrence counting when mlxtend
is unavailable or data is insufficient.
"""

import json
import sys
from pathlib import Path
from collections import Counter
from itertools import combinations

import pandas as pd

# Ensure connectors package is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from connectors.supabase_client import get_orders


def _fallback_cooccurrence(baskets: list[list[str]], product_names: dict[str, str]) -> dict:
    """Basic co-occurrence counting when mlxtend is unavailable.

    Args:
        baskets: List of baskets, each a list of product IDs.
        product_names: Mapping of product_id -> product name.

    Returns:
        Dict with top_pairs and empty rules list.
    """
    pair_counts: Counter = Counter()
    for basket in baskets:
        unique = sorted(set(basket))
        for a, b in combinations(unique, 2):
            pair_counts[(a, b)] += 1

    top_pairs = []
    for (a, b), count in pair_counts.most_common(20):
        top_pairs.append({
            "product_a": product_names.get(a, a),
            "product_b": product_names.get(b, b),
            "co_occurrences": count,
        })

    return {
        "rules": [],
        "top_pairs": top_pairs,
        "note": "Basic co-occurrence analysis (mlxtend unavailable or insufficient data)",
    }


def run() -> dict:
    """Run basket analysis.

    Returns:
        Dict with association rules and top product pairs.
    """
    orders = get_orders(days=180)

    if not orders:
        return {"rules": [], "top_pairs": []}

    # Build baskets: list of product ID lists per order
    baskets: list[list[str]] = []
    product_names: dict[str, str] = {}

    for order in orders:
        items = order.get("order_items", []) or []
        basket = []
        for item in items:
            pid = item.get("product_id", "")
            if pid:
                basket.append(pid)
                if pid not in product_names:
                    name = item.get("product_name") or item.get("name") or item.get("title") or pid
                    product_names[pid] = name
        if len(basket) >= 2:
            baskets.append(basket)

    if len(baskets) < 5:
        return _fallback_cooccurrence(baskets, product_names) if baskets else {
            "rules": [],
            "top_pairs": [],
            "note": "Not enough multi-item orders for analysis",
        }

    # Try mlxtend
    try:
        from mlxtend.frequent_patterns import apriori, association_rules
        from mlxtend.preprocessing import TransactionEncoder

        te = TransactionEncoder()
        te_array = te.fit(baskets).transform(baskets)
        df = pd.DataFrame(te_array, columns=te.columns_)

        # Find frequent itemsets
        min_sup = max(0.01, 2 / len(baskets))  # At least 2 occurrences
        frequent = apriori(df, min_support=min_sup, use_colnames=True, max_len=2)

        if frequent.empty:
            return _fallback_cooccurrence(baskets, product_names)

        # Generate association rules
        rules_df = association_rules(frequent, metric="lift", min_threshold=1.0)

        if rules_df.empty:
            return _fallback_cooccurrence(baskets, product_names)

        rules_df = rules_df.sort_values("lift", ascending=False).head(20)

        rules = []
        for _, row in rules_df.iterrows():
            antecedents = [product_names.get(p, p) for p in row["antecedents"]]
            consequents = [product_names.get(p, p) for p in row["consequents"]]
            rules.append({
                "antecedents": antecedents,
                "consequents": consequents,
                "support": round(float(row["support"]), 4),
                "confidence": round(float(row["confidence"]), 4),
                "lift": round(float(row["lift"]), 4),
            })

        # Top pairs from rules
        top_pairs = [
            {
                "product_a": r["antecedents"][0] if r["antecedents"] else "",
                "product_b": r["consequents"][0] if r["consequents"] else "",
                "support": r["support"],
                "confidence": r["confidence"],
                "lift": r["lift"],
            }
            for r in rules[:10]
        ]

        return {"rules": rules, "top_pairs": top_pairs}

    except (ImportError, Exception):
        return _fallback_cooccurrence(baskets, product_names)


if __name__ == "__main__":
    print(json.dumps(run(), indent=2))
