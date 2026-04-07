from __future__ import annotations

import csv
import json
import os
import re
from pathlib import Path

from flask import Flask, jsonify, render_template, request


BASE_DIR = Path(__file__).resolve().parent
COLOR_DATASET = BASE_DIR / "color.csv"
TRAINING_NOTEBOOK = BASE_DIR / "Training&Testing.ipynb"

app = Flask(__name__)


def load_colors() -> list[dict[str, int | str]]:
    colors: list[dict[str, int | str]] = []

    with COLOR_DATASET.open("r", encoding="utf-8", newline="") as csv_file:
        reader = csv.DictReader(csv_file)
        for row_number, row in enumerate(reader, start=2):
            try:
                colors.append(
                    {
                        "name": row["colors"].strip(),
                        "r": int(row["red"]),
                        "g": int(row["green"]),
                        "b": int(row["blue"]),
                        "row_number": row_number,
                    }
                )
            except (KeyError, TypeError, ValueError):
                continue

    return colors


def count_dataset_rows() -> int:
    with COLOR_DATASET.open("r", encoding="utf-8", newline="") as csv_file:
        reader = csv.reader(csv_file)
        return sum(1 for row in reader if any(cell.strip() for cell in row))


def format_percentage(value: float) -> str:
    if value.is_integer():
        return f"{int(value)}%"

    return f"{value:.2f}%"


def collect_notebook_text(value: object) -> str:
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        return "\n".join(collect_notebook_text(item) for item in value)
    if isinstance(value, dict):
        return "\n".join(collect_notebook_text(item) for item in value.values())
    return ""


def load_notebook_summary() -> dict[str, object]:
    if not TRAINING_NOTEBOOK.exists():
        return {"split": None, "models": []}

    try:
        with TRAINING_NOTEBOOK.open("r", encoding="utf-8") as notebook_file:
            notebook = json.load(notebook_file)
    except (OSError, json.JSONDecodeError):
        return {"split": None, "models": []}

    source_text = "\n".join(
        "".join(cell.get("source", []))
        for cell in notebook.get("cells", [])
        if cell.get("cell_type") == "code"
    )
    notebook_text = "\n".join(
        collect_notebook_text(cell.get("outputs", [])) for cell in notebook.get("cells", [])
    )

    split_match = re.search(
        r"train_test_split\s*\(.*?test_size\s*=\s*([0-9]*\.?[0-9]+)",
        source_text,
        re.DOTALL,
    )

    split_summary: dict[str, object] | None = None
    if split_match:
        test_size = float(split_match.group(1))
        test_percent = test_size * 100 if test_size <= 1 else test_size
        training_percent = max(0.0, 100.0 - test_percent)
        split_summary = {
            "training": training_percent,
            "testing": test_percent,
            "training_label": format_percentage(training_percent),
            "testing_label": format_percentage(test_percent),
        }

    model_patterns = (
        ("KNN", r"KNN accuracy\s*:?\s*([0-9]+(?:\.[0-9]+)?)%"),
        ("Random Forest", r"Random Forest accuracy\s*:?\s*([0-9]+(?:\.[0-9]+)?)%"),
        ("Decision Tree", r"Decision Tree accuracy\s*:?\s*([0-9]+(?:\.[0-9]+)?)%"),
        ("SVC", r"SVC accuracy\s*:?\s*([0-9]+(?:\.[0-9]+)?)%"),
    )

    models: list[dict[str, object]] = []
    for name, pattern in model_patterns:
        match = re.search(pattern, notebook_text, re.IGNORECASE)
        if not match:
            continue

        accuracy = float(match.group(1))
        models.append(
            {
                "name": name,
                "accuracy": accuracy,
                "accuracy_label": format_percentage(accuracy),
            }
        )

    return {"split": split_summary, "models": models}


def get_nearest_color(colors: list[dict[str, int | str]], r: int, g: int, b: int) -> dict[str, int | str]:
    for color in colors:
        if int(color["r"]) == r and int(color["g"]) == g and int(color["b"]) == b:
            return {**color, "distance": 0, "exact_match": True}

    closest_match: dict[str, int | str] | None = None
    minimum_distance = float("inf")

    for color in colors:
        distance = abs(r - int(color["r"])) + abs(g - int(color["g"])) + abs(b - int(color["b"]))
        if distance < minimum_distance:
            minimum_distance = distance
            closest_match = {**color, "distance": int(distance), "exact_match": False}

    if closest_match is None:
        raise RuntimeError("No color data could be loaded from color.csv.")

    return closest_match


@app.get("/")
def index() -> str:
    return render_template("index.html")


@app.get("/health")
def health():
    return jsonify(
        {
            "status": "ok",
            "dataset_available": COLOR_DATASET.exists(),
            "notebook_available": TRAINING_NOTEBOOK.exists(),
        }
    )


@app.get("/api/dataset/summary")
def dataset_summary():
    return jsonify({"row_count": count_dataset_rows()})


@app.get("/api/notebook/summary")
def notebook_summary():
    return jsonify(load_notebook_summary())


@app.post("/api/colors/match")
def match_color():
    payload = request.get_json(silent=True) or {}

    try:
        r = int(payload["r"])
        g = int(payload["g"])
        b = int(payload["b"])
    except (KeyError, TypeError, ValueError):
        return jsonify({"error": "Expected integer values for r, g, and b."}), 400

    if any(channel < 0 or channel > 255 for channel in (r, g, b)):
        return jsonify({"error": "RGB values must be between 0 and 255."}), 400

    colors = load_colors()
    match = get_nearest_color(colors, r, g, b)
    return jsonify(
        {
            "dataset": {"row_count": count_dataset_rows()},
            "match": {
                "name": match["name"],
                "r": match["r"],
                "g": match["g"],
                "b": match["b"],
                "csv_row": match["row_number"],
                "exact_match": match["exact_match"],
            },
        }
    )


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=False)
