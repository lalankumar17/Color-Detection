from __future__ import annotations

from pathlib import Path
import sys

import cv2
import pandas as pd


BASE_DIR = Path(__file__).resolve().parent
CSV_PATH = BASE_DIR / "color.csv"


def load_colors() -> pd.DataFrame:
    columns = ["color_name", "R", "G", "B"]
    return pd.read_csv(CSV_PATH, names=columns, header=0)


def get_color_name(dataframe: pd.DataFrame, red: int, green: int, blue: int) -> str:
    minimum_distance = float("inf")
    color_name = "Unknown"

    for index in range(len(dataframe)):
        distance = (
            abs(red - int(dataframe.loc[index, "R"]))
            + abs(green - int(dataframe.loc[index, "G"]))
            + abs(blue - int(dataframe.loc[index, "B"]))
        )
        if distance <= minimum_distance:
            minimum_distance = distance
            color_name = str(dataframe.loc[index, "color_name"])

    return color_name


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: python color_detection.py <image_path>")
        return 0

    image_path = Path(sys.argv[1]).expanduser()
    if not image_path.is_absolute():
        image_path = BASE_DIR / image_path

    if not image_path.exists():
        print(f"Image not found: {image_path}")
        return 0

    dataframe = load_colors()
    image = cv2.imread(str(image_path))
    if image is None:
        print(f"Unable to load image: {image_path}")
        return 0

    image = cv2.resize(image, (800, 600))
    selected = {"clicked": False, "r": 0, "g": 0, "b": 0}

    def draw_function(event, x, y, _flags, _params):
        if event == cv2.EVENT_LBUTTONDBLCLK:
            blue, green, red = image[y, x]
            selected["clicked"] = True
            selected["r"] = int(red)
            selected["g"] = int(green)
            selected["b"] = int(blue)

    cv2.namedWindow("image")
    cv2.setMouseCallback("image", draw_function)

    while True:
        preview = image.copy()
        if selected["clicked"]:
            red = selected["r"]
            green = selected["g"]
            blue = selected["b"]
            cv2.rectangle(preview, (20, 20), (600, 60), (blue, green, red), -1)

            text = (
                f"{get_color_name(dataframe, red, green, blue)} "
                f"R={red} G={green} B={blue}"
            )
            text_color = (0, 0, 0) if red + green + blue >= 600 else (255, 255, 255)
            cv2.putText(preview, text, (50, 50), 2, 0.8, text_color, 2, cv2.LINE_AA)

        cv2.imshow("image", preview)
        if cv2.waitKey(20) & 0xFF == 27:
            break

    cv2.destroyAllWindows()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
